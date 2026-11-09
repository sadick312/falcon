import { getProjectile, getWeapon, WEAPON_ID_MAP } from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import CombatModule from "@core/mod/combat/utils/CombatModule";
import CombatUtils from "@core/mod/combat/utils/CombatUtils";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import DefenseUtils from "@core/mod/defense/utils/DefenseUtils";
import { tickState } from "@core/TickState";
import Menu from "@menu/Menu";
import { BULL_DAMAGE_MULT } from "@constants/world";

/** Soldier helmet's damage multiplier (1.8.2: dmgMult .75). */
const SOLDIER_MULT = 0.75;
/** Turret gear's own bullet (projectile 1). */
const TURRET_BULLET_DMG = getProjectile(1).dmg;
/** The musket's bullet. */
const MUSKET_DMG = getProjectile(getWeapon(WEAPON_ID_MAP.MUSKET).projectile!).dmg;

/**
 * Polearm + musket insta: bull helmet + polearm hit, then on the next tick turret gear + musket shot (the turret gear
 * fires its bullet too). Unlike Knockback Instakills, which waits for a knockback into spikes, this goes when the raw
 * damage kills the nearest enemy at its current health, assuming it has soldier helmet on for the second hit.
 * With the "Katana + musket" sub-toggle, katana works as the first hit too, with its own damage and reach.
 */
export default class MusketInstakiller extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        const attackAction = this.attackAction = AttackQueuePool.createAttackQueue();
        const [first, second] = attackAction.sequence;

        first.skinData[0] = STORE_HAT_MAP.BULL_HELMET;
        first.skinData[1] = false;
        first.wpnId = WEAPON_ID_MAP.POLEARM;
        first.aimType = "nearest";
        first.reason = second.reason = "musketInsta";

        second.skinData[0] = STORE_HAT_MAP.TURRET_GEAR;
        second.skinData[1] = false;
        second.wpnId = WEAPON_ID_MAP.MUSKET;
        second.aimType = "nearest";

        first.dontUse = second.dontUse = false;
        attackAction.cost = 3;
    }

    protected canExecute() {
        if (!Menu.getValue("musketInsta")) return false;
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        return !!tickState.enemyData.nearest;
    }

    /** The damage the combo deals to `enemy`: the bull melee hit plus the musket shot and turret bullet. */
    static comboDamage(meleeDmg: number, enemySkin: number) {
        const firstMult = enemySkin === STORE_HAT_MAP.SOLDIER_HELMET ? SOLDIER_MULT : 1;
        return meleeDmg * BULL_DAMAGE_MULT * firstMult + (MUSKET_DMG + TURRET_BULLET_DMG) * SOLDIER_MULT;
    }

    protected execute() {
        const player = Client.player;
        const enemy = tickState.enemyData.nearest!;
        const melee = player.weapons[0];

        if (player.weapons[1] !== WEAPON_ID_MAP.MUSKET) return;
        if (melee !== WEAPON_ID_MAP.POLEARM && !(melee === WEAPON_ID_MAP.KATANA && Menu.getValue("musketInsta:katana"))) return;
        if (!player.skins[STORE_HAT_MAP.BULL_HELMET] || !player.skins[STORE_HAT_MAP.TURRET_GEAR]) return;

        const primary = PlayerCombatManager.fetch(player, 0);
        const secondary = PlayerCombatManager.fetch(player, 1);
        if (primary.reload !== 1 || secondary.reload !== 1 || player.getReload(2) !== 1) return;

        if (!CombatUtils.getCombatDistance(player, enemy, getWeapon(melee).range - 1)) return;
        if (!DefenseUtils.isInLineOfSight(enemy, secondary)) return;
        if (MusketInstakiller.comboDamage(primary.dmg, enemy.skinIndex) < enemy.health) return;

        const attackAction = this.attackAction;
        attackAction.sequence[0].wpnId = melee;
        attackAction.grade = 2;
        AttackManager.addAttackQueue(attackAction);
    }

    override update() { }
}
