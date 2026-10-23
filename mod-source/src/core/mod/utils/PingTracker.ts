
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

    static getAveragePing() {
        if (this.count === 0) return this.instantaneousPing;
        let total = 0;

        for (let i = 0; i < this.count; i++) {
            total += this.pingHistory[i];
        }

        return total / this.count;
    }

    private static sortBuffer = new Float64Array(5);

    /** Median of recent pings. A single Wi-Fi spike doesn't move it, unlike the current or average ping. */
    static getStablePing() {
        if (this.count === 0) return this.instantaneousPing;

        const sorted = this.sortBuffer.subarray(0, this.count);
        sorted.set(this.pingHistory.subarray(0, this.count));
        sorted.sort();

        const mid = this.count >> 1;
        return this.count % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
}