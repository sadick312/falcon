// Feature #42, Predicted placements (PotentialObjectManager): "ghost" pit traps where an enemy could place one this
// tick (from PlayerPlacementManager; not for a tool hammer). A ghost is dropped when a real building appears on it,
// when its owner leaves (KILL_OBJECTS), when no enemy could place it for 1 s, or after 10 s more than 800 from us.
// Ghosts within 200 lower the grade of our spots on them; ones that will break boost a "predict" spot.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1250, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
    game.update();
    const { default: PotentialObjectManager } = await import("@core/logic/PotentialObjectManager");
    const active = () => PotentialObjectManager.allObjects.filter(o => o.active);
    return { active };
}

describe("Predicted placements", () => {
    it("puts ghosts around an enemy, owned by them", async () => {
        const { active } = await setUp();
        expect(active().length).toBeGreaterThan(0);
        expect(active().every(o => o.ownerSID === 2 && Math.hypot(o.x - 1250, o.y - 1000) < 200)).toBe(true);
    });

    it("drops a ghost when a real building appears on it, and all of them when the owner leaves", async () => {
        const { active } = await setUp();
        const { LIST_ID_MAP } = await import("@constants/items");
        const ghost = active()[0];
        game!.addObjects([{ sid: 701, x: ghost.x, y: ghost.y, itemId: LIST_ID_MAP.WOOD_WALL, owner: 2 }]);
        expect(ghost.active).toBe(false);
        game!.handlers.R(2);
        expect(active()).toEqual([]);
    });

    it("drops an enemy's ghosts once they walk away (P23)", async () => {
        const { active } = await setUp();
        const before = active().map(o => [o.x, o.y]);
        // The enemy walks 600 away (still on screen) and stays there for 5 s.
        game!.update([{ sid: 2, x: 1850, y: 1000 }]);
        for (let i = 0; i < 45; i++) game!.update();
        // They used to stay while within 800 of us.
        const stale = active().filter(o => before.some(([x, y]) => x === o.x && y === o.y));
        expect(stale).toEqual([]);
    });

    it("keeps the ghosts of an enemy who stays put", async () => {
        const { active } = await setUp();
        const before = active().length;
        for (let i = 0; i < 45; i++) game!.update();
        expect(active().length).toBeGreaterThanOrEqual(before);
        expect(active().every(o => Math.hypot(o.x - 1250, o.y - 1000) < 200)).toBe(true);
    });
});
