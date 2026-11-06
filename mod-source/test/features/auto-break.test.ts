// Feature #30, Auto Break (AutoBreaker, BreakerUtils): while we're in an enemy pit trap, holds the best breaking
// weapon and hits the trap with tank gear (soldier helmet when a one-shot is possible and we'd touch a spike). It goes
// for a nearby enemy spike first when that breaks sooner or the enemy can't put the trap back (Shift: only the trap).
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const GREAT_HAMMER = 10;
const TANK_GEAR = 40;

interface Scenario {
    enable?: boolean;
    spike?: boolean;
}

/** We stand in an enemy pit trap at (1000, 1000), the enemy far away; returns what we did on the checked tick. */
async function trapped(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["autoBreak"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1400, y: 1000 });
    game.setLoadout([5, GREAT_HAMMER], [0, 3, 6, 10, 15]);
    const objects = [{ sid: 600, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP as number, owner: 2 }];
    if (s.spike) objects.push({ sid: 700, x: 1000, y: 1085, itemId: LIST_ID_MAP.SPIKES, owner: 2 });
    game.addObjects(objects);
    game.update();

    const before = game.sent.length;
    game.update();
    const sent = game.sent.slice(before);
    const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
    const { default: AutoBreaker } = await import("@core/mod/defense/modules/AutoBreaker");
    return {
        held: sent.filter(p => p.type === "z" && p.args[1] === true).map(p => p.args[0]),
        tank: sent.some(p => p.type === "c" && p.args[1] === TANK_GEAR),
        mode: CombatController.currentMode,
        aim: AutoBreaker.aimAngle
    };
}

describe("Auto Break", () => {
    it("hits the trap with the great hammer in tank gear", async () => {
        const { held, tank, mode } = await trapped();
        expect(held).toContain(GREAT_HAMMER);
        expect(tank).toBe(true);
        expect(mode).toBe("autobreak");
    });

    it("goes for an enemy spike next to us, and says so", async () => {
        const { mode, aim } = await trapped({ spike: true });
        // Aiming down at the spike; the mode used to stay "autobreak" because the target's dmg was never updated.
        expect(Math.sin(aim)).toBeGreaterThan(0.9);
        expect(mode).toBe("autobreakspike");
    });

    it("does nothing when off", async () => {
        const { held, tank } = await trapped({ enable: false });
        expect(held).not.toContain(GREAT_HAMMER);
        expect(tank).toBe(false);
    });
});
