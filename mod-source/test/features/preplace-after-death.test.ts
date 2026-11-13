// Auto Place sends a preplacement a little later (to reach the server as its next tick starts). If we died during
// that wait, it was still sent: the server ignores a dead player's placement, so it only wasted packets.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => {
    vi.useRealTimers();
    game?.done();
});

const PIT_TRAP = 15;
const SPIKES = 6;

type PlacerInternals = {
    cachedBestAngles: { redefine(x: number, y: number, scale: number, angle: number, id: number, pre?: boolean, predict?: boolean): void }[];
    cachedBestAnglesCount: number;
    execute(player: unknown): void;
};

/** Hands Auto Place one waiting preplacement; `dieDuringWait` kills us before its timer fires. Returns if it was sent. */
async function preplace(dieDuringWait: boolean) {
    game = await startGame({ enable: ["autoPlacing", "preplacer"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1300, y: 1000 });
    game.setLoadout([5], [0, 3, SPIKES, 10, PIT_TRAP]);
    (await import("@core/utils/PacketTracker")).default.init();
    game.update();

    const { default: PingTracker } = await import("@core/mod/utils/PingTracker");
    PingTracker.reset();
    for (let i = 0; i <= 40; i++) PingTracker.update(50); // 50 ms ping: the batch waits about 61 ms

    const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
    const { default: PlayerUpdateEvent } = await import("@core/socket/events/core/PlayerUpdateEvent");
    const placer = PlacementSystem.AutoPlacer as unknown as PlacerInternals;
    placer.cachedBestAngles[0].redefine(1084, 1000, 50, 0, PIT_TRAP, true);
    placer.cachedBestAnglesCount = 1;
    PlayerUpdateEvent.lastReceive = performance.now();

    const before = game.sent.length;
    placer.execute(game.Client.player);
    if (dieDuringWait) game.Client.isAlive = false;
    vi.advanceTimersByTime(400);
    return game.sent.slice(before).some(p => p.type === "z" && p.args[0] === PIT_TRAP && p.args[1] === false);
}

describe("preplacement after death", () => {
    it("alive: the waiting preplacement is sent", async () => {
        expect(await preplace(false)).toBe(true);
    });

    it("dead during the wait: it isn't sent", async () => {
        expect(await preplace(true)).toBe(false);
    });
});
