import items from "@constants/items";
import Client from "@core/Client";
import AttackManager from "@core/mod/combat/core/AttackManager";
import CombatController from "@core/mod/combat/core/CombatController";
import CombatUtils from "@core/mod/combat/utils/CombatUtils";
import ModManager from "@core/ModManager";
import { tickState } from "@core/TickState";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";

export default class WingsUtils {
    /**
     * Whether we swing a melee weapon this tick and it reaches an enemy in the swing's arc. 1.8.2 heals with healD
     * (Blood Wings 0.2) only on melee hits on players (in the gather code), not on projectiles or buildings.
     * Valid after the Combat Controller has run (the Hat System and Auto Heal run later in the tick).
     */
    static willHitPlayer() {
        const player = Client.player;
        const action = AttackManager.currentAttackAction;
        const swinging = action ? !action.noAttack : CombatController.attackState.confirm;
        if (!swinging) return false;

        const weaponId = action ? action.wpnId : Client.weaponIndex;
        const weapon = items.weapons[weaponId];
        if (!weapon || weapon.projectile !== undefined) return false;
        if (player.reloads[weaponId] !== 1) return false;

        const aim = ModManager.getAttackDir();
        const nearby = tickState.enemyData.nearby;

        for (let i = 0, len = nearby.length; i < len; i++) {
            const enemy = nearby[i];
            if (!CombatUtils.canAttack(enemy, player, weaponId)) continue;
            if (getAngleDist(getDir(enemy.real_position, player.real_position), aim) <= ScriptConfig.GATHER_ANGLE) return true;
        }

        return false;
    }
}
