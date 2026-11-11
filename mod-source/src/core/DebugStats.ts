/**
 * Lightweight counters for Debug Mode. Always counted (a few integer increments per packet);
 * only shown/logged when Debug Mode is on.
 */
export default class DebugStats {
    static sentTotal = 0;
    static receivedTotal = 0;
    static errorCount = 0;
    static lastError = "";
    /** Set by the menu toggle "Log Packets"; checked on every packet so keep it a plain field. */
    static logPackets = false;

    // Packet types that arrive many times per second and would flood the console.
    private static readonly NOISY = new Set(["a", "I", "0", "7", "G", "5"]);

    /** Item selections sent ("z" with isWeapon=false), per item id: shows what Falcon tries to place/eat. */
    static itemSelects: Record<number, number> = {};

    /** Latest Auto Place decision, written by AutoPlacer (kept here so the overlay needs no AutoPlacer import). */
    static autoPlace = { best: 0, allowed: 0 };

    static onSent(type: string, data: unknown[]) {
        this.sentTotal++;
        if (type === "z" && data[1] === false) {
            const id = data[0] as number;
            this.itemSelects[id] = (this.itemSelects[id] ?? 0) + 1;
        }
        if (this.logPackets && !this.NOISY.has(type)) console.debug("[Falcon] send", type, JSON.stringify(data));
    }

    static onReceived(type: string, data: unknown) {
        this.receivedTotal++;
        if (this.logPackets && !this.NOISY.has(type)) console.debug("[Falcon] recv", type, JSON.stringify(data)?.slice(0, 200));
    }

    static onError(message: string) {
        this.errorCount++;
        this.lastError = message.slice(0, 160);
    }
}

// Catch errors from anywhere on the page (Falcon runs as an inline script, so they all land here).
window.addEventListener("error", (event) => {
    // Ignore the site's own game script (in hook mode its leftover ping timer throws every 2.5 s).
    if (/\/assets\/bundle\.js/.test(event.filename || "")) return;
    DebugStats.onError(event.message || String(event.error));
});
window.addEventListener("unhandledrejection", (event) => DebugStats.onError("Unhandled promise: " + String(event.reason)));
