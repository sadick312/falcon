import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import Menu from "@menu/Menu";

/** Tunables for the performance panel and the numbers Test Mode samples. */
export const PERF_CONFIG = {
    /** Samples kept per series. 120 frames is ~2s at 60 FPS; 120 ticks is ~13s at 9 ticks/s. */
    windowSize: 120,
    /** How often the panel text is rewritten. Never per frame. */
    panelRefreshMs: 500,
    toggleKey: "F8"
} as const;

class RingBuffer {
    private values: Float64Array;
    private index = 0;
    private count = 0;

    constructor(size: number) {
        this.values = new Float64Array(size);
    }

    push(value: number) {
        this.values[this.index] = value;
        this.index = (this.index + 1) % this.values.length;
        if (this.count < this.values.length) this.count++;
    }

    average() {
        let sum = 0;
        for (let i = 0; i < this.count; i++) sum += this.values[i];
        return this.count ? sum / this.count : 0;
    }

    max() {
        let max = 0;
        for (let i = 0; i < this.count; i++) if (this.values[i] > max) max = this.values[i];
        return max;
    }

    clear() {
        this.index = this.count = 0;
    }
}

export interface PerfSnapshot {
    fps: number;
    ping: number;
    tickAvgMs: number;
    tickMaxMs: number;
    frameAvgMs: number;
    frameMaxMs: number;
    nearbyObjects: number;
}

/**
 * Measures Falcon's cost: the mod brain per server tick, the renderer per frame, and FPS.
 * Recording is a few float writes; the panel's DOM is only touched every PERF_CONFIG.panelRefreshMs.
 */
export default class PerfMonitor {
    private static tickTimes = new RingBuffer(PERF_CONFIG.windowSize);
    private static frameTimes = new RingBuffer(PERF_CONFIG.windowSize);

    static fps = 0;
    private static panel: HTMLDivElement | null = null;
    private static lastPanelUpdate = 0;
    private static nearbyBuffer: unknown[] = [];

    static recordTick(ms: number) {
        this.tickTimes.push(ms);
    }

    static recordFrame(ms: number, fps: number) {
        this.frameTimes.push(ms);
        this.fps = fps;

        const now = performance.now();
        if (now - this.lastPanelUpdate < PERF_CONFIG.panelRefreshMs) return;
        this.lastPanelUpdate = now;
        this.updatePanel();
    }

    /** Clears the windows so a Test Mode sample only covers its own phase. */
    static reset() {
        this.tickTimes.clear();
        this.frameTimes.clear();
    }

    static snapshot(): PerfSnapshot {
        let nearbyObjects = 0;
        const player = Client.player;

        if (player) {
            this.nearbyBuffer.length = 0;
            nearbyObjects = ObjectManager.getObjects(player.real_position.x, player.real_position.y, this.nearbyBuffer as any).length;
            this.nearbyBuffer.length = 0;
        }

        return {
            fps: this.fps,
            ping: Client.pingTime ?? 0,
            tickAvgMs: this.tickTimes.average(),
            tickMaxMs: this.tickTimes.max(),
            frameAvgMs: this.frameTimes.average(),
            frameMaxMs: this.frameTimes.max(),
            nearbyObjects
        };
    }

    static togglePanel() {
        Menu.setValue("perfPanel", !Menu.getValue("perfPanel"));
        this.updatePanel();
    }

    private static getPanel() {
        if (this.panel) return this.panel;

        const panel = this.panel = document.createElement("div");
        panel.id = "falconPerfPanel";
        panel.style.cssText = "position:fixed;top:8px;right:8px;z-index:9999;padding:6px 10px;border-radius:6px;" +
            "background:rgba(0,0,0,.55);color:#fff;font:12px monospace;white-space:pre;pointer-events:none;display:none";
        document.body.appendChild(panel);
        return panel;
    }

    private static updatePanel() {
        const enabled = !!Menu.getValue("perfPanel");
        if (!enabled && !this.panel) return;

        const panel = this.getPanel();
        panel.style.display = enabled ? "block" : "none";
        if (!enabled) return;

        const s = this.snapshot();
        panel.textContent =
            `FPS ${s.fps}  ping ${s.ping} ms\n` +
            `tick ${s.tickAvgMs.toFixed(2)} ms avg, ${s.tickMaxMs.toFixed(2)} max\n` +
            `frame ${s.frameAvgMs.toFixed(2)} ms avg, ${s.frameMaxMs.toFixed(2)} max\n` +
            `objects nearby ${s.nearbyObjects}`;
    }
}
