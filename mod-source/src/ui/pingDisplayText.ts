import PingTracker from "@core/mod/utils/PingTracker";
import PacketBatcher from "@core/utils/PacketBatcher";
import Menu from "@menu/Menu";
import { frameStats } from "@rendering/FrameStats";

/**
 * The ping display's text, shared by the pong handler and the once-a-second FPS update, in the original Falcon
 * format: the last ping, FPS and the batch window. "Ping Details" adds the stable ping, jitter and tick jitter.
 */
export function pingDisplayText() {
    const current = Math.round(PingTracker.getCurrentPing());
    const line = `Ping: ${current} ms | FPS: ${frameStats.fps} | BWin: ${PacketBatcher.effectiveBatchWindow.toFixed(1)} ms`;
    if (Menu.getValue("pingDetails") !== true) return line;
    return `${line} | Stable: ${Math.round(PingTracker.getStablePing())} ms | Jitter: ${Math.round(PingTracker.getJitter())} ms` +
        ` | Tick jitter: ${Math.round(PacketBatcher.tickJitter)} ms`;
}
