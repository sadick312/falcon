// Feature #40, Objects + spatial grid (ObjectManager): keeps every building and resource by sid and in a grid of
// 1440×1440 chunks for nearby lookups; LOAD_GAME_OBJECT (`H`) adds (a resent sid is ignored), KILL_OBJECT (`Q`) removes
// one, KILL_OBJECTS (`R`) removes everything a player owned (they left), SET_UP_GAME clears the loading screen's
// decorative objects (owner 6967). `checkItem` is 1.8.2's checkItemLocation: no overlap with
// getScale(.6, isItem) / blocker, and nothing but a platform (18) in the river band.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    const { default: ObjectManager } = await import("@core/logic/ObjectManager");
    const { LIST_ID_MAP } = await import("@constants/items");
    const near = () => ObjectManager.getObjects(1000, 1000).map(o => o.sid).sort((a, b) => a - b);
    return { ObjectManager, LIST_ID_MAP, near };
}

describe("Objects + spatial grid", () => {
    it("finds objects in our chunk and the 8 around it, not farther", async () => {
        const { LIST_ID_MAP, near } = await setUp();
        game!.addObjects([
            { sid: 701, x: 1100, y: 1000, itemId: LIST_ID_MAP.WOOD_WALL, owner: 2 },
            { sid: 702, x: 2000, y: 2000, itemId: LIST_ID_MAP.WOOD_WALL, owner: 2 }, // next chunk
            { sid: 703, x: 4000, y: 1000, itemId: LIST_ID_MAP.WOOD_WALL, owner: 2 } // 2 chunks away
        ]);
        expect(near()).toEqual([701, 702]);
    });

    it("ignores a resent object, and removes one on KILL_OBJECT", async () => {
        const { ObjectManager, LIST_ID_MAP, near } = await setUp();
        const wall = { sid: 701, x: 1100, y: 1000, itemId: LIST_ID_MAP.WOOD_WALL, owner: 2 };
        game!.addObjects([wall]);
        game!.addObjects([wall]);
        expect(near()).toEqual([701]);
        game!.handlers.Q(701);
        expect(near()).toEqual([]);
        expect(ObjectManager.getObject(701)).toBeUndefined();
    });

    it("removes everything a player owned when they leave (KILL_OBJECTS)", async () => {
        const { LIST_ID_MAP, near } = await setUp();
        game!.addObjects([
            { sid: 701, x: 1100, y: 1000, itemId: LIST_ID_MAP.WOOD_WALL, owner: 2 },
            { sid: 702, x: 1000, y: 1100, itemId: LIST_ID_MAP.WOOD_WALL, owner: ME }
        ]);
        game!.handlers.R(2);
        expect(near()).toEqual([702]);
    });

    it("checks a spot like the game: no overlap, no river (except a platform)", async () => {
        const { ObjectManager, LIST_ID_MAP } = await setUp();
        game!.addObjects([{ sid: 701, x: 1100, y: 1000, itemId: LIST_ID_MAP.WOOD_WALL, owner: 2 }]);
        game!.update();
        // Wall scale 50 + spike 49: overlapping under 99 apart.
        expect(ObjectManager.checkItem(1100, 1098, 49, LIST_ID_MAP.SPIKES)).toBe(false);
        expect(ObjectManager.checkItem(1100, 1100 + 50, 49, LIST_ID_MAP.SPIKES)).toBe(true);
        expect(ObjectManager.checkItem(1000, 7200, 49, LIST_ID_MAP.SPIKES)).toBe(false);
        expect(ObjectManager.checkItem(1000, 7200, 49, 18)).toBe(true);
    });
});
