// Ping brief, Phase 3: the three timings that read ping all use PingTracker's one stable ping, and with
// "Jitter-Safe Timing" (default off) they leave room for jitter:
//  - Auto Place's preplacements are sent to reach the server as its next tick starts: 111 - ping (+0.5) ms after the
//    last update; with the setting, later by the jitter (late still places, early fails);
//  - a heal of ours counts as food (for our shame count) up to 2 + ceil(ping / 111) ticks after we ate; with the
//    setting, ceil((ping + 2 × jitter) / 111);
//  - the packet budget counts older packets as still in the server's 1 s window for one jitter longer.
// Off, every timing is exactly as before.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => {
    vi.useRealTimers();
    game?.done();
});

const PIT_TRAP = 15;
const SPIKES = 6;
const TOGGLE = "jitterSafeTiming";

/** Feeds PingTracker samples that give `stable` as the median and a jitter of about `jitter`. */
async function setPing(stable: number, jitter: number) {
    const { default: PingTracker } = await import("@core/mod/utils/PingTracker");
    PingTracker.reset();
    // Alternating stable, stable + jitter, ending on stable: the last five are s, s+j, s, s+j, s, so the median is
    // `stable` and every step changes by `jitter`.
    for (let i = 0; i <= 40; i++) PingTracker.update(i % 2 ? stable + jitter : stable);
    return PingTracker;
}

describe("preplacement timing", () => {
    type PlacerInternals = {
        cachedBestAngles: { redefine(x: number, y: number, scale: number, angle: number, id: number, pre?: boolean, predict?: boolean): void }[];
        cachedBestAnglesCount: number;
        execute(player: unknown): void;
    };

    /** One preplacement handed to Auto Place right after a server update; returns when it was sent (ms). */
    async function sendTime(ping: number, jitter: number, enable: string[]) {
        game = await startGame({ enable: ["autoPlacing", "preplacer", ...enable] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1300, y: 1000 });
        game.setLoadout([5], [0, 3, SPIKES, 10, PIT_TRAP]);
        (await import("@core/utils/PacketTracker")).default.init();
        game.update();
        const PingTracker = await setPing(ping, jitter);

        const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
        const { default: PlayerUpdateEvent } = await import("@core/socket/events/core/PlayerUpdateEvent");
        const placer = PlacementSystem.AutoPlacer as unknown as PlacerInternals;
        placer.cachedBestAngles[0].redefine(1084, 1000, 50, 0, PIT_TRAP, true);
        placer.cachedBestAnglesCount = 1;
        PlayerUpdateEvent.lastReceive = performance.now();
        game.Client.markers.length = 0;

        const before = game.sent.length;
        const placed = () => game!.sent.slice(before).some(p => p.type === "z" && p.args[0] === PIT_TRAP && p.args[1] === false);
        placer.execute(game.Client.player);
        let waited = 0;
        while (!placed() && waited < 400) { vi.advanceTimersByTime(1); waited++; }
        return { waited, stable: PingTracker.getStablePing(), jitter: PingTracker.getJitter() };
    }

    for (const ping of [50, 150, 300]) {
        it(`at ${ping} ms ping: sent to land as the next tick starts; the setting adds the jitter`, async () => {
            const off = await sendTime(ping, 40, []);
            game!.done();
            const on = await sendTime(ping, 40, [TOGGLE]);

            const expectedOff = Math.max(0, Math.ceil(111 - off.stable + 0.5));
            // The timer may fire a millisecond either side of the rounded-up wait.
            expect(Math.abs(off.waited - expectedOff)).toBeLessThanOrEqual(1);
            expect(on.jitter).toBeGreaterThan(5);
            expect(Math.abs(on.waited - Math.max(0, Math.ceil(111 - on.stable + 0.5 + on.jitter)))).toBeLessThanOrEqual(1);
            if (ping < 111) expect(on.waited).toBeGreaterThan(off.waited);
        });
    }

    it("on a steady connection (no jitter) the setting changes nothing", async () => {
        const off = await sendTime(80, 0, []);
        game!.done();
        const on = await sendTime(80, 0, [TOGGLE]);
        expect(on.jitter).toBe(0);
        expect(on.waited).toBe(off.waited);
    });
});

describe("the \"did we just eat\" window for our shame count", () => {
    /** We take a hit, eat, and the heal shows up `ticksLater` ticks after eating. Returns whether it counted as food. */
    async function healCounts(ping: number, jitter: number, ticksLater: number, enable: string[]) {
        game = await startGame({ enable });
        game.spawn({ sid: ME, x: 1000, y: 1000 });
        await setPing(ping, jitter);
        game.update();

        game.setHealth(ME, 60); // a hit
        game.Client.lastAteTick = game.tick;
        for (let i = 0; i < ticksLater; i++) game.update();
        game.setHealth(ME, 100); // the heal
        return game.Client.player.hitTime === 0; // counted as food: shame updated and the hit marker cleared
    }

    // [ping, last tick after eating that a heal still counts with the setting off]; jitter 60 adds at least a tick when on
    const CASES: [number, number][] = [[50, 3], [150, 4], [300, 5]];

    for (const [ping, lastOff] of CASES) {
        it(`at ${ping} ms ping: counts a heal up to ${lastOff} ticks after eating; with high jitter and the setting, longer`, async () => {
            expect(await healCounts(ping, 0, lastOff, [])).toBe(true);
            game!.done();
            expect(await healCounts(ping, 0, lastOff + 1, [])).toBe(false);
            game!.done();
            // High jitter, setting off: the same window as before.
            expect(await healCounts(ping, 60, lastOff + 1, [])).toBe(false);
            game!.done();
            // Setting on: a heal that came back a tick late (the ping jumped) still counts.
            expect(await healCounts(ping, 60, lastOff + 1, [TOGGLE])).toBe(true);
        });
    }
});

describe("packet budget with jitter", () => {
    /** 60 packets sent 0.9 s ago; how many placements does the budget allow now? */
    async function granted(jitter: number, enable: string[]) {
        vi.useFakeTimers({ toFake: ["performance"] });
        game = await startGame({ enable });
        const { default: PacketTracker } = await import("@core/utils/PacketTracker");
        PacketTracker.init();
        PacketTracker.allocate();
        await setPing(60, jitter);
        for (let i = 0; i < 60; i++) PacketTracker.add();
        vi.advanceTimersByTime(900);
        return PacketTracker.request("PLACE", 8);
    }

    it("with high jitter and the setting, keeps more room (counts old packets a little longer)", async () => {
        const off = await granted(60, []);
        game!.done();
        const on = await granted(60, [TOGGLE]);
        expect(on).toBeLessThan(off);
    });

    it("without jitter the setting changes nothing", async () => {
        const off = await granted(0, []);
        game!.done();
        const on = await granted(0, [TOGGLE]);
        expect(on).toBe(off);
    });
});
