// AutoPlacer.preStart skips its spot search while Auto Place is off and the nearest enemy isn't trapped (Phase 5
// speed-up). The skip must still do what the search did for others: no preplacements, and the "angles used recently"
// count reset while we move (Placer.process), so the Angle Finder runs of Auto Break and enemy prediction see no stale
// used angles after Auto Place is turned off.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function skipped(moveBy: number) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1300, y: 1000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();

    const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
    const placer = PlacementSystem.AutoPlacer;
    const player = game.Client.player;
    PlacementSystem.usedAnglesCount = 3;
    placer.potentialPreplacements.count = 2;
    player.next_position.x = player.real_position.x + moveBy;
    player.next_position.y = player.real_position.y;
    placer.preStart(player);
    return { used: PlacementSystem.usedAnglesCount, preplacements: placer.potentialPreplacements.count };
}

describe("AutoPlacer.preStart skip (Auto Place off, no trapped enemy)", () => {
    it("moving 5 px or more: clears the used-angles count, like the full search", async () => {
        expect(await skipped(10)).toEqual({ used: 0, preplacements: 0 });
    });

    it("standing still: keeps the used-angles count, like the full search", async () => {
        expect(await skipped(0)).toEqual({ used: 3, preplacements: 0 });
    });
});
