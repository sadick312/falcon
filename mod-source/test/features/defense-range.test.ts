// Defense System, enemy melee reach and reload (DefenseSystem.isInRange, HealerUtils.isThreatReady): an enemy's
// ready melee weapon counts as a threat once we are within its range + 63 (a 35 player hitbox plus a margin for
// both of us moving this tick). These tests pin that edge and the reload rule, so a later change to either shows up.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;
const POLEARM = 5;
const KATANA = 4;
/** DefenseSystem.isInRange's HITBOX_OFFSET. */
const HITBOX_OFFSET = 63;

async function setup(enemyX: number, weaponIndex = POLEARM) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
    game.spawn({ sid: ENEMY, x: enemyX, y: 1000, weaponIndex });
    game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
    game.update();
    game.update();
    const { default: ModManager } = await import("@core/ModManager");
    return ModManager;
}

async function reach(weaponIndex: number) {
    const { getWeapon } = await import("@constants/items");
    return getWeapon(weaponIndex).range + HITBOX_OFFSET;
}

/** DefenseSystem.isInRange for the enemy's primary, standing still `dist` to our right. */
async function primaryInRange(dist: number, weapon: number) {
    await setup(1000 + dist, weapon);
    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    const { default: PlayerCombatManager } = await import("@core/logic/players/core/PlayerCombatManager");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const enemy = PlayerManager.get(ENEMY)!;
    const isInRange = (DefenseSystem as unknown as {
        isInRange: (p: unknown, e: unknown, w: unknown) => boolean;
    }).isInRange.bind(DefenseSystem);
    const result = isInRange(game!.Client.player, enemy, PlayerCombatManager.fetch(enemy, 0));
    game!.done();
    return result;
}

describe("enemy melee reach", () => {
    for (const [weapon, name] of [[POLEARM, "polearm"], [KATANA, "katana"]] as const) {
        it(`${name}: in reach just inside range + 63, not just outside`, async () => {
            const r = await reach(weapon);
            expect(await primaryInRange(r - 1, weapon)).toBe(true);
            expect(await primaryInRange(r + 2, weapon)).toBe(false);
        });
    }
});

describe("enemy reload", () => {
    it("a polearm that just swung isn't counted until it is (nearly) ready again", async () => {
        const ModManager = await setup(1100);
        expect(ModManager.brainState.sources).toContain("primaryDamage");

        game!.handlers.K(ENEMY, false, POLEARM);
        game!.update();
        expect(ModManager.brainState.sources).not.toContain("primaryDamage");

        // A polearm reloads in 700 ms (7 ticks); it counts again from 90% reloaded (Exact Threat Reload off).
        let ticks = 0;
        while (!ModManager.brainState.sources.includes("primaryDamage") && ticks < 12) {
            game!.update();
            ticks++;
        }
        expect(ticks).toBeGreaterThanOrEqual(5);
        expect(ticks).toBeLessThanOrEqual(7);
    });
});
