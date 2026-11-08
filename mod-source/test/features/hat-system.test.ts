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

describe("Soldier + Angel Wings", () => {
    const ANGEL_WINGS = 13;
    const SHADOW_WINGS = 19;
    const MONKEY_TAIL = 11;

    interface Setup {
        enable?: boolean;
        health?: number;
        moving?: boolean;
        y?: number;
        enemyX?: number;
        notOwnedHat?: boolean;
        notOwnedWings?: boolean;
        before?: (g: Game) => Promise<void> | void;
    }

    /** One tick; returns the hat and the accessory we switched to (undefined when no switch was sent). */
    async function gear(s: Setup = {}) {
        game = await startGame({ enable: s.enable === false ? [] : ["soldierAngelWings"] });
        game.spawn({ sid: ME, x: 3000, y: s.y ?? 3000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: s.enemyX ?? 12000, y: s.y ?? 3000, weaponIndex: 5 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        const player = game.Client.player;
        if (s.notOwnedHat) delete player.skins[SOLDIER];
        if (s.notOwnedWings) delete player.tails[ANGEL_WINGS];
        game.setHealth(ME, s.health ?? 70);
        game.Client.lastMoveDir = s.moving === false ? null : 0;
        await s.before?.(game);

        // One hat or accessory change per tick: the hat goes first; the server then reports it worn, and the
        // accessory follows on the next tick.
        const store = (from: number) => game!.sent.slice(from).filter(p => p.type === "c" && p.args[0] === false);
        let from = game.sent.length;
        game.update();
        const hat = store(from).find(p => p.args[2] === false)?.args[1] as number | undefined;
        from = game.sent.length;
        game.update([{ sid: ME, skinIndex: hat ?? player.skinIndex }]);
        const wings = store(from).find(p => p.args[2] === true)?.args[1] as number | undefined;
        return { hat, wings };
    }

    it("wears Soldier Helmet with Angel Wings while hurt, even while moving", async () => {
        expect(await gear()).toEqual({ hat: SOLDIER, wings: ANGEL_WINGS });
    });

    it("also near an enemy, instead of Shadow Wings", async () => {
        expect(await gear({ enemyX: 3200 })).toEqual({ hat: SOLDIER, wings: ANGEL_WINGS });
    });

    it("also in the snow, instead of Winter Cap", async () => {
        expect((await gear({ y: 1000 })).hat).toBe(SOLDIER);
    });

    it("does nothing at full health", async () => {
        expect(await gear({ health: 100 })).toEqual({ hat: BOOSTER, wings: MONKEY_TAIL });
    });

    it("does nothing when off (the usual Booster Hat, Shadow Wings near an enemy)", async () => {
        expect((await gear({ enable: false })).hat).toBe(BOOSTER);
        expect((await gear({ enable: false, enemyX: 3200 })).wings).toBe(SHADOW_WINGS);
    });

    it("needs both: without Angel Wings or without Soldier Helmet it keeps the usual gear", async () => {
        expect(await gear({ notOwnedWings: true })).toEqual({ hat: BOOSTER, wings: MONKEY_TAIL });
        expect(await gear({ notOwnedHat: true })).toEqual({ hat: BOOSTER, wings: MONKEY_TAIL });
    });

    it("leaves the flipper hat on in the water", async () => {
        expect((await gear({ y: 7200 })).hat).toBe(FLIPPER);
    });

    it("goes back to Monkey Tail once healed", async () => {
        await gear();
        game!.setHealth(ME, 100);
        const before = game!.sent.length;
        game!.update([{ sid: ME, skinIndex: SOLDIER, tailIndex: ANGEL_WINGS }]);
        game!.update([{ sid: ME, skinIndex: BOOSTER, tailIndex: ANGEL_WINGS }]);
        const wings = game!.sent.slice(before).find(p => p.type === "c" && p.args[0] === false && p.args[2] === true)?.args[1];
        expect(wings).toBe(MONKEY_TAIL);
    });
});
