import GameObject from "@constants/GameObject";
import { getItem, getWeapon, Weapon } from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import CombatController from "@core/mod/combat/core/CombatController";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import { tickState } from "@core/TickState";
import Menu from "@menu/Menu";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import withinDist from "@utils/geometry/withinDist";
import { isCactusObject } from "@constants/world";
import { Input } from "@ui/Input";
import getDistSq from "@utils/geometry/getDistSq";
import { combatDebug, combatDebugOn } from "@utils/debug/combatDebug";

/** "Walk To Targets" stands down while an enemy player is this close (a fight is more important). */
const WALK_ENEMY_CLEARANCE = 300;

export default class ObjectBreaker {
    static gameObjectQueue: GameObject[] = [];

    static aimAngle = 0;
    static isObjectBreaking = false;
    private static targetObject = new GameObject(0, 0, 0, 0, 0, 0, 0);
    private static midPoint = { x: 0, y: 0 };
    private static inQueueObjects = new Set<number>();
    private static doubleHitIdBuffer: [number, boolean] = [0, false];

    static getDoubleHitId(originalId: number, originalGroup: 0 | 1 | 2, targetObject: GameObject): [number, boolean] {
        const player = Client.player;

        const primaryId = player.weapons[0] ?? NaN;
        const primaryIsNotBest = primaryId !== originalId;
        const primaryReloaded = player.getReload(0) === 1;
        const canBreakWithoutTank = BreakerUtils.getObjectDamage(player, 0, true) >= targetObject.health;
        const canBreakWithTank = BreakerUtils.getObjectDamage(player, 0) >= targetObject.health;
        const canAttack = BreakerUtils.getObjectAttackDistance(player, targetObject, getWeapon(primaryId).range - 1);
        const bestWeaponReloaded = player.getReload(originalGroup) === 1;
        const shouldDoubleHit = BreakerUtils.isDoubleHitPrimary(primaryId, targetObject.id);
        const canBreak = canBreakWithTank || canBreakWithoutTank;

        if (!bestWeaponReloaded && shouldDoubleHit && primaryIsNotBest && primaryReloaded && canBreak && canAttack) {
            this.doubleHitIdBuffer[0] = primaryId;
            this.doubleHitIdBuffer[1] = canBreakWithTank && !canBreakWithoutTank;
            return this.doubleHitIdBuffer;
        }

        this.doubleHitIdBuffer[0] = originalId;
        this.doubleHitIdBuffer[1] = false;
        return this.doubleHitIdBuffer;
    }

    private static processPitSpikeModule(wpn: Weapon) {
        if (!Menu.getValue("objectBreaker:pit_spike")) return;

        this.isObjectBreaking = false;
        const player = Client.player;
        const closeObjects = ObjectManager.pool.closeObjects;
        const nearestEnemy = tickState.enemyData.nearest;
        const enemyInTrap = nearestEnemy && nearestEnemy.trap;

        if (!enemyInTrap) return;
        const enemyTrap = nearestEnemy.trap!;
        const trapDir = getDir(enemyTrap, player.real_position);

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            if (gameObject === undefined) continue;

            const isSpike = gameObject.dmg && !Client.isTeam(nearestEnemy, gameObject.ownerSID ?? -1);
            const isCactus = isCactusObject(gameObject);
            const isWithinRange = withinDist(enemyTrap, gameObject, AutoPusher.AUTO_PUSH_DISTANCE + gameObject.scale);

            if (!isSpike && !isCactus) continue;
            if (!isWithinRange) continue;
            return;
        }

        const canAttackTrap = BreakerUtils.getObjectAttackDistance(player, enemyTrap, wpn.range - 1);

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            if (gameObject === undefined) continue;
            const isNearEnemyTrap = withinDist(enemyTrap, gameObject, 75 + gameObject.scale);
            const isNotEnemyTrap = gameObject !== enemyTrap;
            const canAttack = BreakerUtils.getObjectAttackDistance(player, gameObject, wpn.range - 1);
            const isSpike = gameObject.dmg && !Client.isTeam(nearestEnemy, gameObject.ownerSID ?? -1);

