import ScriptConfig from "@utils/config/ScriptConfig";

export default class HealerUtils {
    static readonly RELOAD_BUFFER = 0.9;

    /**
     * Whether an enemy weapon counts as a threat for the next server tick. Default: 90%+ reloaded, a margin that counts
     * slow weapons a tick early only some of the time (a polearm moves ~16% per tick). With "Exact Threat Reload"
     * (`exact`): fully reloaded now, which is exactly when its hit can land next tick (Falcon sees a weapon ready on
     * the last tick before the server lets it swing; see test/features/reload-timing.test.ts).
     */
    static isThreatReady(reload: number, exact: boolean) {
        return exact ? reload >= 1 : reload >= this.RELOAD_BUFFER;
    }

    /**
     * "Ping-Aware Defense" (`pingAware`): with a round trip over one tick our hat or food reaches the server a tick
     * later, so the threat rule (isThreatReady, either mode) is applied one tick ahead: to the reload the weapon will
     * have after one more tick. Off: exactly isThreatReady.
     * shortcut: uses the weapon's base reload, not the enemy's Samurai Armor speed-up; add it if it misses live.
     */
    static isThreatReadyForPing(reload: number, exact: boolean, reloadMs: number, pingAware: boolean) {
        return this.isThreatReady(pingAware ? reload + ScriptConfig.SERVER_UPDATE_SPEED / reloadMs : reload, exact);
    }

    static getFoodValue(foodId: number) {
        if (foodId === 0) return 20;
        if (foodId === 1) return 40;
        return 30;
    }
}