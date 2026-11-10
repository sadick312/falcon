// Run with: npm test --workspace=mod-source
// Uses a real 1.8.2 player packet shape captured from sandbox.moomodding.io.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { default: LegacyAdapter } = await loadTs("src/core/socket/LegacyAdapter.ts");

test("players: splits 13-value records into positions/attributes and scales direction", () => {
    LegacyAdapter.reset();
    const pkt = [2, 9036.43, 10364.71, 0.5, -1, 4, 1, null, false, 7, 11, 0, 0,
        3, 100, 200, -1.2, 5, 15, 2, "t", true, 59, 21, 1, 1];
    const [pos, attr, hidden] = LegacyAdapter.players(pkt);
    assert.deepEqual(pos, [2, 9036.43, 10364.71, 50, 3, 100, 200, -120]);
    assert.deepEqual(attr, [2, -1, 4, 1, null, false, 7, 11, 0, 0, 3, 5, 15, 2, "t", true, 59, 21, 1, 1]);
    assert.deepEqual(hidden, []);
    assert.deepEqual(LegacyAdapter.players(pkt.slice(0, 13))[2], [3], "player 3 left view");
});

test("ais: pads to 8 values, scales direction, handles null", () => {
    LegacyAdapter.reset();
    const [data, hidden] = LegacyAdapter.ais([5, 1, 10, 20, 0.25, 100, 3]);
    assert.deepEqual(data, [5, 1, 10, 20, 25, 100, 3, 0]);
    assert.deepEqual(hidden, []);
    assert.deepEqual(LegacyAdapter.ais(null), [[], [5]]);
});
