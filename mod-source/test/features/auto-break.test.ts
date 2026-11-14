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

    // Breaker brief A3. "Always Pick Best Weapon" off, so nothing else picks a weapon once the trap is gone.
    async function breakThenFree(enable: string[]) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["autoBreak", ...enable], settings: { selectBestWeapon: false } });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1400, y: 1000 });
        game.setLoadout([5, GREAT_HAMMER], [0, 3, 6, 10, 15]);
        game.addObjects([{ sid: 600, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP as number, owner: 2 }]);
        game.update();
        game.update();
        expect(game.Client.weaponIndex).toBe(GREAT_HAMMER);
        game.handlers.Q(600); // the trap breaks
        for (let i = 0; i < 12; i++) game.update();
        return game.Client.weaponIndex;
    }

    it("off (classic): keeps holding the great hammer after the trap is gone", async () => {
        expect(await breakThenFree([])).toBe(GREAT_HAMMER);
    });

    it("Restore Weapon After Break: goes back to the weapon held before the trap", async () => {
        expect(await breakThenFree(["autoBreak:restoreWeapon"])).toBe(5);
    });

    // Breaker brief A4. "Has this spike already taken a full hit?" used a fixed 247.5 (a plain great hammer hit in tank
    // gear) even without a hammer. Katana only: a full hit is 40 × 3.3 = 132. The spike took 150 (more than one katana
    // hit); the trap is weaker, so the classic rule stays on the trap.
    async function katanaSpikeCase(enable: string[]) {
        const { LIST_ID_MAP } = await import("@constants/items");
        const KATANA = 4;
        game = await startGame({ enable: ["autoBreak", ...enable] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: KATANA });
        game.spawn({ sid: 2, x: 2400, y: 1000 });
        game.setLoadout([KATANA], [0, 3, 6, 15]);
        game.addObjects([
            { sid: 600, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP as number, owner: 2 },
            { sid: 700, x: 1000, y: 1085, itemId: LIST_ID_MAP.SPIKES, owner: 2 }
        ]);
        game.update();
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        const trap = ObjectManager.allObjects.find(o => o.sid === 600)!;
        const spike = ObjectManager.allObjects.find(o => o.sid === 700)!;
        trap.health = 100;
        spike.playerDamageDealt = 150;
        game.update();
        const { default: AutoBreaker } = await import("@core/mod/defense/modules/AutoBreaker");
        return Math.sin(AutoBreaker.aimAngle);
    }

    it("off (classic): katana only, a spike hit for 150 still counts as 'not a full hit' (247.5): stays on the trap", async () => {
        expect(await katanaSpikeCase([])).toBeLessThan(0.5);
    });

    it("Use Real Hit Damage: 150 is more than a full katana hit (132), so it finishes the spike", async () => {
        expect(await katanaSpikeCase(["autoBreak:realHitDamage"])).toBeGreaterThan(0.9);
    });

    // Breaker brief B1: "Mode: Manual" breaks only while G is held; "Auto" (default) always.
    async function trappedHolding(enable: string[], mode: number, holdG: boolean) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["autoBreak", ...enable], settings: { "autoBreak:mode": mode } });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1400, y: 1000 });
        game.setLoadout([5, GREAT_HAMMER], [0, 3, 6, 10, 15]);
        game.addObjects([{ sid: 600, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP as number, owner: 2 }]);
        const { Input } = await import("@ui/Input");
        if (holdG) Input.keys["KeyG"] = true;
        try {
            game.update();
            game.update();
        } finally {
            delete Input.keys["KeyG"];
        }
        const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
        return CombatController.currentMode;
    }

    it("Mode Auto (default): breaks without any key", async () => {
        expect(await trappedHolding([], 0, false)).toBe("autobreak");
    });

    it("Mode Manual: does nothing until G is held", async () => {
        expect(await trappedHolding([], 1, false)).not.toBe("autobreak");
    });

    it("Mode Manual: breaks while G is held", async () => {
        expect(await trappedHolding([], 1, true)).toBe("autobreak");
    });

    it("does nothing when off", async () => {
        const { held, tank } = await trapped({ enable: false });
        expect(held).not.toContain(GREAT_HAMMER);
        expect(tank).toBe(false);
    });
});
