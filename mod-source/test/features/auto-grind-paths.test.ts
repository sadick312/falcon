// Auto Grind (AutoGrinder): the paths auto-grind.test.ts doesn't reach. With a 7th-slot building other than the
// turret it places two of them, 45 degrees either side of the aim; and while grinding the secondary it goes back to
// the primary once the secondary reaches its limit and the primary hasn't.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const POLEARM = 5;
const GREAT_HAMMER = 10;
const TURRET = 17;
const TELEPORTER = 22;

/** Packets of one tick: buildings placed (with their angle) and weapons held. */
function lastTick(g: Game, before: number) {
    const sent = g.sent.slice(before);
    return {
        placed: sent.filter(p => p.type === "z" && p.args[1] === false).map(p => p.args[0]),
        // A placement is "select the item, then hit at the angle": F [1, angle].
        angles: sent.filter(p => p.type === "F" && p.args[0] === 1).map(p => p.args[1] as number),
        held: sent.filter(p => p.type === "z" && p.args[1] === true).map(p => p.args[0])
    };
}

async function setUp(seventh: number, primaryVariant = 0, secondaryVariant = 0) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM, weaponVariant: primaryVariant });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    game.setLoadout([POLEARM, GREAT_HAMMER], [0, 3, 6, 10, 15, seventh]);
    game.Client.weaponIndex = POLEARM;
    game.update();
    game.update([{ sid: ME, weaponIndex: GREAT_HAMMER, weaponVariant: secondaryVariant }]);
    game.update([{ sid: ME, weaponIndex: POLEARM, weaponVariant: primaryVariant }]);
    game.Menu.itemMap.autoGrind.status = true;
    const { Input } = await import("@ui/Input");
    vi.spyOn(Input, "getAttackDir").mockReturnValue(0);
    return game;
}

describe("Auto Grind: other paths", () => {
    it("works before we have a secondary weapon (it threw 'Unknown weapon id NaN' every tick)", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.spawn({ sid: 2, x: 4000, y: 4000 });
        game.setLoadout([POLEARM], [0, 3, 6, 10, 15, TURRET]);
        game.Client.weaponIndex = POLEARM;
        game.update();
        game.Menu.itemMap.autoGrind.status = true;
        const { Input } = await import("@ui/Input");
        vi.spyOn(Input, "getAttackDir").mockReturnValue(0);

        const before = game.sent.length;
        expect(() => game!.update()).not.toThrow();
        // No secondary counts as "reached", as before 8 Nov: it grinds the primary.
        expect(lastTick(game, before).placed).toEqual([TURRET, TURRET, TURRET]);
        expect(game.Menu.getValue("autoGrind")).toBe(true);
    });

    it("with a teleporter in the 7th slot, places two, 45 degrees either side of the aim", async () => {
        const g = await setUp(TELEPORTER);
        const before = g.sent.length;
        g.update();
        const { placed, angles } = lastTick(g, before);
        expect(placed).toEqual([TELEPORTER, TELEPORTER]);
        expect(angles).toHaveLength(2);
        expect(angles[0]).toBeCloseTo(Math.PI / 4);
        expect(angles[1]).toBeCloseTo(-Math.PI / 4);
    });

    it("goes back to the primary when the secondary reaches its limit first", async () => {
        // Primary at its limit (diamond), secondary not: grinds with the hammer.
        const g = await setUp(TURRET, 2, 0);
        const before = g.sent.length;
        g.update();
        expect(lastTick(g, before).held).toContain(GREAT_HAMMER);

        // Now the primary limit is ruby and the hammer reached gold: back to the polearm.
        g.Menu.itemMap.grindPrimaryLimit.status = 3;
        g.update([{ sid: ME, weaponIndex: GREAT_HAMMER, weaponVariant: 1 }]);
        g.update([{ sid: ME, weaponIndex: GREAT_HAMMER, weaponVariant: 1 }]);
        expect(g.Menu.getValue("autoGrind")).toBe(true);

        const { default: AutoGrinder } = await import("@core/mod/combat/placing/modules/AutoGrinder");
        expect(AutoGrinder.weaponIndex).toBe(POLEARM);
    });
});
