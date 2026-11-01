// Feature #25, Combat helpers (CombatUtils, CombatModule): which primaries count as attack weapons, Monkey Tail's
// damage cut, melee reach, and whether a turret-gear shot reaches an enemy. The numbers are checked against 1.8.2's
// game code: a melee hit lands when distance - 35 * 1.8 <= range; Monkey Tail has dmgMultO .2; a projectile is stopped
// by objects whose layer is at least its own, and the turret gear's shot (projectile 1) has layer 1.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp(enemyX = 1300) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: enemyX, y: 1000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
    const { default: CombatUtils } = await import("@combat-utils/CombatUtils");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { LIST_ID_MAP, WEAPON_ID_MAP, default: items } = await import("@constants/items");
    return { CombatUtils, enemy: PlayerManager.get(2)!, LIST_ID_MAP, WEAPON_ID_MAP, items };
}

describe("Combat helpers", () => {
    it("count short sword, katana and polearm as attack primaries", async () => {
        const { CombatUtils, WEAPON_ID_MAP } = await setUp();
        expect(CombatUtils.isAttackPrimary(WEAPON_ID_MAP.POLEARM)).toBe(true);
        expect(CombatUtils.isAttackPrimary(WEAPON_ID_MAP.KATANA)).toBe(true);
        expect(CombatUtils.isAttackPrimary(WEAPON_ID_MAP.SHORT_SWORD)).toBe(true);
        expect(CombatUtils.isAttackPrimary(WEAPON_ID_MAP.DAGGERS)).toBe(false);
        expect(CombatUtils.isAntiBullablePrimary(WEAPON_ID_MAP.SHORT_SWORD)).toBe(false);
    });

    it("cut melee damage to a fifth with Monkey Tail, but not projectile damage", async () => {
        const { CombatUtils } = await setUp();
        const { STORE_ACCESSORY_MAP } = await import("@constants/store");
        expect(CombatUtils.getMonkeyDamage(50)).toBe(50);
        game!.Client.player.tailIndex = STORE_ACCESSORY_MAP.MONKEY_TAIL;
        expect(CombatUtils.getMonkeyDamage(50)).toBe(10);
        expect(CombatUtils.getMonkeyDamage(50, true)).toBe(50);
    });

    it("reach an enemy within the weapon's range + 63", async () => {
        const { WEAPON_ID_MAP, default: items } = await import("@constants/items");
        const range = items.weapons[WEAPON_ID_MAP.POLEARM].range;
        const near = await setUp(1000 + range + 63);
        expect(near.CombatUtils.canAttack(near.enemy, game!.Client.player, WEAPON_ID_MAP.POLEARM)).toBe(true);
        const far = await setUp(1000 + range + 64);
        expect(far.CombatUtils.canAttack(far.enemy, game!.Client.player, WEAPON_ID_MAP.POLEARM)).toBe(false);
    });

    it("let a turret shot through walls and spikes, but not windmills", async () => {
        const open = await setUp();
        expect(open.CombatUtils.canTurretHit(open.enemy)).toBe(true);

        for (const [itemId, blocks] of [["WOOD_WALL", false], ["SPIKES", false], ["WINDMILL", true]] as const) {
            const s = await setUp();
            game!.addObjects([{ sid: 800, x: 1150, y: 1000, itemId: s.LIST_ID_MAP[itemId], owner: 2 }]);
            game!.update();
            expect(s.CombatUtils.canTurretHit(s.enemy), itemId).toBe(!blocks);
        }
    });
});
