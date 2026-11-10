// reloadedByNextTick: will a weapon (or the turret) be fully reloaded after one more server tick? One shared helper
// for the sum OneTicker and ModManager used to write out by hand: reload + tick / reloadTime >= 1.
import reloadedByNextTick from "@utils/math/reloadedByNextTick";
import ScriptConfig from "@utils/config/ScriptConfig";
import { describe, expect, it } from "vitest";

const TICK = ScriptConfig.SERVER_UPDATE_SPEED;

describe("reloadedByNextTick", () => {
    it("uses one 111 ms server tick", () => {
        expect(TICK).toBe(111);
    });

    it("is true when one more tick finishes the reload", () => {
        // Turret gear: 2500 ms, so one tick adds 111 / 2500 = 0.0444.
        expect(reloadedByNextTick(1 - 0.0444, 2500)).toBe(true);
        expect(reloadedByNextTick(1, 2500)).toBe(true);
        expect(reloadedByNextTick(0.99, 700)).toBe(true);
    });

    it("is false when the reload still isn't done after one more tick", () => {
        expect(reloadedByNextTick(0.9, 2500)).toBe(false);
        expect(reloadedByNextTick(0, 300)).toBe(false);
    });

    it("matches the hand-written sum exactly, including floating-point edges", () => {
        for (const time of [300, 700, 2500, 1000 / 3]) {
            for (let i = 0; i <= 1000; i++) {
                const reload = i / 1000;
                expect(reloadedByNextTick(reload, time)).toBe(reload + TICK / time >= 1);
            }
        }
    });
});
