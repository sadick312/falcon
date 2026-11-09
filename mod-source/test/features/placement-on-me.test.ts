// PlayerPlacementManager's "onMe" spots (an enemy's spike spots that touch us, read by the Defense System). The
// manager skips that Angle Finder call when the enemy is too far for any spot to touch us; this checks the skip
// never changes the answer, right around the cut-off too.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const PLAYER_SCALE = 35;

async function setUp(distance: number, angle: number) {
    game = await startGame();
    game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 3000 + Math.cos(angle) * distance, y: 3000 + Math.sin(angle) * distance, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
    game.update();

    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { default: PlayerPlacementManager } = await import("@core/logic/players/core/PlayerPlacementManager");
    const { default: AngleFinder } = await import("@placing/AngleFinder");
    const { getItem } = await import("@constants/items");
    return { enemy: PlayerManager.get(2)!, PlayerPlacementManager, AngleFinder, getItem };
}

/** The "onMe" count worked out the long way: every spot of a full Angle Finder call, kept if it touches us. */
function onMeTheLongWay(AngleFinder: typeof import("@placing/AngleFinder").default, enemy: import("@entities/Player").default) {
    const me = game!.Client.player.real_position;
    const count = AngleFinder.compute(enemy, { spike: true });
    let kept = 0;
    for (let i = 0; i < count; i++) {
        const s = AngleFinder.angleBuffer[i]!;
        const dx = s.x - me.x, dy = s.y - me.y;
        if (dx * dx + dy * dy < (PLAYER_SCALE + s.scale) ** 2) kept++;
    }
    return kept;
}

describe("Placement spots on us", () => {
    it("gives the same onMe spots with the far-enemy skip, at every distance around the cut-off", async () => {
        let sawSpots = false;
        let sawSkip = false;

        for (const distance of [100, 160, 170, 174, 178, 182, 200]) {
            for (const angle of [0, 2.5]) {
                const { enemy, PlayerPlacementManager, AngleFinder, getItem } = await setUp(distance, angle);
                const spike = getItem(enemy.items[2]!);
                const reach = 2 * PLAYER_SCALE + 2 * spike.scale + (spike.placeOffset ?? 0) + 1;
                const d = Math.hypot(enemy.real_position.x - game!.Client.player.real_position.x, enemy.real_position.y - game!.Client.player.real_position.y);

                const compute = vi.spyOn(AngleFinder, "compute");
                PlayerPlacementManager.update(enemy);
                const calls = compute.mock.calls.length;
                compute.mockRestore();
                const onMe = enemy.placePotential.onMeBufferIndex;

                expect(onMe, `distance ${distance}, angle ${angle}`).toBe(onMeTheLongWay(AngleFinder, enemy));
                expect(calls).toBe(d < reach ? 2 : 1);
                if (onMe > 0) sawSpots = true;
                if (calls === 1) sawSkip = true;
                game!.done();
                game = undefined;
            }
        }

        // The cases cover both sides: some enemies close enough to place on us, some skipped.
        expect(sawSpots).toBe(true);
        expect(sawSkip).toBe(true);
    }, 60_000);
});
