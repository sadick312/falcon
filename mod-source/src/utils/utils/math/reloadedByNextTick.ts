import ScriptConfig from "@utils/config/ScriptConfig";

/**
 * Whether a weapon (or the turret) at `reload` (0-1) is fully reloaded after one more server tick, given its reload
 * time in ms. Written exactly as the callers had it, so results don't change by a single rounding step.
 */
export default function reloadedByNextTick(reload: number, reloadTimeMs: number) {
    return reload + ScriptConfig.SERVER_UPDATE_SPEED / reloadTimeMs >= 1;
}
