// BreakerUtils.hitsUntilBreak: how many hits a building needs. The game breaks it once its health is 0 or less, so
// health that is an exact multiple of the hit's damage breaks on that hit. The classic count, floor(health / damage + 1),
// counts one hit too many there; "Exact Break Hit Count" (Defense System, off by default) counts it exactly.
// Used by the Hat System (can a trapped dagger enemy get out) and Auto Breaker.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const GREAT_HAMMER = 10;

/** Hits an enemy's great hammer (10 x 3.3 tank gear x 7.5 = 247.5 a hit) needs for each health. */
async function hammerHits(exact: boolean, healths: number[]) {
    game = await startGame({ settings: { exactBreakHits: exact } });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1300, y: 1000, weaponIndex: 5 });
    game.update();
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { default: BreakerUtils } = await import("@core/mod/defense/utils/BreakerUtils");
    const enemy = PlayerManager.get(2)!;
    enemy.weaponData.secondary = GREAT_HAMMER;
    enemy.weaponData.secondaryVariant = 0;
    return healths.map(h => BreakerUtils.hitsUntilBreak(enemy, GREAT_HAMMER, h));
}

describe("hits until a building breaks", () => {
    it("classic (off): one hit too many at an exact multiple of the damage", async () => {
        expect(await hammerHits(false, [100, 247.5, 300, 495, 500])).toEqual([1, 2, 2, 3, 3]);
    });

    it("Exact Break Hit Count (on): an exact multiple breaks on that hit; everything else is the same", async () => {
        expect(await hammerHits(true, [100, 247.5, 300, 495, 500])).toEqual([1, 1, 2, 2, 3]);
    });
});
