import PingTracker from "@core/mod/utils/PingTracker";
import Menu from "@menu/Menu";
import ScriptConfig from "@utils/config/ScriptConfig";

/**
 * The one place that turns ping into timings, for combat and defense alike.
 * A packet takes half the round trip to reach the server; a reply takes the whole round trip.
 * Every value here is the formula its caller used before, so play doesn't change.
 */
export default class Timing {
    /** The "Jitter-Safe Timing" room: the ping jitter when that setting is on, else 0. */
    static jitterMargin() {
        return PingTracker.jitterMargin(Menu.getValue("jitterSafeTiming") === true);
    }

    /** Time for a packet of ours to reach the server: half the stable round trip. */
    static oneWayMs() {
        return PingTracker.getStablePing() / 2;
    }

    /** Server ticks a round trip takes (plus `extraMs`), rounded up. */
    static roundTripTicks(extraMs = 0) {
        return Math.ceil((PingTracker.getStablePing() + extraMs) / ScriptConfig.SERVER_UPDATE_SPEED);
    }

    /**
     * How long to wait from `now` before sending, so the packet reaches the server right as its next tick starts.
     * `lastTick` is when the last tick arrived; with "Smoothed Tick Clock" on, the smoothed estimate replaces it.
     * Negative: send now (it's already late).
     */
    static waitForNextTick(now: number, lastTick: number, padding: number) {
        const waitMs = ScriptConfig.SERVER_UPDATE_SPEED - PingTracker.getStablePing() + padding + this.jitterMargin();
        return waitMs - (now - this.tickBase(lastTick));
    }

    // ---- Smoothed Tick Clock -------------------------------------------------------------------------------------

    /** Weight of a new arrival: 1/8, so one late tick moves the estimate by an eighth of its delay. */
    private static readonly CLOCK_WEIGHT = 1 / 8;
    /** A tick further than this from the estimate is a stall or a new connection: start again from it. */
    private static readonly CLOCK_RESET_MS = 3 * ScriptConfig.SERVER_UPDATE_SPEED;

    private static clockTick = NaN;

    /**
     * A real server tick arrived at `now`. The server sends one every tick and the connection never drops one (it
     * only delays it), so each arrival is the estimate plus one tick; how far off it is moves the estimate an eighth
     * of the way. One late tick (Wi-Fi) shifts it by 1/8 of its delay, while a lasting change catches up in ~10 ticks.
     */
    static onRealTick(now: number) {
        const predicted = this.clockTick + ScriptConfig.SERVER_UPDATE_SPEED;
        const error = now - predicted;
        if (!(Math.abs(error) <= this.CLOCK_RESET_MS)) {
            this.clockTick = now;
            return;
        }
        this.clockTick = predicted + error * this.CLOCK_WEIGHT;
    }

    static resetTickClock() {
        this.clockTick = NaN;
    }

    /** When the last tick "should" have arrived, smoothed (NaN before the first tick). */
    static smoothedTickTime() {
        return this.clockTick;
    }

    /** `lastTick`, or the smoothed estimate with "Smoothed Tick Clock" on (once it has one). */
    private static tickBase(lastTick: number) {
        if (Menu.getValue("smoothedTickClock") !== true || isNaN(this.clockTick)) return lastTick;
        return this.clockTick;
    }
}
