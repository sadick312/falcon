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
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import CombatController from "@core/mod/combat/core/CombatController";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import { AutoHealerInternal } from "@core/mod/defense/defense-modules/AutoHealer";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import MovementManager from "@core/mod/defense/defense-modules/MovementManager";
import DefenseSystem, { ISpikeTickPatternRec } from "@core/mod/defense/DefenseSystem";
import AutoBreaker, { AutoBreakerInternal } from "@core/mod/defense/modules/AutoBreaker";
import ObjectBreaker from "@core/mod/defense/modules/ObjectBreaker";
import TurretManager from "@core/mod/defense/modules/TurretManager";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import GameEventTracker from "@core/mod/utils/GameEventTracker";
import PingTracker from "@core/mod/utils/PingTracker";
import PacketBatcher from "@core/utils/PacketBatcher";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import { Point } from "@mod-types/index";
import AutoGrinder from "@placing/modules/AutoGrinder";
import PacketMap from "@root/utils/socket/PacketMap";
import { profileEnd, profileLap, profileStart } from "@services/profiler/Profiler";
import MovementPhysicsSimulator from "@simulation/MovementPhysicsSimulator";
import { Input } from "@ui/Hook";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import getElem from "@utils/dom/getElem";
import getDist from "@utils/geometry/getDist";

type TickTask = () => void;

export interface ModBrainState {
    tick: number;
    damages: number[];
    sources: string[];
    preHitChances: number;
    healingResponse: string;
    activityList: string[];
    canPlaceOnMe: boolean;
    pingTime: number;
    shameCount: number;
    packets: number;
    healingUsed: number;
    hatUsed: number;
    accUsed: number;
    modBrainRuntime: number;
    effectiveBatchWindow: number;
    realBatchWindow: number;
    breakerInternal: AutoBreakerInternal;
    healingInternal: AutoHealerInternal;
    totalDamage: number;
    isTrapped: boolean;
    wasTrapped: boolean;
    preHitStates: { sid: number, hits: number }[];
    randomHitStates: { sid: number, hits: number }[];
    latePreHitStates: { sid: number, hits: number }[];
    spikeTickPot: ISpikeTickPatternRec;
    modVersion: string;
    trapData: Point;
    trapHitState: number;
}

interface IEnemyData {
    nearest: Player | null;
    nearby: Player[];
    all: Player[];
    angle: number;
    rangedInstaThreats: number;
}

const activityListDisplay = getElem("activity-list-display");

export default class ModManager {
    static tick = 0;
    static activityList: string[] = [];
    static willBreakObjects: GameObject[] = [];
    static enemyData: IEnemyData = {
        nearby: [],
        nearest: null,
        all: [],
        angle: 0,
        rangedInstaThreats: 0
    };

    static brainState: ModBrainState = this.createDefaultState();
    private static tickQueue: TickTask[] = [];

    private static createDefaultState(): ModBrainState {
        return {
            tick: -1,
            modBrainRuntime: -1,
            preHitChances: -1,
            damages: [], sources: [], activityList: [],
            healingResponse: "no response",
            canPlaceOnMe: false,
            pingTime: 6967,
            hatUsed: -1,
            preHitStates: [],
            randomHitStates: [],
            latePreHitStates: [],
            accUsed: -1,
            shameCount: 67,
            totalDamage: 0,
            packets: 10000,
            isTrapped: false,
            wasTrapped: false,
            modVersion: "v1.0.0-pub",
            healingUsed: 9999,
            effectiveBatchWindow: -.5,
            realBatchWindow: -.5,
            breakerInternal: { replaceSpike: false, replaceTrap: false, trapBreakFaster: false, isConsidering: false },
            trapHitState: -1,
            healingInternal: { healthAfterDamage: -676767, willDieIfDoNothing: true, alreadyForcedHat: false, empDamage: 6967, healthAfterSoldier: Infinity, currentHealth: 0, expectedDamage: 0 },
            spikeTickPot: { amount: 1000, resetTicks: -1, resolveOccurances: 1000, hasOccuredBefore: false, currentMax: 1000, reset: false, max: 1000, lastOccured: 67 },
            trapData: { x: -1, y: -1 }
        };
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

        for (let i = 0; i < totalLength; i++) {
            const gameObject: GameObject | PotentialObject = closeObjects[i] ?? onRenderObjects[i - closeObjectsLength];
            gameObject.willBreak = false;
            gameObject.totalDamagePotential = 0;
            gameObject.isBreaking = false;

            for (let j = 0, player_len = players.length; j < player_len; j++) {
                const player = players[j];

                if (gameObject.isFakeObject) {
                    if (player.sid === Client.mySID) continue;
                    if (Client.isFriendly(gameObject.ownerSID ?? -1)) continue;
                    if (!Client.isTeam(player, gameObject.ownerSID ?? -1)) continue;
                } else if (player.sid === Client.mySID) {
                    const tmpDir = getDir(gameObject, player.real_position);

                    const withinPrevIntentArc = typeof aimDir === "number" && getAngleDist(aimDir, tmpDir) <= ScriptConfig.GATHER_ANGLE;
                    const withinCurrentMouseArc = getAngleDist(mouseDir, tmpDir) <= ScriptConfig.GATHER_ANGLE;
                    if (!withinPrevIntentArc && !withinCurrentMouseArc) continue;
                }

                const primary = PlayerCombatManager.fetch(player, 0);
                const secondary = PlayerCombatManager.fetch(player, 1);

                const primaryWpn = items.weapons[primary.id];
                const secondaryWpn = items.weapons[secondary.id];

                const primaryReloadPerTick = ScriptConfig.SERVER_UPDATE_SPEED / primaryWpn.speed;
                const secondaryReloadPerTick = ScriptConfig.SERVER_UPDATE_SPEED / secondaryWpn.speed;

                const primaryWillBeReloaded = primary.reload + primaryReloadPerTick >= 1;
                const secondaryWillBeReloaded = secondary.reload + secondaryReloadPerTick >= 1;

                const canPrimaryHit = BreakerUtils.getObjectAttackDistance(player, gameObject, primaryWpn.range);
                const canSecondaryHit = BreakerUtils.getObjectAttackDistance(player, gameObject, secondaryWpn.range);
                const isGreatHammer = secondary.id === WEAPON_ID_MAP.GREAT_HAMMER;

                const primaryDamage = canPrimaryHit && primaryWillBeReloaded ?
                    BreakerUtils.getObjectDamage(player, 0) : 0;

                const secondaryDamage = canSecondaryHit && isGreatHammer && secondaryWillBeReloaded ?
                    BreakerUtils.getObjectDamage(player, 1) : 0;

                const weaponDamage = Math.max(primaryDamage, secondaryDamage);

                if (Client.mySID === player.sid) gameObject.isBreaking = true;
                if (weaponDamage <= 0) continue;

                gameObject.totalDamagePotential += weaponDamage;
                if (gameObject.health > gameObject.totalDamagePotential) continue;
                if (!gameObject.willBreak && !gameObject.isFakeObject) this.willBreakObjects.push(gameObject);

                gameObject.willBreak = true;
                if (Client.mySID === player.sid) break;
            }
        }
    }

    private static preTick() {
        const player = Client.player;
        this.brainState = this.createDefaultState();
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
        this.tickQueue.push(action);
    }

    private static resolveQueuedActions() {
        const queue = this.tickQueue;
        for (let i = 0, len = queue.length; i < len; i++) queue[i]();
        this.tickQueue.length = 0;
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

    static main() {
        // Every module below assumes we have spawned; updates can arrive before ADD_PLAYER.
        if (!Client.player) return;

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