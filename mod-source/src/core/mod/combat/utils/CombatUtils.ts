import { getWeapon, WEAPON_ID_MAP } from "@constants/items";
import Player from "@entities/Player";
import { STORE_ACCESSORY_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import { PlayerSimulationState } from "@simulation/SimulationStates";
import lineInRect from "@utils/geometry/lineInRect";
import { MONKEY_TAIL_DAMAGE_MULT } from "@constants/hatNumbers";

export default class CombatUtils {
    static isAttackPrimary(id: number) {
        return WEAPON_ID_MAP.SHORT_SWORD === id || WEAPON_ID_MAP.KATANA === id || WEAPON_ID_MAP.POLEARM === id;
    }

    static isAntiBullablePrimary(id: number) {
        return WEAPON_ID_MAP.KATANA === id || WEAPON_ID_MAP.POLEARM === id;
    }

    static getMonkeyDamage(dmg: number, isProjectile: boolean = false) {
        if (isProjectile) return dmg;
        return dmg * (Client.player.tailIndex === STORE_ACCESSORY_MAP.MONKEY_TAIL ? MONKEY_TAIL_DAMAGE_MULT : 1);
    }

    static canTurretHit(victim: Player) {
        const player = Client.player;
        const closeObjects = ObjectManager.pool.closeObjects;

        for (let i = 0; i < closeObjects.length; i++) {
            const gameObject = closeObjects[i];
            if (gameObject === undefined) continue;
            const tmpScale = gameObject.getScale();

            if (gameObject.ignoreCollision) continue;
            if (1 > gameObject.layer) continue;

            if (lineInRect(
                gameObject.x - tmpScale, gameObject.y - tmpScale,
                gameObject.x + tmpScale, gameObject.y + tmpScale,
                player.real_position.x, player.real_position.y,
                victim.real_position.x, victim.real_position.y
            )) {
                return false;
            }
        }

        return true;
    }

    static getCombatDistance(a: Player | PlayerSimulationState, b: Player | PlayerSimulationState, range: number, useNextPosition?: boolean) {
        const HITBOX_OFFSET = 63;
        const totalRange = range + HITBOX_OFFSET;

        const posA = a instanceof Player ? useNextPosition ? a.next_position : a.real_position : a;
        const posB = b instanceof Player ? useNextPosition ? b.next_position : b.real_position : b;

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;

        return (dx * dx + dy * dy) <= (totalRange * totalRange);
    }

    static canAttack(victim: Player, attacker: Player, weaponId: number) {
        const range = getWeapon(weaponId).range;
        return this.getCombatDistance(attacker, victim, range);
    }
}