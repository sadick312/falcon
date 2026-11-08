import CombatUtils from "@combat-utils/CombatUtils";
import GameObject from "@constants/GameObject";
import items, { WEAPON_ID_MAP } from "@constants/items";
import Player from "@entities/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerPlacementManager from "@core/logic/players/core/PlayerPlacementManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import PotentialObjectManager, { PotentialObject } from "@core/logic/PotentialObjectManager";
import ProjectileManager from "@core/logic/ProjectileManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import "@core/mod/combat/core/attackModules";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import CombatController from "@core/mod/combat/core/CombatController";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import MovementManager from "@core/mod/defense/defense-modules/MovementManager";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import ObjectBreaker from "@core/mod/defense/modules/ObjectBreaker";
import TurretManager from "@core/mod/defense/modules/TurretManager";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import GameEventTracker from "@core/mod/utils/GameEventTracker";
import PingTracker from "@core/mod/utils/PingTracker";
import PacketBatcher from "@core/utils/PacketBatcher";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import AutoGrinder from "@placing/modules/AutoGrinder";
import PacketMap from "@root/utils/socket/PacketMap";
import { profileEnd, profileLap, profileStart } from "@services/profiler/Profiler";
import MovementPhysicsSimulator from "@simulation/MovementPhysicsSimulator";
import { Input } from "@ui/Input";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import { createDefaultBrainState, ModBrainState, nextTick, tickState } from "@core/TickState";
import getElem from "@utils/dom/getElem";
import getDist from "@utils/geometry/getDist";

type TickTask = () => void;

// Kept exported from here too, for the files that import it from ModManager.
export type { ModBrainState };

const activityListDisplay = getElem("activity-list-display");

export default class ModManager {
    // These four live in TickState (see there); the accessors keep `ModManager.tick` etc. working.
    static get tick() { return tickState.tick; }
    static set tick(value: number) { tickState.tick = value; }
    static get activityList() { return tickState.activityList; }
    static get enemyData() { return tickState.enemyData; }
    static get brainState() { return tickState.brainState; }
    static set brainState(value: ModBrainState) { tickState.brainState = value; }

    static willBreakObjects: GameObject[] = [];

    /**
     * Clears what belongs to one connection: queued actions, enemy lists, buildings about to break. `tick` keeps
     * counting on purpose; modules remember the tick they last did something and compare it with the current one.
     */
    static resetSession() {
        tickState.tickQueue.length = 0;
        this.willBreakObjects.length = 0;
        this.justAttacked.length = 0;
        this.activityList.length = 0;

        const enemies = this.enemyData;
        enemies.nearby.length = 0;
        enemies.nearest = null;
        enemies.all.length = 0;
        enemies.angle = 0;
        enemies.rangedInstaThreats = 0;

        this.brainState = createDefaultBrainState();
    }

    static getAttackDir(autoaimmer: true): number | undefined;
    static getAttackDir(autoaimmer?: false): number;

    static getAttackDir(autoaimmer: boolean = false): number | undefined {
        const player = Client.player;

        if (!player) return Input.getAttackDir();
        const action = AttackManager.currentAttackAction;

        if (action) {
            const type = action.aimType;
            const nearestEnemy = this.enemyData.nearest;
            const trapAim = nearestEnemy && nearestEnemy.trap ? getDir(nearestEnemy.trap, player.real_position) : 0;
            return typeof action.customAim !== "undefined" ? action.customAim : type === "nearest" ? this.enemyData.angle : trapAim;
        } else if (CombatController.currentMode === "autobreak" || CombatController.currentMode === "autobreakspike") {
            return AutoBreaker.aimAngle;
        } else if (CombatController.currentMode === "object breaking" || CombatController.currentMode === "pit object breaking") {
            return ObjectBreaker.aimAngle;
        } else if (Menu.getValue("autoGrind")) {
            return AutoGrinder.aimDir;
        } else if (!autoaimmer || CombatController.tankSpam) {
            return Input.getAttackDir();
        }

        return undefined;
    }