            if (withinDist(gameObject, player.real_position, 30 + gameObject.scale)) continue;
            if (withinDist(gameObject, player.next_position, 30 + gameObject.scale)) continue;
            if (isSpike) continue;
            if (!canAttack) continue;
            if (!gameObject.hasHealth || !isFinite(gameObject.health) || isNaN(gameObject.health)) continue;
            if (!isNearEnemyTrap || !isNotEnemyTrap) continue;
            if (this.inQueueObjects.has(gameObject.sid)) continue;

            const withinArc = getAngleDist(trapDir, getDir(gameObject, player.real_position)) <= ScriptConfig.GATHER_ANGLE;
            if (canAttackTrap && withinArc) continue;

            this.gameObjectQueue.push(gameObject);
        }
    }

    /** The building being hit this tick (for the target marker), or null. */
    static currentTarget: GameObject | null = null;
    /** "Detection Range": the enemy building seen but out of reach (spikes first, then the closest), when nothing is in reach. */
    static farTarget: GameObject | null = null;
    /** "Walk To Targets": the direction to walk towards `farTarget`, or null. Read by MovementManager.getMoveDir. */
    static walkDir: number | null = null;

    /**
     * "Closest First" order: spikes before other buildings, then the closest, then the lowest health.
     * (The classic order: spikes first, newest spike first; others in the order the objects were stored.)
     */
    static compareClosestFirst(a: GameObject, b: GameObject, from: { x: number; y: number }) {
        const spikeA = a.dmg ? 0 : 1;
        const spikeB = b.dmg ? 0 : 1;
        if (spikeA !== spikeB) return spikeA - spikeB;
        const dist = getDistSq(a, from) - getDistSq(b, from);
        if (dist !== 0) return dist;
        return a.health - b.health;
    }

    /**
     * Nothing in reach, but an enemy building in "Detection Range": with "Walk To Targets", walk to it. Only while we
     * aren't steering ourselves (no movement keys, no Shift) and no enemy player is near.
     */
    private static handleFarTarget(playerPos: { x: number; y: number }, range: number) {
        const far = this.farTarget;
        if (!far) return;

        if (combatDebugOn()) {
            combatDebug("breaker", {
                seen: getItem(far.id).name,
                sid: far.sid,
                dist: Math.sqrt(getDistSq(far, playerPos)),
                reach: range - 1 + far.scale
            });
        }

        if (!Menu.getValue("walkBreaker:walkToTarget")) return;
        if (Client.lastMoveDir !== null && Client.lastMoveDir !== undefined) return;
        if (Input.keys["ShiftLeft"]) return;
        const enemy = tickState.enemyData.nearest;
        if (enemy && withinDist(enemy.real_position, playerPos, WALK_ENEMY_CLEARANCE)) return;

        this.walkDir = getDir(far, playerPos);
    }

    /** Clears this tick's targets when the breaker doesn't run (CombatController returned before it). */
    static resetTick() {
        this.currentTarget = null;
        this.farTarget = null;
        this.walkDir = null;
    }

    static main(): boolean {
        this.currentTarget = null;
        this.farTarget = null;
        this.walkDir = null;
        if (!Menu.getValue("walkBreaker")) return false;

        const player = Client.player;
        const playerPos = player.real_position;
        const bestWpnId = CombatController.bestWeaponForBreak();
        const closeObjects = ObjectManager.pool.closeObjects;

        const wpn = getWeapon(bestWpnId);
        this.inQueueObjects.clear();

        // 0 (the default) = classic: only buildings already in reach are looked at.
        const detectExtra = Number(Menu.getValue("walkBreaker:detectRange")) || 0;

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            if (gameObject === undefined) continue;

            const isSpike = gameObject.dmg;
            const isTeleport = gameObject.teleport;
            const isBoost = gameObject.boostSpeed;
            const isTrap = gameObject.trap;
            const isNotFriendly = !Client.isFriendly(gameObject.ownerSID ?? -1);

            const isTarget = isSpike || isTeleport || isBoost || isTrap;
            const canAttack = BreakerUtils.getObjectAttackDistance(player, gameObject, wpn.range - 1);

            if (isTarget && isNotFriendly && canAttack) {
                this.inQueueObjects.add(gameObject.sid);

                if (isSpike) {
                    this.gameObjectQueue.unshift(gameObject);
                } else {
                    this.gameObjectQueue.push(gameObject);
                }
            } else if (isTarget && isNotFriendly && detectExtra > 0 && gameObject.hasHealth &&
                BreakerUtils.getObjectAttackDistance(player, gameObject, wpn.range - 1 + detectExtra)) {
                // Spikes first, then the closest, then the lowest health (the Closest First order).
                if (this.farTarget === null || this.compareClosestFirst(gameObject, this.farTarget, playerPos) < 0) {
                    this.farTarget = gameObject;
                }
            }
        }

        if (this.gameObjectQueue.length > 1 && Menu.getValue("walkBreaker:closestFirst")) {
            this.gameObjectQueue.sort((a, b) => this.compareClosestFirst(a, b, playerPos));
        }

        this.isObjectBreaking = true;
        if (!this.gameObjectQueue.length && player.getReload(0) === 1) this.processPitSpikeModule(wpn);
        if (!this.gameObjectQueue.length) {
            this.handleFarTarget(playerPos, wpn.range);
            return false;
        }
        this.farTarget = null;

        const currentTarget = this.gameObjectQueue[0];
        if (!currentTarget) return false;
        this.currentTarget = currentTarget;

        if (combatDebugOn()) {
            combatDebug("breaker", {
                target: getItem(currentTarget.id).name,
                sid: currentTarget.sid,
                dist: Math.sqrt(getDistSq(currentTarget, playerPos)),
                reach: wpn.range - 1 + currentTarget.scale,
                health: currentTarget.health,
                reload: player.getReload(bestWpnId < 9 ? 0 : 1)
            });
        }
        const toTarget = getDir(currentTarget, playerPos);

        this.targetObject.x = currentTarget.x;
        this.targetObject.y = currentTarget.y;
        // getDoubleHitId reads the id (Poison Spikes rule); it was never copied, so it stayed 0.
        this.targetObject.id = currentTarget.id;
        this.targetObject.dmg = currentTarget.dmg;
        this.targetObject.scale = currentTarget.scale;
        this.targetObject.health = currentTarget.health;

        const midPoint = this.midPoint;

        for (let i = 1, len = this.gameObjectQueue.length; i < len; i++) {
            const otherTarget = this.gameObjectQueue[i];
            if (otherTarget === undefined) continue;
            const toOther = getDir(otherTarget, playerPos);

            midPoint.x = (currentTarget.x + otherTarget.x) / 2;
            midPoint.y = (currentTarget.y + otherTarget.y) / 2;

            const toMidpoint = getDir(midPoint, playerPos);
            const canAttackCurrent = getAngleDist(toMidpoint, toTarget) <= ScriptConfig.GATHER_ANGLE;
            const canAttackOther = getAngleDist(toMidpoint, toOther) <= ScriptConfig.GATHER_ANGLE;

            if (otherTarget && canAttackCurrent && canAttackOther) {
                this.targetObject.x = midPoint.x;
                this.targetObject.y = midPoint.y;
                this.targetObject.scale = Math.min(currentTarget.scale, otherTarget.scale);
                this.targetObject.health = Math.max(currentTarget.health, otherTarget.health);
                break;
            }
        }

        const bestWpnGroup = CombatController.bestWeaponForBreak("group");
        const buf = ObjectBreaker.getDoubleHitId(bestWpnId, bestWpnGroup, this.targetObject);
        const id = buf[0];
        const twoHitRequireTank = buf[1];

        CombatController.selectWeapon(id, true);
        if (player.getReload(id < 9 ? 0 : 1) === 1) {
            CombatController.skinIndex = bestWpnId === id || twoHitRequireTank ? STORE_HAT_MAP.TANK_GEAR : STORE_HAT_MAP.SOLDIER_HELMET;
            this.aimAngle = getDir(this.targetObject, player.real_position);
            CombatController.hitOnce();
        }

        return true;
    }
}