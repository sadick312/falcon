// Defense brief, D5 "Exact Threat Reload" (Auto Healing sub-setting, default off). The Defense System counts an enemy
// weapon's damage for the next server tick once it is 90%+ reloaded. Falcon sees a weapon ready (reload 1) on the
// last tick before the server lets it swing (test/features/reload-timing.test.ts), so the exact rule is "reloaded
// now". A polearm (700 ms, ~16% per tick) is 95% reloaded the tick before that, so today it counts a tick early.
import { afterEach, describe, expect, it } from "vitest";
import HealerUtils from "@core/mod/defense/utils/HealerUtils";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;
const POLEARM = 5;
const WOODEN_SHIELD = 11;

describe("isThreatReady", () => {
    it("default: 90% and up; exact: only fully reloaded", () => {
        expect(HealerUtils.isThreatReady(0.95, false)).toBe(true);
        expect(HealerUtils.isThreatReady(0.85, false)).toBe(false);
        expect(HealerUtils.isThreatReady(0.95, true)).toBe(false);
        expect(HealerUtils.isThreatReady(1, true)).toBe(true);
    });
});

describe("predicted damage after an enemy polearm swing", () => {
    /** Expected damage for the next tick, for each of the 8 ticks after an enemy polearm swing next to us. */
    async function damagePerTick(enable: string[]) {
        game = await startGame({ enable: ["autoHeal", ...enable] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        // A shield as their seen secondary (no damage), so only the polearm counts.
        game.spawn({ sid: ENEMY, x: 1120, y: 1000, weaponIndex: WOODEN_SHIELD });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        game.update([{ sid: ENEMY, weaponIndex: POLEARM }]);

        const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        const enemy = PlayerManager.get(ENEMY)!;
        enemy.reloads[53] = 0; // their turret just fired: no turret damage in these ticks
        enemy.weaponData.lastTurretTickHit = game.tick + 100;

        // The total is cleared at the end of each tick (conclude), so read it in the middle, when respond() runs.
        let seen = 0;
        const respond = DefenseSystem.respond.bind(DefenseSystem);
        DefenseSystem.respond = () => { seen = DefenseSystem.state.totalDamage; respond(); };

        game.handlers.K(ENEMY, false, POLEARM); // the swing
        game.update();
        const damage: number[] = [];
        for (let i = 1; i <= 8; i++) {
            game.update();
            damage.push(Math.round(seen));
        }
        return { damage };
    }

    it("on, the polearm stops being counted on tick 6 (95% reloaded, can't hit yet); every other tick is the same", async () => {
        const off = (await damagePerTick([])).damage;
        game!.done();
        const on = (await damagePerTick(["exactThreatReload"])).damage;

        const differs = off.map((d, i) => d !== on[i] ? i + 1 : 0).filter(Boolean);
        expect(differs, `off ${JSON.stringify(off)} on ${JSON.stringify(on)}`).toEqual([6]);
        // The difference is the polearm's bull-helmet hit (45 x 1.5), at least.
        expect((off[5] ?? 0) - (on[5] ?? 0)).toBeGreaterThanOrEqual(67);
        // From tick 7 (ready: its hit can land next tick) both count it.
        expect(on[6]).toBe(off[6]);
    });
});
