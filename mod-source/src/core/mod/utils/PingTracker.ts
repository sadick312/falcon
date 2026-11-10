/**
 * Round-trip time to the game server, from SocketListener's once-a-second ping (only clean samples reach update:
 * see SocketListener's pong handler). Three views of it:
 *  - current: the last sample;
 *  - stable: the median of the last 5, so one Wi-Fi spike doesn't move it, while a real change (3 samples in a row)
 *    does, after about 3 s. Auto Place's preplacement timing, the packet budget and the "did we just eat" check use it;
 *  - jitter: how much the ping jumps between samples (a smoothed average of the change from one sample to the next).
 */
export default class PingTracker {
    /** Used until the first sample arrives (also right after a reconnect). */
    private static readonly DEFAULT_PING = 50;
    /** Weight of a new sample in the jitter average: 1/4, so it follows within a few seconds at one sample a second. */
    private static readonly JITTER_WEIGHT = 1 / 4;

    private static pingHistory = new Float64Array(5);
    private static instantaneousPing = PingTracker.DEFAULT_PING;
    private static jitter = 0;
    private static lastSample: number | null = null;

    private static head = 0;
    private static count = 0;

    static update(newPing: number) {
        this.instantaneousPing = newPing;

        if (this.lastSample !== null) {
            this.jitter += (Math.abs(newPing - this.lastSample) - this.jitter) * this.JITTER_WEIGHT;
        }
        this.lastSample = newPing;

        this.pingHistory[this.head] = newPing;
        this.count = Math.min(this.count + 1, this.pingHistory.length);
        this.head = (this.head + 1) % this.pingHistory.length;
    }

    /** Forgets every sample: a new connection (maybe another server) starts from the default again. */
    static reset() {
        this.pingHistory.fill(0);
        this.instantaneousPing = this.DEFAULT_PING;
        this.jitter = 0;
        this.lastSample = null;
        this.head = 0;
        this.count = 0;
    }

    static getCurrentPing() {
        return this.instantaneousPing;
    }

    /** Average change between consecutive samples, in ms (0 until two samples arrived). */
    static getJitter() {
        return this.jitter;
    }

    /**
     * Extra room for timings that depend on ping, for the "Jitter-Safe Timing" setting: the jitter when it is on
     * (`enabled`), 0 when it is off, so the timings are exactly as before. Callers pass the setting in so this file
     * stays free of the menu.
     */
    static jitterMargin(enabled: boolean) {
        return enabled ? this.jitter : 0;
    }

    /** Samples taken since the last reset (at most the 5 the median uses). */
    static get sampleCount() {
        return this.count;
    }

    private static sortBuffer = new Float64Array(5);

    /** Median of recent pings. A single Wi-Fi spike doesn't move it, unlike the current or average ping. */
    static getStablePing() {
        if (this.count === 0) return this.instantaneousPing;

        const sorted = this.sortBuffer.subarray(0, this.count);
        sorted.set(this.pingHistory.subarray(0, this.count));
        sorted.sort();

        // The median. count > 0 here, so `upper` always exists, and `lower` too when count is even.
        const mid = this.count >> 1;
        const upper = sorted[mid];
        const lower = sorted[mid - 1];
        if (upper === undefined) return this.instantaneousPing;
        return this.count % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2;
    }
}
