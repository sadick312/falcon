// "Sync Hits Use Enemy Health" (Combat > Combat Modules, off by default): Velocity Hits and Projectile Sync decide
// "does it kill" against the enemy's current health and the hat they wear (Soldier Helmet takes 0.75 of the damage),
// not against a fixed 100. Off: the classic 100.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const SOLDIER_HELMET = 6;
const BULL_HELMET = 7;

interface Scenario {
    on?: boolean;
    enemyHealth?: number;
    enemySkin?: number;
    spike?: "SPIKES" | "GREATER_SPIKES";
}

/** Velocity Hits: polearm bull hit (67.5) on an enemy next to our spike; returns how many attacks it queued. */
async function velocityHit(s: Scenario) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: ["velocityHits", ...(s.on ? ["syncHitsUseHealth"] : [])] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1110, y: 1000, skinIndex: s.enemySkin ?? 0 });
    game.setLoadout([5], [0, 3, 6, 10]);
    game.addObjects([{ sid: 500, x: 1180, y: 1000, itemId: LIST_ID_MAP[s.spike ?? "SPIKES"], owner: ME }]);
    for (let i = 0; i < 3; i++) game.update();
    if (s.enemyHealth !== undefined) game.setHealth(2, s.enemyHealth);

    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: VelocityAttacker } = await import("@combat-modules/VelocityAttacker");
    const module = new VelocityAttacker();
    module.init();
    DefenseSystem.canPlaceOnMe = false;
    const queued = vi.spyOn(AttackManager, "addAttackQueue");
    module.run();
    return queued.mock.calls.length;
}

/** Projectile Sync: polearm bull hit (67.5) as an arrow (25) reaches the enemy; returns the ticks a bull helmet went on. */
async function projectileSync(s: Scenario) {
    const { default: items } = await import("@constants/items");
    game = await startGame({ enable: ["projectileSync", ...(s.on ? ["syncHitsUseHealth"] : [])] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1100, y: 1000, skinIndex: s.enemySkin ?? 0 });
    game.spawn({ sid: 3, x: 1600, y: 1000, weaponIndex: 15 });
    game.setLoadout([5], [0, 3, 6, 10]);
    game.update();
    if (s.enemyHealth !== undefined) game.setHealth(2, s.enemyHealth);
    const arrow = items.projectiles[0]!;
    game.handlers.X(1500, 1000, Math.PI, arrow.range, arrow.speed, 0, 0, 900);
    for (let i = 0; i < 3; i++) game.update();
    return game.sent.filter(p => p.type === "c" && p.args[1] === BULL_HELMET).map(p => p.tick);
}

describe("Sync Hits Use Enemy Health: Velocity Hits", () => {
    it("off (classic): 67.5 + a spike's 20 is short of 100, even against a hurt enemy", async () => {
        expect(await velocityHit({ enemyHealth: 80 })).toBe(0);
    });

    it("on: hits a hurt enemy the 87.5 kills", async () => {
        expect(await velocityHit({ on: true, enemyHealth: 80 })).toBe(1);
        expect(await velocityHit({ on: true, enemyHealth: 90 })).toBe(0);
    });

    it("on: holds back against a Soldier Helmet the hit can't kill (classic would still hit)", async () => {
        // 67.5 + 35 (greater spike) = 102.5, × 0.75 = 76.9 < 100.
        expect(await velocityHit({ spike: "GREATER_SPIKES", enemySkin: SOLDIER_HELMET })).toBe(1);
        expect(await velocityHit({ on: true, spike: "GREATER_SPIKES", enemySkin: SOLDIER_HELMET })).toBe(0);
        expect(await velocityHit({ on: true, spike: "GREATER_SPIKES" })).toBe(1);
    });
});

describe("Sync Hits Use Enemy Health: Projectile Sync", () => {
    it("off (classic): 67.5 + an arrow's 25 is short of 100, even against a hurt enemy", async () => {
        expect(await projectileSync({ enemyHealth: 90 })).toEqual([]);
    });

    it("on: bull-hits a hurt enemy the 92.5 kills", async () => {
        expect((await projectileSync({ on: true, enemyHealth: 90 })).length).toBe(1);
        expect(await projectileSync({ on: true, enemyHealth: 90, enemySkin: SOLDIER_HELMET })).toEqual([]);
    });

    it("is off by default", async () => {
        vi.resetModules();
        const { combatSettings } = await import("@menu/content/combat");
        type Item = { id: string; status?: unknown; settings?: Item[] };
        const find = (items: Item[], id: string): Item | undefined =>
            items.map(i => i.id === id ? i : find(i.settings ?? [], id)).find(Boolean);
        expect(find(combatSettings as Item[], "syncHitsUseHealth")?.status).toBe(false);
    });
});
