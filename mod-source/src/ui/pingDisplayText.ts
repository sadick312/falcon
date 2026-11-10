import PingTracker from "@core/mod/utils/PingTracker";
import PacketBatcher from "@core/utils/PacketBatcher";
import { frameStats } from "@rendering/FrameStats";

/**
 * The ping display's text, shared by the pong handler and the once-a-second FPS update:
 * the last ping, the stable (median) ping, how much the ping jumps, then FPS, the batch window and how unevenly
 * the server's ticks arrive ("tick jitter", from PacketBatcher; not the same thing as ping jitter).
 */
export function pingDisplayText() {
    const current = Math.round(PingTracker.getCurrentPing());
    const stable = Math.round(PingTracker.getStablePing());
    const jitter = PingTracker.getJitter().toFixed(1);
    return `Ping: ${current} ms (stable ${stable}, jitter ${jitter}) | FPS: ${frameStats.fps} | ` +
        `BWin: ${PacketBatcher.effectiveBatchWindow.toFixed(1)} ms | Tick jitter: ${PacketBatcher.tickJitter.toFixed(1)} ms`;
}
