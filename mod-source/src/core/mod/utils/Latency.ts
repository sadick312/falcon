import Player from "@constants/Player";
import PingTracker from "@core/mod/utils/PingTracker";
import PlayerUpdateEvent from "@core/socket/events/core/PlayerUpdateEvent";
import Menu from "@menu/Menu";
import { Point } from "@mod-types/index";
import ScriptConfig from "@utils/config/ScriptConfig";

/**
 * One place for everything ping-related, so every feature adapts the same way.
 *
 * Timeline of one of our actions: we see the server's state ~RTT/2 after it happened, our packet
 * needs another ~RTT/2 to arrive, then waits on average half a server tick to be processed.
 * So an action we send now takes effect ~RTT + tick/2 after the state we're looking at.
 */
export default class Latency {
    static readonly TICK = ScriptConfig.SERVER_UPDATE_SPEED;

    /** Manual adjustment from the menu (Ping Compensation > Adjust), in ms. */
    static getAdjustment() {
        const value = parseInt(Menu.getValue("pingCompensationAdjust"));
        return isNaN(value) ? 0 : value;
    }

    /** Prediction/lead features can be turned off in the menu (Ping Compensation toggle). */
    static isCompensationEnabled() {
        return Menu.getValue("pingCompensation") !== false;
    }

    /** Best estimate of round-trip time in ms (median of recent samples + manual adjustment). */
    static getRtt() {
        return Math.max(0, PingTracker.getMedianPing() + this.getAdjustment());
    }

    /** Lowest plausible RTT: use where acting too early is the danger (e.g. shame window). */
    static getLowRtt() {
        return Math.max(0, PingTracker.getMinPing() + this.getAdjustment());
    }

    static getOneWay() {
        return this.getRtt() / 2;
    }

    /** ms between the newest state we have and when an action we send now takes effect. */
    static getActionLeadMs() {
        if (!this.isCompensationEnabled()) return this.TICK;
        return Math.max(this.TICK, this.getRtt() + this.TICK / 2);
    }

    /**
     * Lag spike: no player update for 3+ ticks, or a ping reply is very late.
     * While lagging, features shouldn't start new combos from stale data.
     */
    static isLagging(now: number = performance.now()) {
        const sinceUpdate = now - PlayerUpdateEvent.lastReceive;
        if (PlayerUpdateEvent.lastReceive > 0 && sinceUpdate > this.TICK * 3) return true;
        return PingTracker.getOldestOutstandingAge(now) > Math.max(1000, this.getRtt() * 3);
    }

    /**
     * Where `player` will be `ms` after its latest known position, assuming it keeps its
     * current velocity (measured over the last server tick). Capped to avoid wild guesses.
     */
    static predict(player: Player, ms: number, out: Point): Point {
        const real = player.real_position;
        const last = player.last_position;
        const ticks = Math.min(ms, 600) / this.TICK;

        out.x = real.x + (real.x - last.x) * ticks;
        out.y = real.y + (real.y - last.y) * ticks;
        return out;
    }
}
