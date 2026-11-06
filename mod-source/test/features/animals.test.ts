// Animals (LoadAiEvent, entities/Ai): LOAD_AI lists every visible animal as [sid, type, x, y, dir × 100, health,
// name index, 0] (1.8.2's 7-value entries are converted to this by LegacyPacketAdapter), plus the sids that left view.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const COW = 0;
const WOLF = 2;

async function setUp() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    const { ais } = await import("@entities/Ai");
    const { default: aiTypes } = await import("@constants/aiTypes");
    const { default: TextManager } = await import("@core/logic/TextManager");
    const { default: Menu } = await import("@menu/Menu");
    return { ais, aiTypes, TextManager, Menu };
}

/** One animal entry in LOAD_AI's layout. */
const entry = (sid: number, type: number, x: number, y: number, dir: number, health: number) => [sid, type, x, y, dir * 100, health, 0, 0];

describe("Animals", () => {
    it("places a newly seen animal at its real position, facing the right way", async () => {
        const { ais } = await setUp();
        game!.handlers.I(entry(7, COW, 1200, 1100, 1.5, 400), []);
        const ai = ais.get(7)!;

        // The real position stayed at (0, 0) until the next update, and the direction was 100× too big.
        expect(ai.real_position).toEqual({ x: 1200, y: 1100 });
        expect(ai.d2).toBeCloseTo(1.5);
        expect(ai.health).toBe(400);
        expect(ai.visible).toBe(true);
    });

    it("moves a known animal and hides the ones that left view", async () => {
        const { ais } = await setUp();
        game!.handlers.I([...entry(7, COW, 1200, 1100, 0, 500), ...entry(8, COW, 900, 900, 0, 500)], []);
        game!.handlers.I(entry(7, COW, 1250, 1100, 0.5, 480), [8]);

        expect(ais.get(7)!.real_position).toEqual({ x: 1250, y: 1100 });
        expect(ais.get(7)!.d2).toBeCloseTo(0.5);
        expect(ais.get(7)!.health).toBe(480);
        expect(ais.get(8)!.visible).toBe(false);
    });

    it("takes on the new type when the server reuses a sid for another animal", async () => {
        const { ais, aiTypes } = await setUp();
        game!.handlers.I([...entry(7, COW, 1200, 1100, 0, 500), ...entry(8, COW, 900, 900, 0, 500)], []);
        game!.handlers.I(entry(7, WOLF, 1300, 1300, 0, 300), []);
        const ai = ais.get(7)!;

        // The cow's size and damage used to stay.
        expect(ai.index).toBe(WOLF);
        expect(ai.scale).toBe(aiTypes[WOLF].scale);
        expect(ai.dmg).toBe(aiTypes[WOLF].dmg);
        expect(ai.real_position).toEqual({ x: 1300, y: 1300 });
        // Replaced in place: still one entry per sid, at the same list position.
        expect(ais.all.length).toBe(2);
        expect(ais.all[ai.listHandlerIndex]).toBe(ai);
    });

    it("skips an animal of unknown type and still reads the rest of the packet", async () => {
        const { ais } = await setUp();
        // This used to throw on the unknown type, losing the animal after it.
        game!.handlers.I([...entry(7, 99, 1200, 1100, 0, 500), ...entry(8, COW, 900, 900, 0, 500)], []);
        expect(ais.get(7)).toBeUndefined();
        expect(ais.get(8)!.real_position).toEqual({ x: 900, y: 900 });
    });

    it("shows no '0' text when an animal comes back into view with the same health (Stacked Text)", async () => {
        const { TextManager, Menu } = await setUp();
        Menu.setValue("stackedText", true);
        game!.handlers.I(entry(7, COW, 1200, 1100, 0, 500), []);
        game!.handlers.I([], [7]);
        TextManager.texts.clear();

        game!.handlers.I(entry(7, COW, 1200, 1100, 0, 500), []);
        expect(TextManager.texts.size).toBe(0);
        game!.handlers.I([], [7]);
        game!.handlers.I(entry(7, COW, 1200, 1100, 0, 450), []);
        expect(TextManager.texts.size).toBe(1);
    });
});
