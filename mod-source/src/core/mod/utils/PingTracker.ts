
export default class PingTracker {
    private static pingHistory = new Float64Array(5);
    private static instantaneousPing = 50;

    private static head = 0;
    private static count = 0;

    static update(newPing: number) {
        this.instantaneousPing = newPing;

        this.pingHistory[this.head] = newPing;
        this.count = Math.min(this.count + 1, this.pingHistory.length);
        this.head = (this.head + 1) % this.pingHistory.length;
    }

    static getCurrentPing() {
        return this.instantaneousPing;
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