// Combat/Defense/Ping Step 3: "Ping-Aware Defense" and "Don't Top Up Small Losses" (both Auto Healing sub-settings,
// default off). Fake game states, no real clock.
import { afterEach, describe, expect, it, vi } from "vitest";
import HealerUtils from "@core/mod/defense/utils/HealerUtils";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;
const POLEARM = 5;
const WOODEN_SHIELD = 11;

describe("isThreatReadyForPing", () => {
    it("off: exactly isThreatReady; on: also a weapon reloaded by the next tick", () => {
        // Polearm 700 ms: one tick adds ~16%.
        expect(HealerUtils.isThreatReadyForPing(0.85, false, 700, false)).toBe(false);
        expect(HealerUtils.isThreatReadyForPing(0.85, false, 700, true)).toBe(true);
        expect(HealerUtils.isThreatReadyForPing(0.5, false, 700, true)).toBe(false);
        expect(HealerUtils.isThreatReadyForPing(0.95, true, 700, false)).toBe(false);
        expect(HealerUtils.isThreatReadyForPing(0.95, true, 700, true)).toBe(true);
    });
});

/** Predicted damage for each of the 8 ticks after an enemy polearm swing next to us, at round trip `ping`. */
async function damagePerTick(enable: string[], ping: number) {
    game = await startGame({ enable: ["autoHeal", ...enable] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: ENEMY, x: 1120, y: 1000, weaponIndex: WOODEN_SHIELD });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
    game.update([{ sid: ENEMY, weaponIndex: POLEARM }]);

    const { default: PingTracker } = await import("@core/mod/utils/PingTracker");
    for (let i = 0; i < 5; i++) PingTracker.update(ping);
    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const enemy = PlayerManager.get(ENEMY)!;
    enemy.reloads[53] = 0;
    enemy.weaponData.lastTurretTickHit = game.tick + 100;

    let seen = 0;
    const respond = DefenseSystem.respond.bind(DefenseSystem);
    DefenseSystem.respond = () => { seen = DefenseSystem.state.totalDamage; respond(); };

    game.handlers.K(ENEMY, false, POLEARM);
    game.update();
    const damage: number[] = [];
    for (let i = 1; i <= 8; i++) {
        game.update();
        damage.push(Math.round(seen));
    }
    return damage;
}

describe("Ping-Aware Defense", () => {
    it("at 200 ms the polearm counts one tick earlier than off; every other tick is the same", async () => {
        const off = await damagePerTick([], 200);
        game!.done();
        const on = await damagePerTick(["pingAwareDefense"], 200);
        // A constant base (other threats) is there every tick; the polearm shows as the jump above it.
        const base = Math.min(...off);
        const firstOff = off.findIndex(d => d > base);
        const firstOn = on.findIndex(d => d > base);
        expect(firstOff).toBeGreaterThan(0);
        expect(firstOn).toBe(firstOff - 1);
        on.forEach((d, i) => { if (i !== firstOn) expect(d).toBe(off[i]); });
    });

    it("at 50 ms (round trip under a tick) nothing changes", async () => {
        const off = await damagePerTick([], 50);
        game!.done();
        expect(await damagePerTick(["pingAwareDefense"], 50)).toEqual(off);
    });
});

describe("Don't Top Up Small Losses", () => {
    async function topUp(enable: string[], health: number) {
        game = await startGame({ enable: ["autoHeal", ...enable] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.setLoadout([5], [0, 3, 6, 10, 15]); // food 0 = apple, heals 20
        game.update();
        game.Client.player.health = health;
        const before = game.sent.length;
        game.update();
        game.update();
        return game.sent.slice(before).filter(p => p.type === "z" && p.args[0] === 0 && p.args[1] === false).length;
    }

    it("off: eats at 95 HP (5 missing); on: doesn't", async () => {
        expect(await topUp([], 95)).toBeGreaterThan(0);
        game!.done();
        expect(await topUp(["noSmallTopUp"], 95)).toBe(0);
    });

    it("on: still eats when a whole food's worth is missing (75 HP)", async () => {
        expect(await topUp(["noSmallTopUp"], 75)).toBeGreaterThan(0);
    });

    it("both settings are off by default", async () => {
        vi.resetModules();
        const { defenseSettings } = await import("@menu/content/defense");
        type Item = { id: string; status?: unknown; settings?: Item[] };
        const find = (items: Item[], id: string): Item | undefined =>
            items.map(i => i.id === id ? i : find(i.settings ?? [], id)).find(Boolean);
        expect(find(defenseSettings as Item[], "pingAwareDefense")?.status).toBe(false);
        expect(find(defenseSettings as Item[], "noSmallTopUp")?.status).toBe(false);
    });
});
