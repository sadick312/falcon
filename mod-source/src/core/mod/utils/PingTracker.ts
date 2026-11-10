/**
 * Round-trip time samples from Falcon's ping packet ("0"), sent once per second.
 * Sends are queued (FIFO) so a delayed reply during a lag spike is matched to its own send time;
 * previously each send overwrote the last, so lag spikes showed up as *low* ping.
 */
export default class PingTracker {
    private static readonly SIZE = 8;
    private static pingHistory = new Float64Array(PingTracker.SIZE);
    private static sorted = new Float64Array(PingTracker.SIZE);
    private static instantaneousPing = 50;

    private static head = 0;
    private static count = 0;

    /** performance.now() of pings we sent and haven't had a reply for yet (oldest first). */
    private static outstanding: number[] = [];

    static onSent(now: number = performance.now()) {
        this.outstanding.push(now);
        // Replies that never came back (packet loss) shouldn't pile up forever.
        if (this.outstanding.length > 5) this.outstanding.shift();
    }

    /** Matches a reply to the oldest outstanding send; returns the RTT or -1 if nothing was pending. */
    static onReply(now: number = performance.now()) {
        const sentAt = this.outstanding.shift();
        if (sentAt === undefined) return -1;

        const rtt = now - sentAt;
        this.update(rtt);
        return rtt;
    }

    /** How long the oldest unanswered ping has been waiting (0 if none). Grows during lag spikes. */
    static getOldestOutstandingAge(now: number = performance.now()) {
        return this.outstanding.length ? now - this.outstanding[0] : 0;
    }

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
        for (let i = 0; i < this.count; i++) total += this.pingHistory[i];
        return total / this.count;
    }

    /** Median of recent samples: ignores one-off spikes better than the average. */
    static getMedianPing() {
        if (this.count === 0) return this.instantaneousPing;
        const sorted = this.sorted.subarray(0, this.count);
        sorted.set(this.pingHistory.subarray(0, this.count));
        sorted.sort();
        return this.count % 2 ? sorted[this.count >> 1] : (sorted[this.count / 2 - 1] + sorted[this.count / 2]) / 2;
    }

    /** Lowest recent round-trip time (used where underestimating ping is the risk). */
    static getMinPing() {
        if (this.count === 0) return this.instantaneousPing;
        let min = Infinity;
        for (let i = 0; i < this.count; i++) min = Math.min(min, this.pingHistory[i]);
        return min;
    }

    /** Average distance of samples from the median, in ms. */
    static getJitter() {
        if (this.count < 2) return 0;
        const median = this.getMedianPing();
        let total = 0;
        for (let i = 0; i < this.count; i++) total += Math.abs(this.pingHistory[i] - median);
        return total / this.count;
    }

    static reset() {
        this.count = 0;
        this.head = 0;
        this.outstanding.length = 0;
    }
}
