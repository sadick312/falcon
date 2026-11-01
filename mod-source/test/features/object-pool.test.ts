// Feature #41, Nearby-object lists per tick (ObjectPool): once per tick, from the 3×3 chunks around us, builds the lists
// every module reads: all nearby objects (by sid), spikes (incl. cactus), traps, simulation states, and "blockable"
// objects within 300 of us (the Angle Finder's input).
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp(objects: { sid: number; x: number; y: number; itemId: "SPIKES" | "PIT_TRAP" | "WOOD_WALL" }[], enemyX = 4000) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: enemyX, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.addObjects(objects.map(o => ({ ...o, itemId: LIST_ID_MAP[o.itemId], owner: 2 })));
    game.update();
    game.update();
    const { default: ObjectManager } = await import("@core/logic/ObjectManager");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    return { pool: ObjectManager.pool, enemy: PlayerManager.get(2)! };
}

const sids = (list: { sid: number }[]) => list.map(o => o.sid).sort((a, b) => a - b);

describe("Nearby-object lists", () => {
    it("sorts nearby objects into spikes, traps and blockable (within 300)", async () => {
        const { pool } = await setUp([
            { sid: 701, x: 1100, y: 1000, itemId: "SPIKES" },
            { sid: 702, x: 1000, y: 1150, itemId: "PIT_TRAP" },
            { sid: 703, x: 1500, y: 1000, itemId: "WOOD_WALL" }
        ]);
        expect(sids(pool.closeObjects)).toEqual([701, 702, 703]);
        expect(sids(pool.allSpikes)).toEqual([701]);
        expect(sids(pool.allTraps)).toEqual([702]);
        expect(sids(pool.blockableObjects)).toEqual([701, 702]);
        expect(pool.simObjects.length).toBe(3);
    });

    it("today predicts an enemy 600 away can place on top of the wall next to them (possible issue P22)", async () => {
        // The wall is 85 to the enemy's left, exactly where they'd put a spike; it's 515 from us, outside "blockable".
        const { enemy } = await setUp([{ sid: 703, x: 1515, y: 1000, itemId: "WOOD_WALL" }], 1600);
        const spots = enemy.placePotential.all.slice(0, enemy.placePotential.allBufferIndex);
        const onWall = spots.filter(s => Math.hypot(s.x - 1515, s.y - 1000) < s.scale + 50 - 0.1);
        expect(onWall.length).toBeGreaterThan(0);
    });
});
