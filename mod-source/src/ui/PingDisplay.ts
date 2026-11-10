import Client from "@core/Client";
import Latency from "@core/mod/utils/Latency";
import PingTracker from "@core/mod/utils/PingTracker";
import PacketBatcher from "@core/utils/PacketBatcher";
import Menu from "@menu/Menu";
import getElem from "@utils/dom/getElem";

const pingDisplay = getElem<"div">("ping-display");

/** Top-of-screen status line. Ping is the median of recent samples, ± is jitter. */
export default function updatePingDisplay(fps: number) {
    if (Menu.getValue("showPingDisplay") === false) {
        pingDisplay.style.display = "none";
        return;
    }

    pingDisplay.style.display = "";
    const rtt = Math.round(PingTracker.getMedianPing());
    const jitter = Math.round(PingTracker.getJitter());
    const adjust = Latency.getAdjustment();
    const lag = Client.socket && Latency.isLagging() ? " | LAG SPIKE" : "";

    pingDisplay.innerText =
        `Ping: ${rtt} ms (±${jitter})${adjust ? ` adj ${adjust > 0 ? "+" : ""}${adjust}` : ""} | FPS: ${fps}` +
        ` | BWin: ${PacketBatcher.effectiveBatchWindow.toFixed(1)} ms${lag}`;
}
