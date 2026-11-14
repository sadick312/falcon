// Combat/Defense/Ping Step 2: the shared Timing helper (same results as the 4 places it replaced), the Smoothed
// Tick Clock, and the "Ping Details" line. Pings and tick arrivals are fake timestamps, no real clock.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const TICK = 111; // ScriptConfig.SERVER_UPDATE_SPEED

async function setup(enable: string[] = [], pings: number[] = []) {
    game = await startGame({ enable });
    const { default: PingTracker } = await import("@core/mod/utils/PingTracker");
    const { default: Timing } = await import("@core/mod/utils/Timing");
    PingTracker.reset();
    Timing.resetTickClock();
    for (const ping of pings) PingTracker.update(ping);
    return { PingTracker, Timing };
}

describe("Timing: the old formulas, in one place", () => {
    for (const ping of [20, 50, 110, 112, 200, 350]) {
        it(`round trip ${ping} ms: one way, ticks and the preplacement wait match the old code`, async () => {
            const { PingTracker, Timing } = await setup([], [ping, ping, ping]);
            const stable = PingTracker.getStablePing();
            expect(Timing.oneWayMs()).toBe(stable / 2);
            // HatSystem's Remember Sent Equips and the own-shame check.
            expect(Math.max(1, Timing.roundTripTicks())).toBe(Math.max(1, Math.ceil(stable / TICK)));
            expect(Timing.roundTripTicks(2 * 7)).toBe(Math.ceil((stable + 14) / TICK));
            // AutoPlacer: (tick - stable + padding + jitter) - (now - lastTick), jitter 0 with the setting off.
            const old = (TICK - stable + .5 + 0) - (1030 - 1000);
            expect(Timing.waitForNextTick(1030, 1000, .5)).toBe(old);
        });
    }

    it("200 ms+ round trip: the preplacement is already late, so it is sent at once (wait <= 0)", async () => {
        const { Timing } = await setup([], [250, 250, 250]);
        expect(Timing.waitForNextTick(1000, 1000, .5)).toBeLessThanOrEqual(0);
        expect(Timing.roundTripTicks()).toBe(3);
    });

    it("one ping spike doesn't move any timing (the stable ping is a median)", async () => {
        const { PingTracker, Timing } = await setup([], [50, 50, 50, 50, 50]);
        const before = Timing.waitForNextTick(1030, 1000, .5);
        PingTracker.update(900);
        expect(Timing.waitForNextTick(1030, 1000, .5)).toBe(before);
        expect(Timing.roundTripTicks()).toBe(1);
    });

    it("Jitter-Safe Timing adds the jitter to the preplacement wait; off adds nothing", async () => {
        const off = await setup([], [50, 70, 50, 70]);
        const plain = off.Timing.waitForNextTick(1030, 1000, .5);
        expect(off.Timing.jitterMargin()).toBe(0);
        game?.done();
        const on = await setup(["jitterSafeTiming"], [50, 70, 50, 70]);
        expect(on.Timing.jitterMargin()).toBeGreaterThan(0);
        expect(on.Timing.waitForNextTick(1030, 1000, .5)).toBeCloseTo(plain + on.Timing.jitterMargin(), 10);
    });
});

