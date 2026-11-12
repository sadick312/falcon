import { Point } from "@mod-types/index";

/** A jump bigger than this in one server tick is a respawn/teleport, not movement. */
export const MAX_REAL_STEP = 100;

/**
 * "Accurate Movement Prediction": every tick our predicted next state (player.next_state) gets its
 * position reset to the real one, but its speed used to carry over from the last guess. Knockback
 * was then added on top every tick, so the guessed speed kept growing, the guess "hit a spike"
 * almost every tick and Auto Heal panic-ate right after hits (shame).
 *
 * This sets the guessed speed from how far we really moved last tick (same formula as
 * Player.getSimulationState), before this tick's knockback is added.
 */
export function resyncPredictedVelocity(
    state: { velX: number; velY: number },
    real: Point,
    last: Point,
    trapped: boolean,
    tickMs: number,
    deceleration: number
) {
    const dx = real.x - last.x;
    const dy = real.y - last.y;

    if (trapped || Math.abs(dx) > MAX_REAL_STEP || Math.abs(dy) > MAX_REAL_STEP) {
        state.velX = 0;
        state.velY = 0;
        return;
    }

    let velX = dx / tickMs * deceleration;
    let velY = dy / tickMs * deceleration;
    if (Math.abs(velX) <= 0.01) velX = 0;
    if (Math.abs(velY) <= 0.01) velY = 0;

    state.velX = velX;
    state.velY = velY;
}
