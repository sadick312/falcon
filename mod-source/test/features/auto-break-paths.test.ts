// Auto Break (AutoBreaker): the paths auto-break.test.ts doesn't reach. Shift keeps the swing on the trap, a swing
// that reaches two enemy spikes aims between them, the tick after a swing holds the soldier helmet without hitting,
// and a reloaded polearm enemy next to a spike we touch makes it keep the soldier helmet on instead of tank gear.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(async () => {
    const { Input } = await import("@ui/Input");
    delete Input.keys["ShiftLeft"];
    game?.done();
});

const POLEARM = 5;
const GREAT_HAMMER = 10;
const TANK_GEAR = 40;
const SOLDIER_HELMET = 6;
const ENEMY = 2;

interface Scenario {
    /** Enemy spikes around us, as [x, y] (we stand in a pit trap at 1000, 1000). */
    spikes?: [number, number][];
    shift?: boolean;
    /** Where the enemy stands (default far away). */
    enemyX?: number;
    /** We swung our hammer just before the checked tick. */
    justSwung?: boolean;
}

async function trapped(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: ["autoBreak"] });
    // Already holding the hammer, so the swing goes out this tick instead of after a weapon switch.
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: GREAT_HAMMER });
    game.spawn({ sid: ENEMY, x: s.enemyX ?? 1400, y: 1000, weaponIndex: POLEARM });
    game.setLoadout([POLEARM, GREAT_HAMMER], [0, 3, 6, 10, 15]);
    const objects = [{ sid: 600, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP as number, owner: ENEMY }];
    (s.spikes ?? []).forEach(([x, y], i) => objects.push({ sid: 700 + i, x, y, itemId: LIST_ID_MAP.SPIKES, owner: ENEMY }));
    game.addObjects(objects);
    game.update();

    if (s.shift) {
        const { Input } = await import("@ui/Input");
        Input.keys["ShiftLeft"] = true;
    }
    if (s.justSwung) game.handlers.K(ME, true, GREAT_HAMMER);

    const before = game.sent.length;
    game.update();
    const sent = game.sent.slice(before);
    const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
    const { default: AutoBreaker } = await import("@core/mod/defense/modules/AutoBreaker");
    return {
        tank: sent.some(p => p.type === "c" && p.args[1] === TANK_GEAR),
        soldier: sent.some(p => p.type === "c" && p.args[1] === SOLDIER_HELMET),
        // Falcon swings by holding auto-gather on (packet K); status says whether it is swinging after this tick.
        hit: CombatController.attackState.status,
        mode: CombatController.currentMode,
        mustBeSoldier: CombatController.mustBeSoldier,
        aim: AutoBreaker.aimAngle
    };
}

describe("Auto Break: other paths", () => {
    it("holding Shift breaks only the trap, even with an enemy spike next to us", async () => {
        const free = await trapped({ spikes: [[1000, 1085]] });
        expect(free.mode).toBe("autobreakspike");

        const shift = await trapped({ spikes: [[1000, 1085]], shift: true });
        expect(shift.mode).toBe("autobreak");
        expect(shift.tank).toBe(true);
        expect(shift.hit).toBe(true);
    });

    it("aims between two enemy spikes that one swing reaches", async () => {
        const { mode, aim } = await trapped({ spikes: [[1000, 1085], [1085, 1000]] });
        expect(mode).toBe("autobreakspike");
        // Straight down is 90 deg, straight right 0 deg: the midpoint is at 45 deg.
        expect(Math.cos(aim)).toBeCloseTo(Math.SQRT1_2, 1);
        expect(Math.sin(aim)).toBeCloseTo(Math.SQRT1_2, 1);
    });

    it("the tick after a swing keeps the soldier helmet and doesn't hit", async () => {
        const { tank, hit, mustBeSoldier, mode } = await trapped({ justSwung: true });
        expect(mode).toBe("autobreak");
        expect(hit).toBe(false);
        expect(tank).toBe(false);
        expect(mustBeSoldier).toBe(false);
    });

    it("keeps the soldier helmet instead of tank gear when a reloaded polearm enemy could knock us into a spike", async () => {
        // 80 from us: we touch it (spike size 49 + 36). At 85 we would only just not.
        const far = await trapped({ spikes: [[1000, 1080]] });
        expect(far.tank).toBe(true);
        expect(far.hit).toBe(true);

        const near = await trapped({ spikes: [[1000, 1080]], enemyX: 1150 });
        expect(near.tank).toBe(false);
        expect(near.mustBeSoldier).toBe(true);
        expect(near.hit).toBe(false);
    });
});
