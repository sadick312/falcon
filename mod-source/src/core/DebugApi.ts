import AutoPlacer from "@placing/modules/AutoPlacer";
import DebugStats from "@core/DebugStats";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import AttackManager from "@core/mod/combat/core/AttackManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import PlayerUpdateEvent from "@core/socket/events/core/PlayerUpdateEvent";
import Latency from "@core/mod/utils/Latency";
import Client from "@core/Client";
import PingTracker from "@core/mod/utils/PingTracker";
import ModManager from "@core/ModManager";

declare global {
    interface Window {
        falconDebug?: Record<string, unknown>;
    }
}

/**
 * Read-only state for automated tests and troubleshooting. Off unless localStorage
 * "falcon-debug-api" is "1" (type `localStorage.setItem("falcon-debug-api", "1")` in the console).
 */
export default function installDebugApi(force = false) {
    if (window.falconDebug) return;
    if (!force && localStorage.getItem("falcon-debug-api") !== "1") return;

    window.falconDebug = {
        get sid() { return Client.mySID; },
        get alive() { return Client.isAlive; },
        get position() { const p = Client.player; return p ? { x: p.real_position.x, y: p.real_position.y } : null; },
        get health() { return Client.player?.health ?? null; },
        get shameCount() { return Client.player?.shameCount ?? null; },
        get hat() { return Client.player?.skinIndex ?? null; },
        get weapon() { return Client.player?.weaponIndex ?? null; },
        get weapons() { return Client.player ? [...Client.player.weapons] : null; },
        get items() { return Client.player ? [...Client.player.items] : null; },
        get ping() { return { median: PingTracker.getMedianPing(), min: PingTracker.getMinPing(), jitter: PingTracker.getJitter(), rtt: Latency.getRtt(), lead: Latency.getActionLeadMs(), lagging: Latency.isLagging() }; },
        get activity() { return [...ModManager.brainState.activityList]; }, // last completed tick
        get brain() { return ModManager.brainState; },
        /** True while Insta Now (R) is armed and waiting for a chance to fire. */
        get instaArmed() { return AttackManager.autoInstaToggle; },
        /** Auto Place: candidate spots this tick, chosen spots, and the best few (item id, grade). */
        get placement() {
            const c = PlacementSystem.angleCandidates;
            return { candidates: c.length, chosen: PlacementSystem.bestAngles.length, top: c.slice(0, 4).map(a => [a.id, Math.round(a.grade * 100) / 100]) };
        },
        get autoPlace() { return { ...AutoPlacer.lastDecision }; },
        get itemSelects() { return { ...DebugStats.itemSelects }; },
        get collapsedUpdates() { return PlayerUpdateEvent.collapsedUpdates; },
        /** What Falcon believes player `sid` carries (primary/secondary, confirmed or assumed) and reload state. */
        weaponData(sid: number) {
            const p = PlayerManager.get(sid);
            if (!p) return null;
            const w = p.weaponData;
            return {
                primary: w.primary, primaryConfirmed: w.primaryConfirmed, primaryVariant: w.primaryVariant,
                secondary: w.secondary, secondaryConfirmed: w.secondaryConfirmed,
                reloadPrimary: p.getReload(0), reloadSecondary: p.getReload(1), holding: p.weaponIndex, hat: p.skinIndex
            };
        },
        /** Where Falcon thinks player `sid` is now and will be after `ms`, plus the musket lead it would use. */
        predict(sid: number, ms?: number) {
            const target = PlayerManager.get(sid);
            const me = Client.player;
            if (!target || !me) return null;
            const lead = ms ?? Latency.getActionLeadMs();
            const out = Latency.predict(target, lead, { x: 0, y: 0 });
            return { now: { ...target.real_position }, predicted: out, lead, aim: ModManager.getPredictedAimAngle(15) };
        },
    };
}
