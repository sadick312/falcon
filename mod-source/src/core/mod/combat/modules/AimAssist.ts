import Player from "@entities/Player";
import { getProjectile, getWeapon } from "@constants/items";
import Client from "@core/Client";
import { tickState } from "@core/TickState";
import Menu from "@menu/Menu";
import { Input } from "@ui/Input";
import getAngleDist from "@utils/angle/getAngleDist";
import ScriptConfig from "@utils/config/ScriptConfig";
import { combatDebug, combatDebugOn } from "@utils/debug/combatDebug";

/** The widest the aim cone may ever be (the user's "no 360° hitting" rule): 60 degrees in all. */
export const MAX_FOV_DEG = 60;
/** 1.8.2 spawns a projectile this far in front of the shooter. */
const PROJECTILE_START = 70;

type AimPick =0 | 1 | 2; // nearest, lowest health, closest to the mouse

interface Point {
    x: number;
    y: number;
}

/** What the assist needs from a player; Player in the game, plain objects in tests. */
export interface AimCandidate {
    sid: number;
    health: number;
    real_position: Point;
    last_position: Point;
    trap?: unknown;
}

/** Half the cone in radians for a full cone of `fovDeg` degrees, never wider than MAX_FOV_DEG. */
export function halfCone(fovDeg: number) {
    const fov = Math.max(0, Math.min(MAX_FOV_DEG, fovDeg));
    return (fov / 2) * Math.PI / 180;
}

/**
 * The targets the assist may pick: alive, not a teammate (the caller passes enemies only), within `maxDist` and inside
 * the cone of half-width `half` around the mouse direction.
 */
export function inCone(from: Point, mouseDir: number, half: number, maxDist: number, players: readonly AimCandidate[]) {
    const out: AimCandidate[] = [];
    for (const p of players) {
        if (!(p.health > 0)) continue;
        const dx = p.real_position.x - from.x;
        const dy = p.real_position.y - from.y;
        if (dx * dx + dy * dy > maxDist * maxDist) continue;
        if (getAngleDist(Math.atan2(dy, dx), mouseDir) > half) continue;
        out.push(p);
    }
    return out;
}

/** Picks one target by the chosen rule. Ties go to the closer one. */
export function pickTarget(from: Point, mouseDir: number, pick: AimPick, candidates: readonly AimCandidate[]) {
    let best: AimCandidate | null = null;
    let bestScore = Infinity;
    let bestDist = Infinity;
    for (const p of candidates) {
        const dx = p.real_position.x - from.x;
        const dy = p.real_position.y - from.y;
        const dist = dx * dx + dy * dy;
        const score = pick === 1 ? p.health : pick === 2 ? getAngleDist(Math.atan2(dy, dx), mouseDir) : dist;
        if (score < bestScore || (score === bestScore && dist < bestDist)) {
            best = p;
            bestScore = score;
            bestDist = dist;
        }
    }
    return best;
}

/**
 * Where to aim a projectile of `speed` (px per ms) fired from `from` so it meets `target`, which keeps moving as it
 * did over the last server tick. A trapped target doesn't move. A few rounds of "how long will the shot take to get
 * there, and where is the target by then" are plenty at these speeds.
 */
export function predictHit(from: Point, target: AimCandidate, speed: number, out: Point = { x: 0, y: 0 }) {
    const tick = ScriptConfig.SERVER_UPDATE_SPEED;
    const moving = !target.trap;
    const vx = moving ? (target.real_position.x - target.last_position.x) / tick : 0;
    const vy = moving ? (target.real_position.y - target.last_position.y) / tick : 0;

    out.x = target.real_position.x;
    out.y = target.real_position.y;
    if (!(speed > 0) || (vx === 0 && vy === 0)) return out;

    for (let i = 0; i < 4; i++) {
        const flight = Math.max(0, Math.hypot(out.x - from.x, out.y - from.y) - PROJECTILE_START) / speed;
        out.x = target.real_position.x + vx * flight;
        out.y = target.real_position.y + vy * flight;
    }
    return out;
}

/**
 * "Aim Assist" (off by default): when you hit by hand (mouse tank spam, or E auto-gather with "Aim With Mouse While
 * Gathering"), it turns the swing to an enemy inside a cone around your mouse, never outside it. Melee aims at the
 * enemy's centre; a musket, crossbow or bow aims where the enemy will be when the shot arrives.
 * L locks on to the current target (kept while it stays in the cone), J switches to the next one in the cone.
 */
export default class AimAssist {
    static target: Player | null = null;
    /** The point the last shot was aimed at (the enemy's centre for melee), for the marker. */
    static aimPoint: Point | null = null;
    static locked = false;

    private static lastTick = -1;
    private static switchRequested = false;
    /** J's pick is kept (like a lock, without the red marker) until it leaves the cone or L unlocks. */
    private static switchedHold = false;
    private static aimBuffer: Point = { x: 0, y: 0 };

