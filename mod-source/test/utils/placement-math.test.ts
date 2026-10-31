// Pure maths used every tick: which placement angles an object blocks, and the friction multiplier.
// The tests check geometric properties rather than copying the formulas.
import { beforeAll, describe, expect, it } from "vitest";
import type GameObjectType from "@constants/GameObject";
import type { ListItem } from "@constants/items";

let GameObject: typeof GameObjectType;
let IntervalHelper: typeof import("@utils/geometry/IntervalHelper").default;
let items: typeof import("@constants/items").default;
let LIST_ID_MAP: typeof import("@constants/items").LIST_ID_MAP;
let MovementUtils: typeof import("@core/mod/defense/utils/MovementUtils").default;
let HealerUtils: typeof import("@core/mod/defense/utils/HealerUtils").default;

beforeAll(async () => {
    // Bundle load order, so the import cycle through AngleFinder resolves.
    await import("@core/socket/SocketListener");
    GameObject = (await import("@constants/GameObject")).default;
    IntervalHelper = (await import("@utils/geometry/IntervalHelper")).default;
    ({ default: items, LIST_ID_MAP } = await import("@constants/items"));
    MovementUtils = (await import("@core/mod/defense/utils/MovementUtils")).default;
    HealerUtils = (await import("@core/mod/defense/utils/HealerUtils")).default;
});

const PLAYER = { x: 1000, y: 1000 };

/** Where an item placed at `angle` would sit, and how far that is from the object's centre. */
function gapAt(angle: number, item: ListItem, obj: GameObjectType) {
    const offset = 35 + item.scale + (item.placeOffset ?? 0);
    const x = PLAYER.x + Math.cos(angle) * offset;
    const y = PLAYER.y + Math.sin(angle) * offset;
    return Math.hypot(obj.x - x, obj.y - y);
}

/** Distance at which the placed item and the object just touch. */
const touching = (item: ListItem, obj: GameObjectType) => item.scale + (obj.blocker || obj.getScale(0.6, obj.isItem) - 0.05);

function wall(x: number, y: number) {
    return new GameObject(x, y, 0, items.list[LIST_ID_MAP.STONE_WALL].scale, 0, LIST_ID_MAP.STONE_WALL, 2);
}

describe("IntervalHelper.computeInterval", () => {
    it("blocks nothing when the object is out of reach", () => {
        const spikes = items.list[LIST_ID_MAP.SPIKES];
        expect(IntervalHelper.computeInterval(PLAYER, wall(PLAYER.x + 1000, PLAYER.y), spikes)).toBe(0);
        expect(IntervalHelper.computeBufferLength).toBe(0);
    });

    it("blocks every angle when the object is on top of the player", () => {
        const spikes = items.list[LIST_ID_MAP.SPIKES];
        expect(IntervalHelper.computeInterval(PLAYER, wall(PLAYER.x + 5, PLAYER.y), spikes)).toBe(1);
        expect(IntervalHelper.computeBuffer[0]).toEqual([0, Math.PI * 2]);
    });

    it.each([
        ["to the left", -110, 20],
        ["above-left", -60, -95],
        ["straight down", 0, 110]
    ])("puts the edges where a placed item would just touch the object (%s)", (_label, dx, dy) => {
        const spikes = items.list[LIST_ID_MAP.SPIKES];
        const obj = wall(PLAYER.x + dx, PLAYER.y + dy);
        expect(IntervalHelper.computeInterval(PLAYER, obj, spikes)).toBe(1);

        const [start, end] = IntervalHelper.computeBuffer[0];
        const contact = touching(spikes, obj);
        expect(gapAt(start, spikes, obj)).toBeCloseTo(contact, 6);
        expect(gapAt(end, spikes, obj)).toBeCloseTo(contact, 6);
        expect(gapAt((start + end) / 2, spikes, obj)).toBeLessThan(contact);
        expect(gapAt(start - 0.05, spikes, obj)).toBeGreaterThan(contact);
        expect(gapAt(end + 0.05, spikes, obj)).toBeGreaterThan(contact);
    });

    it("splits the range in two when it crosses angle 0", () => {
        const spikes = items.list[LIST_ID_MAP.SPIKES];
        const obj = wall(PLAYER.x + 110, PLAYER.y);
        expect(IntervalHelper.computeInterval(PLAYER, obj, spikes)).toBe(2);

        const [[start, full], [zero, end]] = IntervalHelper.computeBuffer;
        expect([full, zero]).toEqual([Math.PI * 2, 0]);
        expect(gapAt(start, spikes, obj)).toBeCloseTo(touching(spikes, obj), 6);
        expect(gapAt(end, spikes, obj)).toBeCloseTo(touching(spikes, obj), 6);
        expect(gapAt(0, spikes, obj)).toBeLessThan(touching(spikes, obj));
    });
});

describe("MovementUtils.getFrictionMult", () => {
    /** The slowdown added up one step at a time, until the push is too small to matter. */
    function stepByStep(accelX: number, accelY: number, delta: number) {
        const r = Math.pow(0.993, delta);
        const magSq = accelX * accelX + accelY * accelY;
        let sum = 0;
        for (let factor = 1; magSq * factor > 0.0001; factor *= r) sum += factor;
        return sum;
    }

    it.each([
        [1, 0, 111],
        [0.3, -0.4, 111],
        [0.05, 0.02, 50],
        [2, 2, 200]
    ])("matches the step-by-step sum for accel (%f, %f) over %i ms", (ax, ay, delta) => {
        expect(MovementUtils.getFrictionMult(ax, ay, delta)).toBeCloseTo(stepByStep(ax, ay, delta), 9);
    });

    it("is 0 when there is no push to slow down", () => {
        expect(MovementUtils.getFrictionMult(0, 0, 111)).toBe(0);
        expect(MovementUtils.getFrictionMult(0.005, 0, 111)).toBe(0);
    });
});

describe("HealerUtils.getFoodValue", () => {
    it("heals 20 with apples, 40 with cookies and 30 with cheese", () => {
        expect(HealerUtils.getFoodValue(LIST_ID_MAP.APPLE)).toBe(20);
        expect(HealerUtils.getFoodValue(LIST_ID_MAP.COOKIE)).toBe(40);
        expect(HealerUtils.getFoodValue(LIST_ID_MAP.CHEESE)).toBe(30);
    });
});
