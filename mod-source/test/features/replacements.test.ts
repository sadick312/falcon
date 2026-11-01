// Feature #19, Replacements (AutoReplacer): when a building within 200 of us is destroyed (KILL_OBJECT) and an enemy is
// within Range, it immediately places up to 4 buildings in the freed space.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const PIT_TRAP = 15;

interface Scenario {
    enable?: string[];
    wallX?: number;
}

/** A wall between us and the enemy is destroyed; returns what we placed in reply, before the next tick. */
async function play(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable ?? ["autoPlacing", "replacer"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1200, y: 1000 });
    game.setLoadout([5], [0, 3, 6, 10, PIT_TRAP]);
    game.addObjects([{ sid: 950, x: s.wallX ?? 1090, y: 1000, itemId: LIST_ID_MAP.WOOD_WALL, owner: 2 }]);
    (await import("@core/utils/PacketTracker")).default.init();
    game.update();

    const before = game.sent.length;
    game.handlers.Q(950); // KILL_OBJECT
    return game.sent.slice(before).filter(p => p.type === "z" && p.args[1] === false).map(p => p.args[0]);
}

describe("Replacements", () => {
    it("places in the freed space as soon as a nearby building is destroyed", async () => {
        const placed = await play();
        expect(placed.length).toBeGreaterThan(0);
        expect(placed.length).toBeLessThanOrEqual(4);
    });

    it("does nothing with Replacements or Auto Place off", async () => {
        expect(await play({ enable: ["autoPlacing"] })).toEqual([]);
        expect(await play({ enable: ["replacer"] })).toEqual([]);
    });

    it("ignores buildings destroyed more than 200 away", async () => {
        expect(await play({ wallX: 1400 })).toEqual([]);
    });
});