    /**
     * The target while the assist is in use (it aimed this tick or the last), else null. `target` itself keeps the
     * last pick after we stop hitting by hand, so the marker must use this.
     */
    static activeTarget() {
        if (!this.enabled() || this.lastTick < tickState.tick - 1) return null;
        return this.target;
    }

    static enabled() {
        return Menu.getValue("aimAssist") === true;
    }

    static toggleLock() {
        if (!this.enabled()) return;
        this.locked = !this.locked && this.target !== null;
        if (!this.locked) this.switchedHold = false;
    }

    static requestSwitch() {
        if (!this.enabled()) return;
        this.switchRequested = true;
    }

    private static settings() {
        const fov = Number(Menu.getValue("aimAssist:fov"));
        const maxDist = Number(Menu.getValue("aimAssist:maxDist"));
        const pick = Number(Menu.getValue("aimAssist:pick"));
        return {
            fov: isFinite(fov) ? fov : 40,
            maxDist: isFinite(maxDist) ? maxDist : 700,
            pick: (pick === 1 || pick === 2 ? pick : 0) as AimPick
        };
    }

    /** Re-picks the target once per server tick. */
    private static update() {
        if (this.lastTick === tickState.tick) return;
        this.lastTick = tickState.tick;

        const player = Client.player;
        if (!player) {
            this.target = null;
            return;
        }

        const from = player.real_position;
        const mouseDir = Input.getAttackDir();
        const { fov, maxDist, pick } = this.settings();
        const candidates = inCone(from, mouseDir, halfCone(fov), maxDist, tickState.enemyData.all) as Player[];
        const previous = this.target;
        const stillValid = previous !== null && candidates.includes(previous);

        if (this.switchRequested && candidates.length > 0) {
            // The next target in the cone, going round by angle from the current one.
            const sorted = candidates.slice().sort((a, b) =>
                Math.atan2(a.real_position.y - from.y, a.real_position.x - from.x) -
                Math.atan2(b.real_position.y - from.y, b.real_position.x - from.x));
            const at = previous ? sorted.indexOf(previous) : -1;
            this.target = sorted[(at + 1) % sorted.length] ?? null;
            // Without this the next tick's normal pick went straight back (J only worked while locked).
            this.switchedHold = true;
        } else if ((this.locked || this.switchedHold) && stillValid) {
            this.target = previous;
        } else {
            // The locked enemy left the cone (or died): the lock ends instead of moving to someone else.
            this.locked = false;
            this.switchedHold = false;
            this.target = pickTarget(from, mouseDir, pick, candidates) as Player | null;
        }
        this.switchRequested = false;
        if (this.target === null) {
            this.locked = false;
            this.switchedHold = false;
        }

        if (this.target !== previous && combatDebugOn()) {
            const t = this.target;
            combatDebug("aim", {
                target: t ? `sid ${t.sid}` : "none",
                dist: t ? Math.hypot(t.real_position.x - from.x, t.real_position.y - from.y) : 0,
                health: t ? t.health : 0,
                locked: this.locked,
                candidates: candidates.length
            });
        }
    }

    /** The projectile speed of `weaponId` (default: the weapon we hold), or 0 for melee. */
    private static heldProjectileSpeed(weaponId: number = Client.weaponIndex) {
        try {
            const projectile = getWeapon(weaponId).projectile;
            return projectile === undefined ? 0 : getProjectile(projectile).speed ?? 0;
        } catch {
            return 0;
        }
    }

    /** The direction to aim at `target` with the held weapon: its centre for melee, its predicted spot for ranged. */
    static aimAt(target: AimCandidate, weaponId: number = Client.weaponIndex) {
        const from = Client.player.real_position;
        const speed = this.heldProjectileSpeed(weaponId);
        const point = speed > 0 ? predictHit(from, target, speed, this.aimBuffer) : target.real_position;
        this.aimPoint = point;
        return Math.atan2(point.y - from.y, point.x - from.x);
    }

    /** Our manual swing's direction: `mouseDir`, or the assist's target when there is one in the cone. */
    static adjust(mouseDir: number) {
        this.aimPoint = null;
        if (!this.enabled() || !Client.player) return mouseDir;
        this.update();
        const target = this.target;
        if (!target) return mouseDir;
        return this.aimAt(target);
    }

    /**
     * "Lead Falcon's Ranged Shots": the direction for one of Falcon's own attacks aimed at the nearest enemy, led when
     * the attack's weapon fires a projectile. Returns `plainDir` unchanged otherwise (and while the option is off).
     * `weaponId` is the weapon the attack uses (default: the held one). A combo can switch to the musket in the same
     * tick as the shot, so the held weapon is still the polearm then and the shot went out without a lead.
     */
    static leadOwnShot(plainDir: number, nearest: Player | null, weaponId: number = Client.weaponIndex) {
        if (!nearest || !this.enabled() || !Menu.getValue("aimAssist:leadOwnShots")) return plainDir;
        if (this.heldProjectileSpeed(weaponId) === 0) return plainDir;
        return this.aimAt(nearest, weaponId);
    }
}
