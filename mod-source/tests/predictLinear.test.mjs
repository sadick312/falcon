// Run with: npm test --workspace=mod-source
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { default: predictLinear } = await loadTs("src/utils/utils/geometry/predictLinear.ts");
const TICK = 111;

test("one tick ahead continues the last tick's movement", () => {
    assert.deepEqual(predictLinear({ x: 110, y: 50 }, { x: 100, y: 50 }, TICK, TICK, { x: 0, y: 0 }), { x: 120, y: 50 });
});

test("half a tick and zero time", () => {
    assert.deepEqual(predictLinear({ x: 110, y: 0 }, { x: 100, y: 0 }, TICK / 2, TICK, { x: 0, y: 0 }), { x: 115, y: 0 });
    assert.deepEqual(predictLinear({ x: 110, y: 0 }, { x: 100, y: 0 }, 0, TICK, { x: 0, y: 0 }), { x: 110, y: 0 });
});

test("caps very long predictions (lag) and ignores negative time", () => {
    const capped = predictLinear({ x: 0, y: 0 }, { x: -11.1, y: 0 }, 5000, TICK, { x: 0, y: 0 });
    assert.ok(Math.abs(capped.x - 60) < 1e-9, "600 ms cap -> 600/111 ticks * 11.1");
    assert.deepEqual(predictLinear({ x: 5, y: 5 }, { x: 0, y: 0 }, -50, TICK, { x: 0, y: 0 }), { x: 5, y: 5 });
});
