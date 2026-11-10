import getAngleDist from "@utils/angle/getAngleDist";
import ScriptConfig from "@utils/config/ScriptConfig";

/** An object near us, as the trap breaker's aim search sees it. */
export interface BreakAimObject {
    x: number;
    y: number;
    /** The object's size; 1.8.2 counts it reached when the distance minus this is within the weapon's range. */
    scale: number;
    /** An enemy's spike or trap: worth hitting. */
    danger: boolean;
    /** Ours or a teammate's: a swing damages it too, so better not. */
    friendly: boolean;
}

/** Aim directions tried besides the ones straight at each object: every 5 degrees. */
const STEPS = 72;

/**
 * 1.8.2's melee rule for objects (bundle.js player.gather): every object whose distance minus its size is within the
 * weapon's range and whose direction is within GATHER_ANGLE (about 69 deg) of the aim is hit. Returns the objects an
 * aim hits, as indexes.
 */
export function objectsHit(from: { x: number; y: number }, aim: number, range: number, objects: readonly BreakAimObject[]) {
    const hit: number[] = [];
    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        if (!obj) continue;
        const dx = obj.x - from.x;
        const dy = obj.y - from.y;
        if (Math.hypot(dx, dy) - obj.scale > range) continue;
        // A trap centred on us has no direction: any aim reaches it.
        const atUs = dx === 0 && dy === 0;
        if (atUs || getAngleDist(Math.atan2(dy, dx), aim) <= ScriptConfig.GATHER_ANGLE) hit.push(i);
    }
    return hit;
}

/**
 * The trap breaker's aim with "Break Traps From Any Angle": of all aim directions, the one that hits the most enemy
 * spikes and traps in one swing, among those that still hit every enemy spike and trap `currentAim` hits (so it is
 * never worse).
 * Ties: fewer of our own buildings hit, then the direction closest to `currentAim`.
 */
export function bestBreakAim(from: { x: number; y: number }, currentAim: number, range: number, objects: readonly BreakAimObject[]) {
    // Every enemy spike and trap the usual aim hits must still be hit (our own buildings it hits needn't be).
    const mustHit = objectsHit(from, currentAim, range, objects).filter(i => objects[i]?.danger);
    const candidates = [currentAim];
    for (let i = 0; i < STEPS; i++) candidates.push(-Math.PI + (2 * Math.PI * i) / STEPS);
    for (const obj of objects) {
        if (obj.x !== from.x || obj.y !== from.y) candidates.push(Math.atan2(obj.y - from.y, obj.x - from.x));
    }

    let best = currentAim;
    let bestDanger = -1;
    let bestFriendly = Infinity;
    let bestTurn = Infinity;

    for (const aim of candidates) {
        const hit = objectsHit(from, aim, range, objects);
        if (mustHit.some(i => !hit.includes(i))) continue;

        let danger = 0;
        let friendly = 0;
        for (const i of hit) {
            const obj = objects[i];
            if (obj?.danger) danger++;
            if (obj?.friendly) friendly++;
        }
        const turn = getAngleDist(aim, currentAim);

        if (danger > bestDanger || (danger === bestDanger && (friendly < bestFriendly || (friendly === bestFriendly && turn < bestTurn)))) {
            best = aim;
            bestDanger = danger;
            bestFriendly = friendly;
            bestTurn = turn;
        }
    }

    return best;
}
