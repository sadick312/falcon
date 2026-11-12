// Run with: npm test --workspace=mod-source
// Rule measured live on sandbox.moomodding.io: eating is shame-free once (time since hit) + RTT > 120 ms.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { default: ShameRules } = await loadTs("src/core/mod/defense/utils/ShameRules.ts");

test("msUntilSafeEat: waits only as long as ping requires", () => {
    const now = 10_000;
    assert.equal(ShameRules.msUntilSafeEat({ hitTimeMs: 0 }, 50, now), 0, "no hit -> eat now");
    assert.equal(ShameRules.msUntilSafeEat({ hitTimeMs: now }, 50, now), 120 + 15 - 50, "50 ms ping -> wait 85 ms");
    assert.equal(ShameRules.msUntilSafeEat({ hitTimeMs: now }, 105, now), 30, "105 ms ping (measured case) -> wait 30 ms");
    assert.equal(ShameRules.msUntilSafeEat({ hitTimeMs: now }, 200, now), 0, "200 ms ping -> eat immediately");
    assert.equal(ShameRules.msUntilSafeEat({ hitTimeMs: now - 200 }, 50, now), 0, "hit long ago -> eat now");
});

test("isFoodHeal: food yes, regen no", () => {
    assert.equal(ShameRules.isFoodHeal(20, 80, 100), true, "apple");
    assert.equal(ShameRules.isFoodHeal(40, 90, 100), true, "cookie");
    assert.equal(ShameRules.isFoodHeal(12, 100, 100), true, "food capped at max health");
    assert.equal(ShameRules.isFoodHeal(3, 60, 100), false, "Medic Gear regen");
    assert.equal(ShameRules.isFoodHeal(15, 100, 100), false, "healing pad");
    assert.equal(ShameRules.isFoodHeal(10, 70, 100), false, "cheese heal-over-time");
});

test("wasShameEat: 120 ms window on packet receive times", () => {
    assert.equal(ShameRules.wasShameEat({ hitTimeMs: 1000 }, 1100), true);
    assert.equal(ShameRules.wasShameEat({ hitTimeMs: 1000 }, 1121), false);
    assert.equal(ShameRules.wasShameEat({ hitTimeMs: 0 }, 1100), false);
});

test("onOwnEat: counts at send time with RTT, including eats at full health", () => {
    const p = { hitTimeMs: 1000, hitTime: 5, shameCount: 0 };
    ShameRules.onOwnEat(p, 80, 1020);          // 20 ms after hit + 80 RTT = 100 <= 120 -> shame
    assert.equal(p.shameCount, 1);
    assert.equal(p.hitTimeMs, 0, "server clears its hit time on every eat");
    ShameRules.onOwnEat(p, 80, 1030);          // no hit since last eat -> no change
    assert.equal(p.shameCount, 1);
    p.hitTimeMs = 2000; ShameRules.onOwnEat(p, 80, 2050); // 130 > 120 -> -2 (floored at 0)
    assert.equal(p.shameCount, 0);
    const q = { hitTimeMs: 1, hitTime: 1, shameCount: 7 };
    ShameRules.onOwnEat(q, 50, 1);             // 8th strike -> server applies Shame and resets the count
    assert.equal(q.shameCount, 0);
});

test("onOwnEat reports what the eat did (for the Debug panel counters)", () => {
    const p = { hitTimeMs: 0, hitTime: 0, shameCount: 0 };
    assert.equal(ShameRules.onOwnEat(p, 80, 1000), "none", "no hit since last eat");
    p.hitTimeMs = 1000;
    assert.equal(ShameRules.onOwnEat(p, 80, 1020), "shame");
    p.hitTimeMs = 2000;
    assert.equal(ShameRules.onOwnEat(p, 80, 2100), "safe");
    p.shameCount = 7; p.hitTimeMs = 3000;
    assert.equal(ShameRules.onOwnEat(p, 80, 3000), "shamed", "8th strike");
    assert.equal(p.shameCount, 0);
});

test("shame guard: defers an emergency heal only when it would add shame, shame is high enough and HP > 40", () => {
    const from = ShameRules.DEFAULT_GUARD_FROM;
    assert.equal(from, 6, "default = the old fixed value");
    assert.equal(ShameRules.shouldDeferEmergencyHeal(6, 60, 30, from), true);
    assert.equal(ShameRules.shouldDeferEmergencyHeal(5, 60, 30, from), false, "old behaviour below 6");
    assert.equal(ShameRules.shouldDeferEmergencyHeal(4, 60, 30, 4), true, "guard from 4 (bull spam setting)");
    assert.equal(ShameRules.shouldDeferEmergencyHeal(7, 40, 30, from), false, "HP 40 or less: always eat now");
    assert.equal(ShameRules.shouldDeferEmergencyHeal(7, 60, 0, from), false, "already shame-free: eat now");
});
