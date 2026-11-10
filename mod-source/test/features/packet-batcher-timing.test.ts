// Ping brief, Phase 5: PacketBatcher's timing paths. After a real player update it arms a watchdog: if the next real
// update is later than the server tick plus a margin (5-40 ms, twice the tick jitter), it runs a fake empty update so
// the tick still happens, and keeps doing so every threshold while the socket is open and we're alive. Real updates
// feed the tick-jitter estimate (long gaps skipped). The 0.5 ms wait loop flushes once no packet came for 0.5 ms.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

type Internals = { flush(): void; poll(): void; lastPacketCollected: number; buffer: unknown[]; watchdogTimer: number | null };

/** The batcher with a stand-in socket that records what it is handed. `alive`: we are in the game. */
async function batcher(opts: { alive?: boolean } = {}) {
    game = await startGame();
    if (opts.alive !== false) game.spawn({ sid: ME, x: 1000, y: 1000 });
    const { default: PacketBatcher } = await import("@core/utils/PacketBatcher");
    const { default: PlayerUpdateEvent } = await import("@core/socket/events/core/PlayerUpdateEvent");
    const handled: { type: string; fake: boolean; at: number }[] = [];
    const socket = {
        readyState: 1,
        processPacket: (type: string, data: unknown[][]) => {
            handled.push({ type, fake: type === "a" && Array.isArray(data) && data.every(d => Array.isArray(d) && d.length === 0), at: performance.now() });
        }
    };
    PacketBatcher.init(socket as never);
    // Like a real session: the page has been open a while before the first update (the first interval after a reset
    // is measured from page load, and gaps over a second are skipped).
    vi.advanceTimersByTime(2_000);
    PacketBatcher.reset();
    const internals = PacketBatcher as unknown as Internals;

    /** A real player update arriving now (Socket.onMessage stamps lastReceive, then the batch is flushed). */
    const realUpdate = () => {
        PlayerUpdateEvent.lastReceive = performance.now();
        PacketBatcher.add("a" as never, [[1], [1], []] as never);
        internals.flush();
    };
    const fakes = () => handled.filter(h => h.fake);
    return { PacketBatcher, PlayerUpdateEvent, socket, handled, internals, realUpdate, fakes };
}

describe("fake ticks when an update is late", () => {
    it("runs a fake tick once the update is 116 ms late on a steady connection, then every 116 ms", async () => {
        const { realUpdate, fakes } = await batcher();
        realUpdate();

        vi.advanceTimersByTime(115);
        expect(fakes()).toHaveLength(0);
        vi.advanceTimersByTime(1);
        expect(fakes()).toHaveLength(1);
        vi.advanceTimersByTime(116);
        expect(fakes()).toHaveLength(2);
    });

    it("a real update in time resets the watchdog, so no fake tick runs", async () => {
        const { realUpdate, fakes } = await batcher();
        for (let i = 0; i < 5; i++) {
            realUpdate();
            vi.advanceTimersByTime(111);
        }
        expect(fakes()).toHaveLength(0);
    });

    it("no fake ticks while we're dead (the server sends no ticks then)", async () => {
        const { realUpdate, fakes } = await batcher({ alive: false });
        realUpdate();
        vi.advanceTimersByTime(1_000);
        expect(fakes()).toHaveLength(0);
    });

    it("stops faking once the socket is no longer open", async () => {
        const { realUpdate, fakes, socket } = await batcher();
        realUpdate();
        vi.advanceTimersByTime(116);
        expect(fakes()).toHaveLength(1);
        socket.readyState = 3;
        vi.advanceTimersByTime(1_000);
        expect(fakes()).toHaveLength(1);
    });

    it("a batch without a player update checks for a late tick at once", async () => {
        const { realUpdate, fakes, PacketBatcher, internals } = await batcher();
        realUpdate();
        vi.advanceTimersByTime(200); // watchdog already fired once at 116
        const before = fakes().length;
        PacketBatcher.add("O" as never, [1, 50] as never);
        vi.advanceTimersByTime(40);
        internals.flush(); // 124 ms after that fake tick: late again
        expect(fakes().length).toBe(before + 1);
    });

    it("reset drops waiting packets, the watchdog and the jitter (reconnect)", async () => {
        const { realUpdate, fakes, PacketBatcher, internals } = await batcher();
        realUpdate();
        PacketBatcher.tickJitter = 20;
        PacketBatcher.add("O" as never, [1, 50] as never);
        PacketBatcher.reset();

        expect(internals.buffer).toHaveLength(0);
        expect(internals.watchdogTimer).toBeNull();
        expect(PacketBatcher.tickJitter).toBe(0);
        vi.advanceTimersByTime(1_000);
        expect(fakes()).toHaveLength(0);
    });
});

describe("tick jitter", () => {
    it("stays 0 for updates exactly a tick apart and grows when they arrive unevenly", async () => {
        const { realUpdate, PacketBatcher } = await batcher();
        for (let i = 0; i < 4; i++) {
            realUpdate();
            vi.advanceTimersByTime(111);
        }
        expect(PacketBatcher.tickJitter).toBe(0);

        realUpdate();
        vi.advanceTimersByTime(141); // 30 ms late
        realUpdate();
        expect(PacketBatcher.tickJitter).toBeCloseTo(30 / 8, 5);
    });

    it("skips gaps over a second (background tab, respawn)", async () => {
        const { realUpdate, PacketBatcher, socket } = await batcher();
        realUpdate();
        socket.readyState = 3; // no fake ticks in between
        vi.advanceTimersByTime(5_000);
        realUpdate();
        expect(PacketBatcher.tickJitter).toBe(0);
    });
});

describe("handling a batch", () => {
    it("keeps going when one packet's handler throws", async () => {
        const { PacketBatcher, socket, internals } = await batcher();
        const error = vi.spyOn(console, "error").mockImplementation(() => { });
        const seen: string[] = [];
        socket.processPacket = (type: string) => {
            seen.push(type);
            if (type === "K") throw new Error("bad packet");
        };
        PacketBatcher.add("K" as never, [] as never);
        PacketBatcher.add("O" as never, [1, 50] as never);
        internals.flush();

        expect(seen.filter(type => type !== "a")).toEqual(["K", "O"]); // "a": the fake tick for the missing update
        expect(error).toHaveBeenCalledTimes(1);
    });

    it("waits until no packet came for 0.5 ms, then hands the batch over", async () => {
        const { PacketBatcher, handled, internals } = await batcher();
        PacketBatcher.add("O" as never, [1, 50] as never);
        vi.advanceTimersByTime(0.3);
        internals.poll(); // too soon: waits on
        expect(handled).toHaveLength(0);
        vi.advanceTimersByTime(0.3);
        internals.poll();
        expect(handled.filter(h => !h.fake).map(h => h.type)).toEqual(["O"]);
    });

    it("does nothing before a socket is set", async () => {
        game = await startGame();
        vi.resetModules();
        const { default: PacketBatcher } = await import("@core/utils/PacketBatcher");
        PacketBatcher.add("O" as never, [1, 50] as never);
        expect(() => (PacketBatcher as unknown as Internals).flush()).not.toThrow();
    });
});
