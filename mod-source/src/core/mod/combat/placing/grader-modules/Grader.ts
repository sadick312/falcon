import GameObject from "@constants/GameObject";
import Player from "@entities/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PotentialObjectManager from "@core/logic/PotentialObjectManager";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import Angle from "@core/mod/combat/placing/Angle";
import ModManager from "@core/ModManager";
import { tickState } from "@core/TickState";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import getDist from "@utils/geometry/getDist";
import getDistSq from "@utils/geometry/getDistSq";
import withinDist from "@utils/geometry/withinDist";
import { isCactusObject } from "@constants/world";

/**
 * Per enemy, indexed by the enemy's sid. Every entry the graders read is written by prepare() for the same angle
 * first, so entries left by enemies that are gone are never read. (These were Maps; set() per angle and enemy was
 * a good part of prepare's time.)
 */
interface GraderEnemyCache {
    directionMap: number[];
    distanceSqMap: number[];
    trapsNearMap: number[];
    spikesNearMap: number[];
}

/** What a spike or trap is to an enemy, for prepare's count of what's near it. */
const enum ObjectKind { None = 0, Spike = 1, Trap = 2, NotWorkedOut = 255 }

interface GraderInternalCache {
    enemies: GraderEnemyCache;
    canAbuse: boolean;
}

export default abstract class Grader {
    constructor() { }

    protected internalCache: GraderInternalCache = {
        enemies: {
            directionMap: [],
            distanceSqMap: [],
            trapsNearMap: [],
            spikesNearMap: []
        },
        canAbuse: false
    };

    /** The spikes and traps in range of the angle being prepared, reused between calls. */
    private objectsInRange: GameObject[] = [];

    /** The same as indexes into Grader.candidates, when prepare() uses the candidates. */
    private candidatesInRange: number[] = [];

    /**
     * Set by the Angle Finder while it grades one player's angles: the active spikes and traps (in allSpikes then
     * allTraps order) that can be in range of any of those angles. Null outside that, and prepare() walks the full lists.
     */
    static candidates: GameObject[] | null = null;

    private static candidateBuffer: GameObject[] = [];

    /**
     * What each candidate is to each of `candidateEnemies` (at candidate * enemies + enemy), for normal and for
     * preplace angles. Team, cactus and "about to break" don't change while one player's angles are graded, so
     * each is worked out the first time an angle needs it and reused for the rest of the angles (NotWorkedOut until
     * then; working all of them out up front cost more than it saved when only a few angles are graded).
     */
    private static candidateKinds = new Uint8Array(64);
    private static candidatePreplaceKinds = new Uint8Array(64);
    private static candidateEnemies: Player[] | null = null;

    private static objectKind(enemy: Player, gameObject: GameObject, preplace: boolean) {
        const isTeam = Client.isTeam(enemy, gameObject.ownerSID ?? -1);
        const willBreak = preplace && gameObject.willBreak;
        const isTrap = gameObject.trap && !isTeam && !willBreak;
        const isSpike = gameObject.dmg && !isTeam && !willBreak;

        if (isCactusObject(gameObject) || isSpike) return ObjectKind.Spike;
        return isTrap ? ObjectKind.Trap : ObjectKind.None;
    }

    /**
     * Picks the spikes and traps that can be within `15 + item + object` of an angle at most `maxReach` from `center`,
     * and what each is to each of `enemies` (the list prepare() will be given).
     */
    static setCandidates(center: { x: number; y: number }, maxReach: number, enemies: Player[]) {
        const list = this.candidateBuffer;
        list.length = 0;

        const allSpikes = ObjectManager.pool.allSpikes;
        const allTraps = ObjectManager.pool.allTraps;
        const spikesLength = allSpikes.length;

        for (let i = 0, len = spikesLength + allTraps.length; i < len; i++) {
            const gameObject = allSpikes[i] ?? allTraps[i - spikesLength];
            if (!gameObject || !gameObject.active || gameObject.isGhost) continue;
            if (withinDist(center, gameObject, maxReach + gameObject.scale + 1)) list.push(gameObject);
        }

        const enemyCount = enemies.length;
        const size = list.length * enemyCount;
        if (this.candidateKinds.length < size) {
            this.candidateKinds = new Uint8Array(size * 2);
            this.candidatePreplaceKinds = new Uint8Array(size * 2);
        }

        this.candidateKinds.fill(ObjectKind.NotWorkedOut, 0, size);
        this.candidatePreplaceKinds.fill(ObjectKind.NotWorkedOut, 0, size);

        this.candidateEnemies = enemies;
        this.candidates = list;
    }

