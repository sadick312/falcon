// Breaker brief, Part A1: when are we stuck in an enemy pit trap? 1.8.2 locks a player when the distance to the trap
// is at most player scale (35) + the trap's collision size (50 × colDiv 0.2 = 10) = 45, the same rule as Falcon's own
// MovementPhysicsSimulator. The classic detection used 50.5, so it thought we were stuck up to 5.5 px too early.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function trapAt(distance: number, enable: string[] = [], owner = 2) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000 + distance, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1600, y: 1000 });
    game.setLoadout([5, 10], [0, 3, 6, 10, 15]);
    game.addObjects([{ sid: 600, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP as number, owner }]);
    game.update();
    game.update();
    return game.Client.player.trap;
}

describe("trap detection (Exact Trap Distance, off by default)", () => {
    it("off (classic): 48 px from an enemy trap counts as stuck", async () => {
        expect((await trapAt(48))?.sid).toBe(600);
    });

    it("on: 48 px is not stuck (the game only locks at 45 or closer)", async () => {
        expect(await trapAt(48, ["exactTrapDistance"])).toBeUndefined();
    });

    it("on: exactly 45 px and 44 px are stuck", async () => {
        expect((await trapAt(45, ["exactTrapDistance"]))?.sid).toBe(600);
        game!.done();
        expect((await trapAt(44, ["exactTrapDistance"]))?.sid).toBe(600);
    });

    it("on: our own trap never counts", async () => {
        const { ME: me } = await import("../helpers/game");
        expect(await trapAt(10, ["exactTrapDistance"], me)).toBeUndefined();
    });
});
