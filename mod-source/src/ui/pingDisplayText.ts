import PingTracker from "@core/mod/utils/PingTracker";
import PacketBatcher from "@core/utils/PacketBatcher";
import { frameStats } from "@rendering/FrameStats";

/**
 * The ping display's text, shared by the pong handler and the once-a-second FPS update, in the original Falcon
 * format: the last ping, FPS and the batch window.
 */
export function pingDisplayText() {
    const current = Math.round(PingTracker.getCurrentPing());
    return `Ping: ${current} ms | FPS: ${frameStats.fps} | BWin: ${PacketBatcher.effectiveBatchWindow.toFixed(1)} ms`;
}