    /** Whether none of the enemy's possible placements is in reach of the angle; if one is, the angle gets priority. */
    factorAngleAbuse(item: Angle, enemy: Player) {
        const placePotential = enemy.placePotential;
        const all = placePotential.all;
        const count = placePotential.allBufferIndex;
        const scale = item.scale + placePotential.objectScale;
        const scaleSq = scale * scale;

        // Runs per angle and enemy, and most angles are nowhere near the enemy's placements: anything farther than
        // `scale` outside their bounding box can't be in reach (+1 so rounding can't reject a point exactly at `scale`).
        const reach = scale + 1;
        if (
            item.x < placePotential.allMinX - reach || item.x > placePotential.allMaxX + reach ||
            item.y < placePotential.allMinY - reach || item.y > placePotential.allMaxY + reach
        ) return true;

        // Any point in reach gives the same result, and neighbouring angles usually hit the same point.
        const lastHit = placePotential.allLastHit;
        const lastHitPoint = lastHit < count ? all[lastHit] : undefined;
        if (lastHitPoint && getDistSq(lastHitPoint, item) <= scaleSq) {
            item.priority = true;
            return false;
        }

        for (let i = 0; i < count; i++) {
            const point = all[i];
            if (point && getDistSq(point, item) <= scaleSq) {
                placePotential.allLastHit = i;
                item.priority = true;
                return false;
            }
        }

        return true;
    }

    private factorAlignment(obj: GameObject, item: Angle) {
        const totalScale = obj.scale + item.scale;
        const dist = getDist(obj, item);
        const dir = getDir(obj, item);

        item.grade += 1.5 * (1 - (getAngleDist(dir, item.angle) / Math.PI));
        item.alignment = 1.5 * (1 - (dist / totalScale));
        item.grade += item.alignment;
    }

    private factorPreplaceAlignment(item: Angle) {
        let total = 0;
        let obj: GameObject | undefined;
        const willBreakObjects = ModManager.willBreakObjects;

        for (let i = 0, len = willBreakObjects.length; i < len; i++) {
            const gameObj = willBreakObjects[i];
            if (!gameObj) continue;
            if (!withinDist(item, gameObj, gameObj.scale + item.scale)) continue;

            if (gameObj.isBreaking) {
                item.breaking = true;
            }

            obj = gameObj;
            total++;

            if (total >= 2) {
                item.overlap = true;
                item.dontUse = true;
                break;
            }
        }

        if (!obj || item.overlap) return;
        this.factorAlignment(obj, item);
    }

    protected applyDecay(item: Angle) {
        const usedAngles = PlacementSystem.usedAngles;
        const usedAnglesCount = PlacementSystem.usedAnglesCount;
        if (usedAnglesCount === 0) return;

        const tick = tickState.tick;

        for (let i = 0; i < usedAnglesCount; i++) {
            const used = usedAngles[i];
            if (used === undefined) continue;

            const tickOffset = tick - used.tick;
            if (tickOffset > 18) continue;

            const isOverlapping = getAngleDist(item.angle, used.angle) <= .12;
            if (!isOverlapping) continue;

            item.dontUse = true;
            break;
        }
    }

