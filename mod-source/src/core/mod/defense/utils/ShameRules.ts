import Player from "@constants/Player";

/**
 * 1.8.2 "shame" rule, measured live on sandbox.moomodding.io:
 * eating within 120 ms (server time) of taking damage adds 1 shame, otherwise -2;
 * 8 shame = Shame hat for 30 s (can't eat).
 *
 * The server sees our eat ~RTT after we saw the damage packet (damage packet travels to us,
 * eat packet travels back), so eating is shame-free once (time since hit) + RTT > 120 ms.
 * Verified: RTT 105 + 0 ms wait -> shamed; RTT 94 + 40 ms -> not; RTT 199 + 0 ms -> not.
 */
export default class ShameRules {
    static readonly WINDOW_MS = 120;
    /** Extra safety for ping jitter. */
    static readonly SAFETY_MS = 15;

    /** Heals that never call the server's eat code (regen hats/tails, healing pad, cheese over time). */
    private static readonly NON_FOOD_HEALS = new Set([1, 3, 4, 6, 10, 15]);
    private static readonly FOOD_HEALS = new Set([20, 30, 40]);

    /** Best guess whether a health increase came from eating (only eating changes shame). */
    static isFoodHeal(delta: number, newHealth: number, maxHealth: number) {
        if (this.FOOD_HEALS.has(delta)) return true;
        // A food heal that was capped at max health shows a smaller delta.
        return newHealth >= maxHealth && delta < 40 && !this.NON_FOOD_HEALS.has(delta);
    }

    /** Did the server count this eat as "too soon after a hit"? (both packet times are receive times) */
    static wasShameEat(player: Pick<Player, "hitTimeMs">, now: number) {
        return player.hitTimeMs > 0 && now - player.hitTimeMs <= this.WINDOW_MS;
    }

    /**
     * Our own shame, counted when we SEND an eat. The server runs the shame rule for every eat it
     * receives, even one that fails at full health (the check happens before the food is used), and
     * a failed eat produces no health packet - so counting from health packets undercounted (live:
     * Falcon thought 5 when the server applied Shame). The server sees our eat ~RTT after we saw
     * the hit, so the gap it measures is (now - hit receive time) + RTT.
     */
    static onOwnEat(player: Pick<Player, "hitTimeMs" | "hitTime" | "shameCount">, rtt: number, now: number = performance.now()): "none" | "safe" | "shame" | "shamed" {
        if (!player.hitTimeMs) return "none";

        let result: "safe" | "shame" | "shamed" = "safe";
        if (now - player.hitTimeMs + rtt <= this.WINDOW_MS) {
            player.shameCount++;
            result = "shame";
            if (player.shameCount > 7) {
                player.shameCount = 0; // 8th strike: server applies Shame and resets
                result = "shamed";
            }
        } else {
            player.shameCount = Math.max(0, player.shameCount - 2);
        }

        player.hitTime = 0;
        player.hitTimeMs = 0;
        return result;
    }

    /** Default for the "Shame Guard From" setting (the old fixed value). */
    static readonly DEFAULT_GUARD_FROM = 6;
    /** Below this health an emergency heal always goes out at once (one more hit could kill). */
    static readonly GUARD_HP_FLOOR = 40;

    /**
     * Shame guard: should an emergency heal wait for the shame-free moment (at most ~135 ms)
     * instead of eating now? Only when eating now would add shame, shame is already at or above
     * `guardFrom`, and health is above the floor.
     */
    static shouldDeferEmergencyHeal(shameCount: number, health: number, waitMs: number, guardFrom: number) {
        return waitMs > 0 && shameCount >= guardFrom && health > this.GUARD_HP_FLOOR;
    }

    /**
     * Milliseconds to wait before eating so it won't add shame. 0 = safe now.
     * Pass the lowest plausible RTT (riskiest case: the server sees our eat sooner).
     */
    static msUntilSafeEat(player: Pick<Player, "hitTimeMs">, lowRtt: number, now: number = performance.now()) {
        if (!player.hitTimeMs) return 0;
        const rtt = lowRtt;
        return Math.max(0, this.WINDOW_MS + this.SAFETY_MS - (now - player.hitTimeMs) - rtt);
    }
}