    static updateDirection() {
        const aimAngle = this.getAttackDir(true);

        if (typeof aimAngle === "number") {
            Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_AIM, aimAngle);
        }
    }

    /**
     * Per visible player, what their weapons could do to an object this tick, filled once by updateObjects:
     * range, and the object damage if the weapon will be reloaded (0 if not, or for a secondary that isn't a great hammer).
     */
    private static breakPotential = { primaryRange: [] as number[], primaryDamage: [] as number[], secondaryRange: [] as number[], secondaryDamage: [] as number[] };

    private static updateBreakPotential(players: Player[]) {
        const { primaryRange, primaryDamage, secondaryRange, secondaryDamage } = this.breakPotential;

        for (let j = 0, len = players.length; j < len; j++) {
            const player = players[j];
            const primary = PlayerCombatManager.fetch(player, 0);
            const secondary = PlayerCombatManager.fetch(player, 1);

            const primaryWpn = items.weapons[primary.id];
            const secondaryWpn = items.weapons[secondary.id];

            // The reload time recorded at the last swing (Samurai Armor shortens it, P25), else the weapon's speed.
            const primaryReloadTime = player.reloadTimes[primary.id] ?? primaryWpn.speed;
            const secondaryReloadTime = player.reloadTimes[secondary.id] ?? secondaryWpn.speed;
            const primaryWillBeReloaded = primary.reload + ScriptConfig.SERVER_UPDATE_SPEED / primaryReloadTime >= 1;
            const secondaryWillBeReloaded = secondary.reload + ScriptConfig.SERVER_UPDATE_SPEED / secondaryReloadTime >= 1;
            const isGreatHammer = secondary.id === WEAPON_ID_MAP.GREAT_HAMMER;

            primaryRange[j] = primaryWpn.range;
            secondaryRange[j] = secondaryWpn.range;
            primaryDamage[j] = primaryWillBeReloaded ? BreakerUtils.getObjectDamage(player, 0) : 0;
            secondaryDamage[j] = isGreatHammer && secondaryWillBeReloaded ? BreakerUtils.getObjectDamage(player, 1) : 0;
        }
    }

    private static updateObjects() {
        const onRenderObjects = PotentialObjectManager.onRenderObjects;
        const closeObjects = ObjectManager.pool.closeObjects;
        const players = PlayerManager.players.visible.all;
        this.willBreakObjects.length = 0;

        const closeObjectsLength = closeObjects.length;
        const totalLength = closeObjectsLength + onRenderObjects.length;

        // Both aims are the same for every object this tick, so work them out once instead of per object.
        const aimDir = this.getAttackDir(true);
        const mouseDir = Input.getAttackDir();

        // Weapons, reloads and damage don't depend on the object, so work them out once per player.
        this.updateBreakPotential(players);
        const { primaryRange, primaryDamage, secondaryRange, secondaryDamage } = this.breakPotential;

        for (let i = 0; i < totalLength; i++) {
            const gameObject: GameObject | PotentialObject = closeObjects[i] ?? onRenderObjects[i - closeObjectsLength];
            gameObject.willBreak = false;
            gameObject.totalDamagePotential = 0;
            gameObject.isBreaking = false;

            for (let j = 0, player_len = players.length; j < player_len; j++) {
                const player = players[j];
                const isMe = player.sid === Client.mySID;

                if (isMe) {
                    if (gameObject.isFakeObject) continue;

                    const tmpDir = getDir(gameObject, player.real_position);
                    const withinPrevIntentArc = typeof aimDir === "number" && getAngleDist(aimDir, tmpDir) <= ScriptConfig.GATHER_ANGLE;
                    const withinCurrentMouseArc = getAngleDist(mouseDir, tmpDir) <= ScriptConfig.GATHER_ANGLE;
                    if (!withinPrevIntentArc && !withinCurrentMouseArc) continue;
                }

                const primaryHitDamage = primaryDamage[j] && BreakerUtils.getObjectAttackDistance(player, gameObject, primaryRange[j]) ? primaryDamage[j] : 0;
                const secondaryHitDamage = secondaryDamage[j] && BreakerUtils.getObjectAttackDistance(player, gameObject, secondaryRange[j]) ? secondaryDamage[j] : 0;
                const weaponDamage = Math.max(primaryHitDamage, secondaryHitDamage);

                if (isMe) {
                    gameObject.isBreaking = true;
                } else {
                    // Another player only matters if they can damage it, so check that before the team lookups.
                    if (weaponDamage <= 0) continue;
                    if (gameObject.isFakeObject && (Client.isFriendly(gameObject.ownerSID ?? -1) || !Client.isTeam(player, gameObject.ownerSID ?? -1))) continue;
                }

                if (weaponDamage <= 0) continue;

                gameObject.totalDamagePotential += weaponDamage;
                if (gameObject.health > gameObject.totalDamagePotential) continue;
                if (!gameObject.willBreak && !gameObject.isFakeObject) this.willBreakObjects.push(gameObject);

                gameObject.willBreak = true;
                if (isMe) break;
            }
        }
    }

    private static preTick() {
        const player = Client.player;
        this.brainState = createDefaultBrainState();
        this.brainState.damages.push(...player.damages);
        this.brainState.pingTime = PingTracker.getCurrentPing();
        this.brainState.shameCount = player.shameCount;
        this.brainState.effectiveBatchWindow = PacketBatcher.effectiveBatchWindow;
        this.brainState.realBatchWindow = PacketBatcher.realBatchWindow;

        HatSystem.sentHatPacket = false;
        const start = __DEV__ ? profileStart() : 0;
        ObjectManager.pool.populate();
        if (__DEV__) profileEnd("fn.ObjectPool.populate", start);
    }

    static nextTick(action: TickTask) {
        nextTick(action);
    }

    private static resolveQueuedActions() {
        const queue = tickState.tickQueue;
        for (let i = 0, len = queue.length; i < len; i++) queue[i]();
        queue.length = 0;
    }

    private static updatePlacementAngles() {
        const allEnemies = this.enemyData.all;

        for (let i = 0, len = allEnemies.length; i < len; i++) {
            const enemy = allEnemies[i];
            PlayerPlacementManager.update(enemy);
        }
    }

    private static applyKnockbackOnState(tmpDir: number, kb: number) {
        kb += .3;

        const player = Client.player;
        player.next_state.velX += Math.cos(tmpDir) * kb;
        player.next_state.velY += Math.sin(tmpDir) * kb;
    }

    private static updatePredictedState() {
        const player = Client.player;
        if (!player) return;

        // Undefined on fake (empty) ticks, where update order is unknown, so the gold-tech knockback checks are skipped.
        const myPositionalSpot = PlayerStateManager.placementMap.get(player.sid);
        const justAttacked = this.justAttacked;
        const nearbyEnemies = this.enemyData.nearby;

        for (let i = 0; i < nearbyEnemies.length; i++) {
            const otherPlayer = nearbyEnemies[i];
            if (!otherPlayer || Client.isFriendly(otherPlayer.sid)) continue;

            const wpnId = otherPlayer.weaponIndex;
            const wpn = items.weapons[wpnId];
            const tmpDir = getDir(player.real_position, otherPlayer.real_position);

            const otherSpot = PlayerStateManager.placementMap.get(otherPlayer.sid);
            if (myPositionalSpot === undefined || otherSpot === undefined) continue;

            if (!CombatUtils.getCombatDistance(otherPlayer, player, wpn.range - 1)) continue;
            if (myPositionalSpot < otherSpot) continue;

            const wpnGroup = wpnId < 9 ? 0 : 1;
            const isReloaded = otherPlayer.getReload(wpnGroup) === 1;
            const wasReloaded = otherPlayer.getLastReload(wpnGroup) === 1;

            if (!isReloaded || wasReloaded) continue;
            this.applyKnockbackOnState(tmpDir, wpn.knock ?? 0);
        }

        for (let i = 0; i < justAttacked.length; i++) {
            const otherPlayer = justAttacked[i];
            if (!otherPlayer || Client.isFriendly(otherPlayer.sid)) continue;

            const wpnId = otherPlayer.weaponIndex;
            const wpn = items.weapons[wpnId];
            const tmpDir = getDir(player.real_position, otherPlayer.real_position);

            const otherSpot = PlayerStateManager.placementMap.get(otherPlayer.sid);
            if (myPositionalSpot === undefined || otherSpot === undefined) continue;

            if (!CombatUtils.getCombatDistance(otherPlayer, player, wpn.range - 1)) continue;
            if (myPositionalSpot > otherSpot) continue;
            if (getAngleDist(otherPlayer.d2, tmpDir) > ScriptConfig.GATHER_ANGLE) continue;
            this.applyKnockbackOnState(tmpDir, wpn.knock ?? 0);
        }

        const moveDir = MovementManager.getMoveDir(true);
        player.next_state.spikeDamages = 0;

        const newState = MovementPhysicsSimulator.simTick(player.next_state, moveDir);
        Player.copyStateTo(newState, player.next_state);
    }

    private static updateStates() {
        let lap = __DEV__ ? profileStart() : 0;
        PlayerStateManager.updateState();
        TurretManager.updateReloads();
        if (__DEV__) lap = profileLap("fn.PlayerStateManager+TurretManager", lap);
        this.updatePlacementAngles();
        if (__DEV__) lap = profileLap("fn.updatePlacementAngles", lap);
        this.updatePredictedState();
        if (__DEV__) lap = profileLap("fn.updatePredictedState", lap);

        ProjectileManager.update();
        if (__DEV__) lap = profileLap("fn.ProjectileManager.update", lap);

        const player = Client.player;
        this.brainState.isTrapped = !!player.trap;
        this.brainState.wasTrapped = player.wasTrapped;
        PotentialObjectManager.update(player.real_position.x, player.real_position.y, 0);
        PotentialObjectManager.query();
        if (__DEV__) profileLap("fn.PotentialObjectManager", lap);
    }

    static resolveAttackState() {
        const attackState = CombatController.attackState;

        if (attackState.confirm && !attackState.status) {
            attackState.status = true;
            CombatController.sendAutoGather();
        } else if (attackState.status && !attackState.confirm) {
            attackState.status = false;
            CombatController.sendAutoGather();
        }

        attackState.confirm = false;
    }

    private static lastActivityHTML = "";

    private static updateBrainUI() {
        let html = "";

        if (Menu.getValue("showActivity")) {
            for (let i = 0; i < this.activityList.length; i++) {
                html += `<span>${this.activityList[i]}</span>`;
            }
        }

        // Writing innerHTML every tick forces a re-layout even when nothing changed.
        if (html === this.lastActivityHTML) return;
        this.lastActivityHTML = html;
        activityListDisplay.innerHTML = html;
    }

    private static postTick() {
        if (Input.keys["ShiftLeft"])
            this.activityList.push("overrideOn");

        Client.player.hadProjDamages = Client.player.projDamages.length !== 0;
        Client.player.projDamages.length = 0;
        Client.player.justAttacked = false;

        for (let i = 0, len = this.enemyData.all.length; i < len; i++) {
            this.enemyData.all[i].projDamages.length = 0;
            this.enemyData.all[i].justAttacked = false;
        }

        this.updateBrainUI();
        this.brainState.activityList.push(...this.activityList);
        this.brainState.packets = PacketTracker.getCurrent();
        this.brainState.tick = this.tick;

        this.activityList.length = 0;
        this.justAttacked.length = 0;
        PlacementSystem.totalPlacements = 0;
    }

    private static autoPlayMovement() {
        if (Input.keys["ShiftLeft"]) return;
        if (!Menu.getValue("autoPlay")) return;

        const followTo = parseInt(Menu.getValue("followTo"));
        const nearest = isNaN(followTo) ? undefined : followTo > 0 ?
            PlayerManager.players.visible.all.find(e => e.sid === followTo) :
            this.enemyData.nearest;

        const playerPos = Client.player.real_position;

        if (nearest) {
            const enemyPos = nearest.real_position;
            const enemyAngle = nearest === ModManager.enemyData.nearest ? this.enemyData.angle : getDir(nearest.real_position, playerPos);

            if (getDist(enemyPos, playerPos) <= 85) {
                const targetAngle = enemyAngle + Math.PI / 2;
                const orbitTarget = {
                    x: enemyPos.x + Math.cos(targetAngle) * 85,
                    y: enemyPos.y + Math.sin(targetAngle) * 85
                };

                Client.lastMoveDir = getDir(orbitTarget, playerPos);
            } else {
                Client.lastMoveDir = enemyAngle;
            }

            return;
        }

        Client.lastMoveDir = null;
    }

    private static lastWeaponIndex = 0;
    static justAttacked: Player[] = [];

    /**
     * One mod tick, run after every UPDATE_PLAYERS (real, or faked by PacketBatcher when a tick is late).
     *
     * The order matters and should not be changed casually:
     * 1. Prepare: rebuild this tick's state (players, objects, predicted positions, queued object damage).
     * 2. DefenseSystem.start: add up the damage we could take this tick (spikes, enemies, projectiles).
     * 3. Attack side: AutoPusher, AttackManager (picks one attack from the modules), CombatController.
     * 4. DefenseSystem.respond: heal and choose soldier/EMP, knowing what the attack side wants to do.
     * 5. DefenseSystem.resolve and PlacementSystem: send this tick's hat, movement and placement packets.
     * 6. Clean up and hand the packet budget to the next tick.
     * Damage and knockback predictions rely on the server's player update order (GOLD_TECH.md).
     */
    static main() {
        // Every module below assumes we have spawned and are alive; updates can arrive before ADD_PLAYER.
        if (!Client.player || !Client.isAlive) return;

        const startTime = performance.now();
        // Dev builds only: time each step below (profiler overlay, replay benchmark). Dropped from production.
        const tickStart = __DEV__ ? profileStart() : 0;
        let lap = tickStart;

        // prep the tick
        this.preTick();
        this.resolveQueuedActions();
        this.updateStates();
        GameEventTracker.prepare();
        if (__DEV__) lap = profileLap("tick.prepare", lap);

        // not important but "player" inputs go first
        this.autoPlayMovement();
        if (__DEV__) lap = profileLap("tick.autoPlayMovement", lap);

        // important stuff
        AutoBreaker.preTick();
        if (__DEV__) lap = profileLap("tick.AutoBreaker.preTick", lap);
        DefenseSystem.start();
        if (__DEV__) lap = profileLap("tick.DefenseSystem.start", lap);

        // important preprocessing
        this.updateObjects();
        if (__DEV__) lap = profileLap("tick.updateObjects", lap);
        PlacementSystem.AutoPlacer.preStart(Client.player);
        if (__DEV__) lap = profileLap("tick.AutoPlacer.preStart", lap);

        // less important stuff
        AutoPusher.main();
        if (__DEV__) lap = profileLap("tick.AutoPusher", lap);
        AttackManager.main();
        if (__DEV__) lap = profileLap("tick.AttackManager", lap);
        CombatController.main();
        if (__DEV__) lap = profileLap("tick.CombatController", lap);

        if (this.lastWeaponIndex === Client.weaponIndex) PacketTracker.free("WEAPON_SELECT", "ALL");
        this.lastWeaponIndex = Client.weaponIndex;

        // respond to the threats while factoring in what the other modules are trying to do
        DefenseSystem.respond();
        if (__DEV__) lap = profileLap("tick.DefenseSystem.respond", lap);

        // resolve all the important modules
        DefenseSystem.resolve();
        if (__DEV__) lap = profileLap("tick.DefenseSystem.resolve", lap);
        PlacementSystem.main();
        if (__DEV__) lap = profileLap("tick.PlacementSystem", lap);

        // do final actions and clean up
        DefenseSystem.conclude();
        if (__DEV__) lap = profileLap("tick.DefenseSystem.conclude", lap);
        CombatController.postTick();
        this.updateDirection();
        this.resolveAttackState();
        this.postTick();

        // prep the next tick
        PacketTracker.allocate();
        GameEventTracker.clean();
        if (__DEV__) {
            profileLap("tick.finish", lap);
            profileEnd("tick", tickStart);
        }
        this.brainState.modBrainRuntime = performance.now() - startTime;
    }
}