// constants/hatNumbers.ts reads the hat numbers from the store data. These are the values that used to be typed into
// combat and defense files; if the store data changes, this test shows which numbers moved.
import { describe, expect, it } from "vitest";
import {
    ANGEL_WINGS_REGEN, BULL_DAMAGE_MULT, BULL_HEALTH_DRAIN, MONKEY_TAIL_DAMAGE_MULT, SOLDIER_DAMAGE_TAKEN, TURRET_BULLET_DAMAGE
} from "@constants/hatNumbers";
import { BULL_DAMAGE_MULT as WORLD_BULL_DAMAGE_MULT } from "@constants/world";

describe("hat numbers", () => {
    it("match the values the combat and defense code used before (1.8.2)", () => {
        expect(BULL_DAMAGE_MULT).toBe(1.5);
        expect(BULL_HEALTH_DRAIN).toBe(5);
        expect(SOLDIER_DAMAGE_TAKEN).toBe(0.75);
        expect(TURRET_BULLET_DAMAGE).toBe(25);
        expect(MONKEY_TAIL_DAMAGE_MULT).toBe(0.2);
        expect(ANGEL_WINGS_REGEN).toBe(3);
    });

    it("world.ts still exports the same bull multiplier for its importers", () => {
        expect(WORLD_BULL_DAMAGE_MULT).toBe(BULL_DAMAGE_MULT);
    });
});
