import Latency from "@core/mod/utils/Latency";
import items, { WEAPON_ID_MAP } from "@constants/items";
import Player from "@constants/Player";
import { STORE_ACCESSORY_MAP, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import MovementUtils from "@core/mod/defense/utils/MovementUtils";
import { Point } from "@mod-types/index";
import { PlayerSimulationState } from "@simulation/SimulationStates";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import lineInRect from "@utils/geometry/lineInRect";

export default class CombatUtils {
    /** Primaries worth fighting with (>= 35 dmg). Great Axe = Short Sword damage (35), so it counts too. */
    static isAttackPrimary(id: number) {
        return WEAPON_ID_MAP.SHORT_SWORD === id || WEAPON_ID_MAP.KATANA === id || WEAPON_ID_MAP.POLEARM === id || WEAPON_ID_MAP.GREAT_AXE === id;
    }

    static isAntiBullablePrimary(id: number) {
        return WEAPON_ID_MAP.KATANA === id || WEAPON_ID_MAP.POLEARM === id;
    }

    static getMonkeyDamage(dmg: number, isProjectile: boolean = false) {
        if (isProjectile) return dmg;
        return dmg * (Client.player.tailIndex === STORE_ACCESSORY_MAP.MONKEY_TAIL ? .2 : 1);
    }

    static canTurretHit(victim: Player) {
        const player = Client.player;
        const closeObjects = ObjectManager.pool.closeObjects;

        for (let i = 0; i < closeObjects.length; i++) {
            const gameObject = closeObjects[i];
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

    static projectKnockback(
        player: Player, source: Player,
        force: number, ignore: boolean = false,
        factorFriction: boolean = false
    ): Point | undefined {
        if (player.trap) return;

        const delta = ScriptConfig.SERVER_UPDATE_SPEED;
        const playerPos = player.real_position;
        const dir = getDir(playerPos, source.real_position);
        const totalForce = (Number(ignore) * .3) + force;
        const totalDelta = totalForce * delta;

        let accelX = Math.cos(dir) * totalDelta;
        let accelY = Math.sin(dir) * totalDelta;

        if (factorFriction) {
            const frictionMult = MovementUtils.getFrictionMult(accelX, accelY, delta);

            accelX *= frictionMult;
            accelY *= frictionMult;
        }

        return {
            x: playerPos.x + accelX,
            y: playerPos.y + accelY
        };
    }

    static soldierRound(player: Player, dmg: number) {
        return player.skinIndex === STORE_HAT_MAP.SOLDIER_HELMET ? dmg * .75 : dmg;
    }

    private static landingA = { x: 0, y: 0 };
    private static landingB = { x: 0, y: 0 };

    /**
     * Will `victim` be within `range` of `attacker` when an attack we send now lands on the server?
     * Uses both players' predicted positions ~RTT + half a tick ahead (Latency), so at high ping we
     * don't swing at enemies that will have walked out of range. Same hitbox rule as the server
     * (range + 35 * 1.8).
     */
    static inRangeWhenLanding(attacker: Player, victim: Player, range: number) {
        if (!Latency.isCompensationEnabled()) return this.getCombatDistance(attacker, victim, range);

        const lead = Latency.getActionLeadMs();
        Latency.predict(attacker, lead, this.landingA);
        Latency.predict(victim, lead, this.landingB);

        const dx = this.landingA.x - this.landingB.x;
        const dy = this.landingA.y - this.landingB.y;
        const total = range + 63;
        return dx * dx + dy * dy <= total * total;
    }

    static canAttack(victim: Player, attacker: Player, weaponId: number) {
        return this.inRangeWhenLanding(attacker, victim, items.weapons[weaponId].range);
    }
}