import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import getDirComp from "@utils/angle/getDirComp";
import lerpAngle from "@utils/angle/lerpAngle";
import normalizeAngle from "@utils/angle/normalizeAngle";
import getDist from "@utils/geometry/getDist";
import getDistSq from "@utils/geometry/getDistSq";
import getMag from "@utils/geometry/getMag";
import getMagSq from "@utils/geometry/getMagSq";
import IntervalHelper from "@utils/geometry/IntervalHelper";
import lineInCircle from "@utils/geometry/lineInCircle";
import lineInRect from "@utils/geometry/lineInRect";
import withinDist from "@utils/geometry/withinDist";
import inRange from "@utils/math/inRange";
import kFormat from "@utils/math/kFormat";
import lerp from "@utils/math/lerp";
import randInt from "@utils/random/randInt";
import Vec2 from "@mod-types/geometry/Vec2";
import { describe, expect, it, vi } from "vitest";

const PI = Math.PI;

describe("distances", () => {
    it("measures straight-line distance and its square", () => {
        expect(getDist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
        expect(getDistSq({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(25);
        expect(getMag(3, 4)).toBe(5);
        expect(getMagSq(-3, 4)).toBe(25);
    });

    it("withinDist is strict: a point exactly at the radius is outside", () => {
        expect(withinDist({ x: 0, y: 0 }, { x: 3, y: 4 }, 5.01)).toBe(true);
        expect(withinDist({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(false);
    });
});

describe("angles", () => {
    it("getDir points from start to end", () => {
        expect(getDir({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe(0);
        expect(getDir({ x: 0, y: 1 }, { x: 0, y: 0 })).toBeCloseTo(PI / 2);
        expect(getDir({ x: -1, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(PI);
    });

    it("getDirComp returns the unit vector from start to end", () => {
        const v = getDirComp({ x: 6, y: 8 }, { x: 0, y: 0 });
        expect(v.x).toBeCloseTo(0.6);
        expect(v.y).toBeCloseTo(0.8);
    });

    it("getAngleDist takes the short way round", () => {
        expect(getAngleDist(0.1, 2 * PI - 0.1)).toBeCloseTo(0.2);
        expect(getAngleDist(-PI / 2, PI / 2)).toBeCloseTo(PI);
        expect(getAngleDist(1, 1 + 4 * PI)).toBeCloseTo(0);
    });

    it("normalizeAngle maps any angle into [0, 2pi)", () => {
        expect(normalizeAngle(-PI / 2)).toBeCloseTo(1.5 * PI);
        expect(normalizeAngle(5 * PI)).toBeCloseTo(PI);
        expect(normalizeAngle(0)).toBe(0);
    });

    it("lerpAngle interpolates across the wrap point instead of the long way", () => {
        const mid = lerpAngle(2 * PI - 0.2, 0.2, 0.5);
        expect(normalizeAngle(mid)).toBeCloseTo(0);
        expect(lerpAngle(0, PI / 2, 0.5)).toBeCloseTo(PI / 4);
    });
});

describe("math helpers", () => {
    it("lerp and inRange", () => {
        expect(lerp(10, 20, 0.25)).toBe(12.5);
        expect(inRange(5, 5, 10)).toBe(true);
        expect(inRange(10, 5, 10)).toBe(true);
        expect(inRange(10.01, 5, 10)).toBe(false);
    });

    it("kFormat abbreviates thousands and millions", () => {
        expect(kFormat(999)).toBe("999");
        expect(kFormat(1500)).toBe("1.5k");
        expect(kFormat(2_340_000)).toBe("2.3m");
    });

    it("randInt stays within the inclusive range", () => {
        const spy = vi.spyOn(Math, "random");
        spy.mockReturnValue(0);
        expect(randInt(3, 7)).toBe(3);
        spy.mockReturnValue(0.9999999);
        expect(randInt(3, 7)).toBe(7);
    });
});

describe("line intersections", () => {
    it("lineInCircle hits when the closest point of the segment is inside", () => {
        const c = { x: 5, y: 1 };
        expect(lineInCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, c, 2)).toBe(true);
        expect(lineInCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }, 2)).toBe(false);
        // Beyond the end of the segment, even though the infinite line would pass through.
        expect(lineInCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, 2)).toBe(false);
        // Zero-length segment acts as a point.
        expect(lineInCircle({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, 2)).toBe(true);
    });

    it("lineInRect detects crossing, missing and vertical segments", () => {
        expect(lineInRect(0, 0, 10, 10, -5, 5, 15, 5)).toBe(true);
        expect(lineInRect(0, 0, 10, 10, -5, 20, 15, 20)).toBe(false);
        expect(lineInRect(0, 0, 10, 10, 5, -5, 5, 15)).toBe(true);
        expect(lineInRect(0, 0, 10, 10, 20, -5, 20, 15)).toBe(false);
    });
});

describe("IntervalHelper.subtractInterval", () => {
    const run = (intervals: [number, number][], bStart: number, bEnd: number) => {
        const input = intervals.map(([a, b]) => [a, b] as [number, number]);
        const count = IntervalHelper.subtractInterval(input.length, bStart, bEnd, input);
        return IntervalHelper.intervalBuffer.slice(0, count).map(([a, b]) => [a, b]);
    };

    it("splits, trims or keeps intervals", () => {
        expect(run([[0, 10]], 3, 5)).toEqual([[0, 3], [5, 10]]);
        expect(run([[0, 10]], -1, 4)).toEqual([[4, 10]]);
        expect(run([[0, 10]], 20, 30)).toEqual([[0, 10]]);
        expect(run([[0, 10]], -5, 15)).toEqual([]);
        expect(run([[0, 2], [4, 6]], 1, 5)).toEqual([[0, 1], [5, 6]]);
    });
});

describe("Vec2", () => {
    it("does vector arithmetic", () => {
        const a = new Vec2(3, 4);
        expect(a.mag()).toBe(5);
        expect(a.magSq()).toBe(25);
        expect(a.add(new Vec2(1, 1))).toEqual(new Vec2(4, 5));
        expect(a.scale(2)).toEqual(new Vec2(6, 8));
        expect(a.dot(new Vec2(2, 0))).toBe(6);
        expect(a.cross(new Vec2(0, 1))).toBe(3);
        expect(a.lerp(new Vec2(5, 4), 0.5)).toEqual(new Vec2(4, 4));
        expect(new Vec2(0, 0).normalize()).toEqual(new Vec2(0, 0));
        expect(a.normalize().mag()).toBeCloseTo(1);
    });

    it("sub writes into the target, or mutates in place with numbers", () => {
        const a = new Vec2(5, 5);
        const out = new Vec2(0, 0);
        expect(a.sub(new Vec2(2, 1), out)).toBe(out);
        expect(out).toEqual(new Vec2(3, 4));
        a.sub(1, 2);
        expect(a).toEqual(new Vec2(4, 3));
        a.add(1, 1);
        expect(a).toEqual(new Vec2(5, 4));
    });
});
