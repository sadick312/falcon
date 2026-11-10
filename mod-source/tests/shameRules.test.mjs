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