describe("Smoothed Tick Clock", () => {
    /** Feeds arrivals; returns the clock's estimate after the last one. */
    function feed(Timing: { onRealTick(t: number): void; smoothedTickTime(): number }, arrivals: number[]) {
        for (const t of arrivals) Timing.onRealTick(t);
        return Timing.smoothedTickTime();
    }
    const steady = (n: number, start = 1000) => Array.from({ length: n }, (_, i) => start + i * TICK);

    it("steady ticks: the estimate is the real arrival", async () => {
        const { Timing } = await setup();
        expect(feed(Timing, steady(20))).toBeCloseTo(1000 + 19 * TICK, 6);
    });

    it("one tick 40 ms late (Wi-Fi spike) moves it only 5 ms, and it settles back", async () => {
        const { Timing } = await setup();
        const arrivals = steady(20);
        const last = arrivals[19]! + TICK + 40;
        feed(Timing, arrivals);
        expect(feed(Timing, [last])).toBeCloseTo(arrivals[19]! + TICK + 5, 6);
        const after = steady(30, arrivals[19]! + 2 * TICK);
        expect(feed(Timing, after) - after[29]!).toBeLessThan(1);
    });

    it("lost or bunched ticks (two arrive together after a stall) don't throw it off", async () => {
        const { Timing } = await setup();
        const base = steady(20);
        feed(Timing, base);
        const t = base[19]!;
        // Tick 21 is held back 100 ms and arrives together with tick 22.
        feed(Timing, [t + 2 * TICK, t + 2 * TICK + 1]);
        const after = steady(15, t + 3 * TICK);
        expect(Math.abs(feed(Timing, after) - after[14]!)).toBeLessThan(3);
    });

    it("a lasting shift (+30 ms) is followed within ~25 ticks", async () => {
        const { Timing } = await setup();
        feed(Timing, steady(20));
        const shifted = steady(25, 1000 + 20 * TICK + 30);
        expect(Math.abs(feed(Timing, shifted) - shifted[24]!)).toBeLessThan(1.5);
    });

    it("a stall longer than 3 ticks restarts it from the next arrival", async () => {
        const { Timing } = await setup();
        feed(Timing, steady(10));
        expect(feed(Timing, [50_000])).toBe(50_000);
    });

    it("off (default): the preplacement wait uses the last arrival; on: the smoothed estimate", async () => {
        const off = await setup([], [50, 50, 50]);
        feed(off.Timing, [...steady(20), 1000 + 20 * TICK + 40]);
        const lastArrival = 1000 + 20 * TICK + 40;
        expect(off.Timing.waitForNextTick(lastArrival + 10, lastArrival, .5)).toBe(TICK - 50 + .5 - 10);
        game?.done();

        const on = await setup(["smoothedTickClock"], [50, 50, 50]);
        feed(on.Timing, [...steady(20), lastArrival]);
        // The smoothed tick is 35 ms earlier than the late arrival, so the wait is 35 ms shorter.
        expect(on.Timing.waitForNextTick(lastArrival + 10, lastArrival, .5)).toBeCloseTo(TICK - 50 + .5 - 10 - 35, 6);
    });

    it("on, before the first tick: falls back to the last arrival", async () => {
        const { Timing } = await setup(["smoothedTickClock"], [50, 50, 50]);
        expect(Timing.waitForNextTick(1010, 1000, .5)).toBe(TICK - 50 + .5 - 10);
    });
});

describe("Ping Details (default off)", () => {
    it("off: the classic line; on: adds stable ping, jitter and tick jitter", async () => {
        await setup([], [40, 60, 50]);
        const { pingDisplayText } = await import("@ui/pingDisplayText");
        expect(pingDisplayText()).not.toContain("Stable");
        game?.done();
        await setup(["pingDetails"], [40, 60, 50]);
        const text = (await import("@ui/pingDisplayText")).pingDisplayText();
        expect(text).toMatch(/^Ping: 50 ms \| FPS: .* \| Stable: 50 ms \| Jitter: \d+ ms \| Tick jitter: \d+ ms$/);
    });

    it("both new settings are off by default", async () => {
        vi.resetModules(); // earlier games turned them on in their copy of the menu
        const { utilitySettings } = await import("@menu/content/utility");
        const { visualSettings } = await import("@menu/content/visual");
        type Item = { id: string; status?: unknown; settings?: Item[] };
        const find = (items: Item[], id: string): Item | undefined =>
            items.map(i => i.id === id ? i : find(i.settings ?? [], id)).find(Boolean);
        expect(find(utilitySettings as Item[], "smoothedTickClock")?.status).toBe(false);
        expect(find(visualSettings as Item[], "pingDetails")?.status).toBe(false);
    });
});
