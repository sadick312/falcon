// Feature #28, Hat System (HatSystem): sends at most one hat or accessory change per tick. Hat, in order: the Defense
// System's forced soldier / EMP helmet, the current attack's hat, Combat Controller's hat (with soldier / EMP / bull tick
// / spike gear overrides), EMP against ranged instas, a bull tick, EMP against turrets, spike gear (Anti Bull),
// flipper hat in the river, soldier near an enemy, winter cap in the snow, booster hat while moving, else soldier after
// standing still for 2 ticks. A hat we don't own is never put on.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const SOLDIER = 6;
const BULL = 7;
const TANK_GEAR = 40;
const TURRET_GEAR = 53;
const BOOSTER = 12;
const WINTER_CAP = 15;
const FLIPPER = 31;
const RIVER_TOP = 7200 - 362; // 1.8.2: water from mapScale / 2 - riverWidth / 2

interface Scenario {
    y?: number;
    moving?: boolean;
    wearing?: number;
    notOwned?: number[];
}

/** One tick with no enemy around; returns the hat we switched to, or undefined. */
async function hat(s: Scenario = {}) {
    game = await startGame();
    game.spawn({ sid: ME, x: 3000, y: s.y ?? 3000, weaponIndex: 5, skinIndex: s.wearing ?? 0 });
    game.spawn({ sid: 2, x: 12000, y: 12000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();

    const player = game.Client.player;
    for (const id of s.notOwned ?? []) delete player.skins[id];
    game.Client.lastMoveDir = s.moving === false ? null : 0;

    const before = game.sent.length;
    game.update([{ sid: ME, skinIndex: s.wearing ?? 0 }]);
    const change = game.sent.slice(before).find(p => p.type === "c" && p.args[0] === false && p.args[2] === false);
    return change?.args[1] as number | undefined;
}

describe("Hat System", () => {
    it("wears booster hat while moving", async () => {
        expect(await hat()).toBe(BOOSTER);
    });

    it("wears winter cap in the snow", async () => {
        expect(await hat({ y: 2000 })).toBe(WINTER_CAP);
    });

    it("wears flipper hat anywhere in the river band, edges included", async () => {
        expect(await hat({ y: 7200 })).toBe(FLIPPER);
        // 1.8.2's water starts at 6838; Falcon used to wait until 6850.
        expect(await hat({ y: RIVER_TOP + 2 })).toBe(FLIPPER);
        expect(await hat({ y: RIVER_TOP - 2 })).toBe(BOOSTER);
    });

    it("doesn't switch again to the hat we already wear", async () => {
        expect(await hat({ wearing: BOOSTER })).toBeUndefined();
    });

    it("keeps the current hat when the one it wants isn't owned (P18)", async () => {
        // Wearing soldier helmet, moving, no booster hat: it used to switch to no hat at all.
        expect(await hat({ wearing: SOLDIER, notOwned: [BOOSTER] })).toBeUndefined();
    });

    it("still takes off bull helmet, tank gear or turret gear when the wanted hat isn't owned", async () => {
        for (const wearing of [BULL, TANK_GEAR, TURRET_GEAR]) {
            expect(await hat({ wearing, notOwned: [BOOSTER] }), String(wearing)).toBe(0);
        }
    });
});
