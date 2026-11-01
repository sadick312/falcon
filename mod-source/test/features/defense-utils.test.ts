// Feature #34, Defense helpers (DefenseUtils, DefenseModule, BreakerUtils): whether EMP helmet would keep an enemy's
// turret gear off us (it can't if the shot at the enemy's real target passes through us), whether an enemy's
// projectile has a clear line to us (1.8.2: a projectile is stopped by objects with layer >= its layer), building
// damage (tank gear ×3.3, weapon sDmg), hits to break, and reach to an object.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const HUNTING_BOW = 9;
const TURRET_GEAR = 53;

async function setUp(objects: { itemId: "WOOD_WALL" | "WINDMILL"; x: number; y: number }[] = [], others: { sid: number; x: number }[] = []) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1300, y: 1000 });
    for (const o of others) game.spawn({ sid: o.sid, x: o.x, y: 1000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.addObjects(objects.map((o, i) => ({ sid: 900 + i, x: o.x, y: o.y, itemId: LIST_ID_MAP[o.itemId], owner: 2 })));
    game.update();
    game.update();
    const { default: DefenseUtils } = await import("@core/mod/defense/utils/DefenseUtils");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    return { DefenseUtils, enemy: PlayerManager.get(2)! };
}

describe("Defense helpers", () => {
    it("see arrows stopped by walls, turret shots only by layer-1 buildings", async () => {
        const wall = await setUp([{ itemId: "WOOD_WALL", x: 1150, y: 1000 }]);
        const bow = { id: HUNTING_BOW } as never;
        const turret = { id: TURRET_GEAR } as never;
        expect(wall.DefenseUtils.isInLineOfSight(wall.enemy, bow)).toBe(false);
        expect(wall.DefenseUtils.isInLineOfSight(wall.enemy, turret)).toBe(true);

        const mill = await setUp([{ itemId: "WINDMILL", x: 1150, y: 1000 }]);
        expect(mill.DefenseUtils.isInLineOfSight(mill.enemy, turret)).toBe(false);

        const open = await setUp();
        expect(open.DefenseUtils.isInLineOfSight(open.enemy, bow)).toBe(true);
    });

    it("allow EMP helmet when nobody else is near the enemy", async () => {
        const { DefenseUtils, enemy } = await setUp();
        expect(DefenseUtils.canUseEMP(enemy)).toBe(true);
    });

    it("rule out EMP helmet when the enemy's turret shot at another player would pass through us", async () => {
        // Player 3 stands behind us, in line with the enemy. It used to be skipped: `isTeam(entity, entity.sid)` is
        // true for every player, so only animals were considered.
        const { DefenseUtils, enemy } = await setUp([], [{ sid: 3, x: 900 }]);
        expect(DefenseUtils.canUseEMP(enemy)).toBe(false);
    });
});
