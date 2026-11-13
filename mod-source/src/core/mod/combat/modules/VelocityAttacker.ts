import CombatModule from "@combat-utils/CombatModule";
import CombatUtils from "@combat-utils/CombatUtils";
import { getWeapon } from "@constants/items";
import { STORE_ACCESSORY_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import { tickState } from "@core/TickState";
import Menu from "@menu/Menu";
import withinDist from "@utils/geometry/withinDist";
import { BULL_DAMAGE_MULT } from "@constants/world";

export default class VelocityAttacker extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.grade = 2;
        attackAction.cost = 1;
    }

    protected canExecute() {
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!tickState.enemyData.nearest) return false;
        if (!Menu.getValue("velocityHits")) return false;
        if (Client.player.tailIndex === STORE_ACCESSORY_MAP.MONKEY_TAIL) return false;
        if (DefenseSystem.canPlaceOnMe) return false;
        if (AutoBreaker.allSpikesBuffer.length) return false;
        return true;
    }

    protected execute() {
        const player = Client.player;
        const enemy = tickState.enemyData.nearest!;
        const allSpikes = ObjectManager.pool.allSpikes;
        const primary = PlayerCombatManager.fetch(player, 0);

        // Only when we update first; when the order is unknown (fake tick), wait for a real one.
        if (PlayerStateManager.updatesBefore(player.sid, enemy.sid) !== true) return;
        if (!CombatUtils.isAttackPrimary(primary.id)) return;
        if (!CombatUtils.getCombatDistance(player, enemy, getWeapon(primary.id).range)) return;
        if (enemy.trap) return;
        if (primary.reload !== 1) return;

        let damage = primary.dmg * BULL_DAMAGE_MULT;
        for (let i = 0, len = allSpikes.length; i < len; i++) {
            const gameObj = allSpikes[i];
            if (!gameObj) continue;

            const isDamagable = !Client.isTeam(enemy, gameObj.ownerSID ?? -1);
            if (!isDamagable) continue;
            if (!withinDist(enemy.next_position, gameObj, gameObj.scale + 34)) continue;

            damage += gameObj.dmg || 35;
            break;
        }

        if (!CombatUtils.syncHitKills(enemy, damage)) return;
        const attackAction = this.attackAction;
        AttackManager.prepareBullHitSequence(attackAction.sequence, "velBullHit");
        AttackManager.addAttackQueue(attackAction);
    }
}