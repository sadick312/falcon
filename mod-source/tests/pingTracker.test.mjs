// Run with: npm test --workspace=mod-source
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { default: PingTracker } = await loadTs("src/core/mod/utils/PingTracker.ts");

test("replies are matched to their own send time (FIFO)", () => {
    PingTracker.reset();
    PingTracker.onSent(1000);
    PingTracker.onSent(2000);           // reply to the first ping is late (lag spike)
    assert.equal(PingTracker.onReply(2600), 1600, "late reply measures the real 1600 ms, not 600");
    assert.equal(PingTracker.onReply(2700), 700);
    assert.equal(PingTracker.onReply(2800), -1, "no outstanding ping");
});

test("median ignores a single spike; min and jitter", () => {
    PingTracker.reset();
    for (const rtt of [100, 102, 98, 101, 900, 99]) PingTracker.update(rtt);
    assert.equal(PingTracker.getMedianPing(), 100.5);
    assert.equal(PingTracker.getMinPing(), 98);
    assert.ok(PingTracker.getAveragePing() > 200, "average is dragged up by the spike");
    assert.ok(PingTracker.getJitter() > 0);
});

test("oldest outstanding age grows while a reply is missing", () => {
    PingTracker.reset();
    PingTracker.onSent(5000);
    assert.equal(PingTracker.getOldestOutstandingAge(6500), 1500);
    assert.equal(PingTracker.getOldestOutstandingAge(6500) > 1000, true);
});