    private factorPotentialObjects(item: Angle, allowPreplace: boolean) {
        const closeObjects = PotentialObjectManager.closeObjects;

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const obj = closeObjects[i];
            if (!obj || !obj.active) continue;
            if (!withinDist(item, obj, item.scale + 50)) continue;
            if (tickState.tick - obj.tick <= 1) continue;

            if (!item.preplace && allowPreplace && obj.willBreak) {
                item.predict = true;
                item.grade += .75;
                item.predictBoost += .75;
                continue;
            }

            item.grade -= item.preplace ? 1 : .5;
        }
    }

    prepare(item: Angle, enemies: Player[], allowPreplace: boolean, replaceObj?: GameObject) {
        const allSpikes = ObjectManager.pool.allSpikes;
        const allTraps = ObjectManager.pool.allTraps;
        if (replaceObj) item.replace = true;

        const { directionMap, distanceSqMap, trapsNearMap, spikesNearMap } = this.internalCache.enemies;

        this.factorPotentialObjects(item, allowPreplace);
        if (!item.preplace)
            this.applyDecay(item);

        let canAbuse = true;

        // Which spikes and traps are in range depends only on the angle, so find them once for all enemies. The
        // Angle Finder hands over the ones within reach of the player once per call (Grader.candidates), with what
        // each is to each enemy; this used to walk every nearby spike and trap, and check each per enemy, per angle.
        const objectsInRange = this.objectsInRange;
        if (objectsInRange.length) objectsInRange.length = 0;
        const candidatesInRange = this.candidatesInRange;
        if (candidatesInRange.length) candidatesInRange.length = 0;

        const candidates = Grader.candidates;
        const useCandidates = enemies.length > 0 && candidates !== null && Grader.candidateEnemies === enemies;
        if (useCandidates) {
            for (let i = 0, len = candidates.length; i < len; i++) {
                const gameObject = candidates[i];
                if (gameObject === undefined) continue;
                if (withinDist(item, gameObject, 15 + item.scale + gameObject.scale)) candidatesInRange.push(i);
            }
        } else {
            const spikesLength = allSpikes.length;
            const totalLength = enemies.length ? allSpikes.length + allTraps.length : 0;

            for (let i = 0; i < totalLength; i++) {
                const gameObject = allSpikes[i] ?? allTraps[i - spikesLength];
                if (!gameObject || !gameObject.active || gameObject.isGhost) continue;
                if (withinDist(item, gameObject, 15 + item.scale + gameObject.scale)) objectsInRange.push(gameObject);
            }
        }

        const kinds = item.preplace ? Grader.candidatePreplaceKinds : Grader.candidateKinds;
        const enemyCount = enemies.length;

        for (let e = 0; e < enemyCount; e++) {
            const enemy = enemies[e];
            if (enemy === undefined) continue;
            const pos = enemy.real_position;

            const distanceSq = getDistSq(pos, item);

            directionMap[enemy.sid] = getDir(pos, item);
            distanceSqMap[enemy.sid] = distanceSq;

            const proposedCanAbuse = this.factorAngleAbuse(item, enemy);
            if (canAbuse) canAbuse = proposedCanAbuse;

            let trapsNear = 0;
            let spikesNear = 0;

            if (useCandidates) {
                for (let i = 0, len = candidatesInRange.length; i < len; i++) {
                    const c = candidatesInRange[i]!;
                    const slot = c * enemyCount + e;
                    let kind = kinds[slot];
                    if (kind === ObjectKind.NotWorkedOut) kind = kinds[slot] = Grader.objectKind(enemy, candidates[c]!, item.preplace);
                    if (kind === ObjectKind.Spike) spikesNear++;
                    else if (kind === ObjectKind.Trap) trapsNear++;
                }
            } else {
                for (let i = 0, len = objectsInRange.length; i < len; i++) {
                    const kind = Grader.objectKind(enemy, objectsInRange[i]!, item.preplace);
                    if (kind === ObjectKind.Spike) spikesNear++;
                    else if (kind === ObjectKind.Trap) trapsNear++;
                }
            }

            trapsNearMap[enemy.sid] = trapsNear;
            spikesNearMap[enemy.sid] = spikesNear;
        }

        if (item.predict && !item.priority) {
            item.predict = false;
            item.grade -= item.predictBoost;
        }

        if (item.replace) {
            const obj = replaceObj!;
            this.factorAlignment(obj, item);
        }

        if (item.preplace) {
            item.grade++;
            if (!item.priority) item.dontUse = true;
            this.factorPreplaceAlignment(item);
        }

        this.internalCache.canAbuse = canAbuse;
    }

    abstract grade(item: Angle, enemy: Player): void;
}