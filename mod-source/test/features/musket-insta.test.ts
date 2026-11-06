// Musket Insta (MusketInstakiller): with polearm + musket, bull helmet + polearm hit, then turret gear + musket shot on
// the next tick, when that damage kills the nearest enemy at its current health (soldier helmet assumed for the shot).
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const POLEARM = 5;
const MUSKET = 15;
const BULL = 7;
const TURRET_GEAR = 53;

interface Scenario {
    enable?: boolean;
    weapons?: number[];
    enemyX?: number;
    enemyHealth?: number;
    wall?: boolean;
}

/** Returns the queued musket-insta combo as [weapon, hat] steps, or null. */
async function play(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["musketInsta"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
    game.spawn({ sid: 2, x: s.enemyX ?? 1150, y: 1000, weaponIndex: POLEARM });
    game.setLoadout(s.weapons ?? [POLEARM, MUSKET], [0, 3, 6, 10, 15]);
    if (s.wall) game.addObjects([{ sid: 700, x: 1075, y: 1000, itemId: LIST_ID_MAP.WOOD_WALL, owner: 2 }]);

    // Listen from the first tick: the combo goes as soon as everything is ready.
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    let combo: [number, number][] | null = null;
    vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(action => {
        if (action.sequence[0].reason === "musketInsta") combo ??= action.sequence.map(a => [a.wpnId, a.skinData[0]]);
    });
    game.update();
    if (s.enemyHealth !== undefined) game.setHealth(2, s.enemyHealth);
    game.update();
    game.update();
    return combo;
}

describe("Musket Insta", () => {
    it("bull polearm, then turret gear musket, when it kills", async () => {
        expect(await play()).toEqual([[POLEARM, BULL], [MUSKET, TURRET_GEAR]]);
    });

    it("does nothing when off, without polearm + musket, out of polearm reach, or behind a wall", async () => {
        expect(await play({ enable: false })).toBeNull();
        expect(await play({ weapons: [POLEARM, 9] })).toBeNull();
        expect(await play({ enemyX: 1400 })).toBeNull();
        expect(await play({ wall: true })).toBeNull();
    });

    it("counts the musket shot and turret bullet at soldier helmet's 0.75", async () => {
        game = await startGame();
        const { default: MusketInstakiller } = await import("@core/mod/combat/modules/MusketInstakiller");
        // Stone polearm 45 × 1.5 bull + (musket 50 + turret 25) × 0.75.
        expect(MusketInstakiller.comboDamage(45, 0)).toBeCloseTo(67.5 + 56.25);
        // An enemy already in soldier helmet takes 0.75 of the polearm hit too.
        expect(MusketInstakiller.comboDamage(45, 6)).toBeCloseTo(67.5 * 0.75 + 56.25);
    });
});
