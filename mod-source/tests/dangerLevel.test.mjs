import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { dangerLevel, DangerHold, DANGER_HOLD_MS } = await loadTs("src/core/mod/utils/DangerLevel.ts");

test("dangerLevel: safe, danger and can-kill", () => {
    assert.equal(dangerLevel(0, 100, 50), 0);
    assert.equal(dangerLevel(49, 100, 50), 0);
    assert.equal(dangerLevel(50, 100, 50), 1);
    assert.equal(dangerLevel(60, 60, 50), 2);   // hit as big as our health
    assert.equal(dangerLevel(35, 30, 50), 2);   // low health: small hit can still kill
    assert.equal(dangerLevel(NaN, 100, 50), 0);
    assert.equal(dangerLevel(80, 0, 50), 0);    // dead: no warning
});

test("DangerHold keeps the warning steady between server updates, then clears it", () => {
    const hold = new DangerHold();
    assert.equal(hold.update(1, 55, 0), 1);
    assert.equal(hold.update(0, 0, 100), 1);                     // one quiet update: still shown
    assert.equal(hold.update(2, 90, 150), 2);                    // gets worse right away
    assert.equal(hold.update(1, 55, 200), 2);                    // doesn't drop a level instantly
    assert.equal(hold.damage, 90);
    assert.equal(hold.update(0, 0, 150 + DANGER_HOLD_MS), 0);    // gone after the hold time
});
