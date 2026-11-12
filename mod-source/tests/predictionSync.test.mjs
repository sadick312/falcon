// Run with: npm test --workspace=mod-source
// "Accurate Movement Prediction": the predicted next-tick speed must start from the real speed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { resyncPredictedVelocity, MAX_REAL_STEP } = await loadTs("src/core/mod/simulation/PredictionSync.ts");

const TICK = 111;
const DECEL = Math.pow(0.993, TICK);
const KNOCK = 0.3 + 0.3; // applyKnockbackOnState: weapon knock + 0.3, per enemy hit

test("old behaviour (no resync): knockback piles up every tick while standing still", () => {
    const state = { velX: 0, velY: 0 };
    for (let tick = 0; tick < 20; tick++) state.velX += KNOCK; // bull spam: hit every tick
    assert.ok(state.velX > 10, `guessed speed grew to ${state.velX.toFixed(1)} (real speed is 0)`);
});

test("with resync: the guess follows the real speed and knockback is added only once", () => {
    const state = { velX: 0, velY: 0 };
    const real = { x: 1000, y: 1000 }, last = { x: 1000, y: 1000 }; // standing still
    for (let tick = 0; tick < 20; tick++) {
        resyncPredictedVelocity(state, real, last, false, TICK, DECEL);
        state.velX += KNOCK;
    }
    assert.ok(Math.abs(state.velX - KNOCK) < 1e-9, `stays at one hit's knockback (${state.velX})`);
});

test("real movement becomes the guessed speed (same formula as Player.getSimulationState)", () => {
    const state = { velX: 76.3, velY: -40 }; // stale values like the ones measured in replays
    resyncPredictedVelocity(state, { x: 1050, y: 1000 }, { x: 1000, y: 1010 }, false, TICK, DECEL);
    assert.ok(Math.abs(state.velX - 50 / TICK * DECEL) < 1e-9);
    assert.ok(Math.abs(state.velY - -10 / TICK * DECEL) < 1e-9);
});

test("trapped, respawn/teleport jumps and tiny drift give speed 0", () => {
    const state = { velX: 5, velY: 5 };
    resyncPredictedVelocity(state, { x: 1050, y: 1000 }, { x: 1000, y: 1000 }, true, TICK, DECEL);
    assert.deepEqual(state, { velX: 0, velY: 0 }, "trapped");
    state.velX = 5;
    resyncPredictedVelocity(state, { x: 1000 + MAX_REAL_STEP + 1, y: 0 }, { x: 1000, y: 0 }, false, TICK, DECEL);
    assert.deepEqual(state, { velX: 0, velY: 0 }, "teleport");
    resyncPredictedVelocity(state, { x: 1000.5, y: 0 }, { x: 1000, y: 0 }, false, TICK, DECEL);
    assert.equal(state.velX, 0, "drift under 0.01 per ms");
});
