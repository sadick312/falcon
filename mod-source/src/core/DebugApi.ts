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
export default function installDebugApi() {
    if (localStorage.getItem("falcon-debug-api") !== "1") return;

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
        get collapsedUpdates() { return PlayerUpdateEvent.collapsedUpdates; },
    };
}
