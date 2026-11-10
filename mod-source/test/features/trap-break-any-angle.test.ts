// Defense brief, D8 "Break Traps From Any Angle" (Auto Break sub-setting, default off). A 1.8.2 swing hits every
// object whose distance minus its size is within the weapon's range and whose direction is within ~69 deg of the aim.
// While trapped, the trap breaker usually aims at one spike (or the midpoint of two). With the setting it turns the
// aim to hit the most enemy spikes and traps at once, never fewer than the usual aim, avoiding our own buildings.
import { afterEach, describe, expect, it } from "vitest";
import { bestBreakAim, BreakAimObject, objectsHit } from "@core/mod/defense/utils/BreakAim";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const deg = (d: number) => (d * Math.PI) / 180;
const at = (angleDeg: number, dist: number, extra: Partial<BreakAimObject> = {}): BreakAimObject => ({
    x: Math.cos(deg(angleDeg)) * dist, y: Math.sin(deg(angleDeg)) * dist, scale: 40, danger: true, friendly: false, ...extra
});
const ORIGIN = { x: 0, y: 0 };
const RANGE = 75;

describe("bestBreakAim", () => {
    it("turns to hit three spikes spread over 120 deg where aiming at one hits two", () => {
        const spikes = [at(0, 90), at(60, 90), at(120, 90)];
        expect(objectsHit(ORIGIN, deg(0), RANGE, spikes)).toHaveLength(2);

        const aim = bestBreakAim(ORIGIN, deg(0), RANGE, spikes);
        expect(objectsHit(ORIGIN, aim, RANGE, spikes)).toEqual([0, 1, 2]);
    });

    it("never drops something the usual aim hits, even for more elsewhere", () => {
        // Aiming at the spike on the left; two spikes on the right can't be hit together with it.
        const objects = [at(180, 90), at(0, 90), at(20, 90)];
        const aim = bestBreakAim(ORIGIN, deg(180), RANGE, objects);
        expect(objectsHit(ORIGIN, aim, RANGE, objects)).toContain(0);
    });

    it("prefers not to hit our own buildings when it can", () => {
        const objects = [at(0, 90), at(60, 90, { danger: false, friendly: true }), at(-60, 90)];
        // Aiming at 0 hits all three; turning to -30 still hits both enemy spikes but not our wall.
        const aim = bestBreakAim(ORIGIN, deg(0), RANGE, objects);
        const hit = objectsHit(ORIGIN, aim, RANGE, objects);
        expect(hit).toContain(0);
        expect(hit).toContain(2);
        expect(hit).not.toContain(1);
    });

    it("keeps the usual aim when nothing better exists", () => {
        const objects = [at(90, 90)];
        expect(bestBreakAim(ORIGIN, deg(90), RANGE, objects)).toBeCloseTo(deg(90), 10);
    });

    it("counts a trap centred on us as hit by any aim, and ignores objects out of reach", () => {
        const objects = [{ x: 0, y: 0, scale: 50, danger: true, friendly: false }, at(0, 400)];
        expect(objectsHit(ORIGIN, deg(123), RANGE, objects)).toEqual([0]);
    });
});

describe("Auto Break with the setting", () => {
    const GREAT_HAMMER = 10;

    /** We're in an enemy pit trap with three enemy spikes around us (0, 60 and 120 deg). How many does the swing hit? */
    async function swing(enable: string[]) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["autoBreak", ...enable] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1400, y: 1400 });
        game.setLoadout([5, GREAT_HAMMER], [0, 3, 6, 10, 15]);
        const spikeAt = (sid: number, a: number) => ({
            sid, x: 1000 + Math.round(Math.cos(deg(a)) * 90), y: 1000 + Math.round(Math.sin(deg(a)) * 90), itemId: LIST_ID_MAP.SPIKES as number, owner: 2
        });
        game.addObjects([
            { sid: 600, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP as number, owner: 2 },
            spikeAt(701, 0), spikeAt(702, 60), spikeAt(703, 120)
        ]);
        game.update();
        game.update();

        const { default: AutoBreaker } = await import("@core/mod/defense/modules/AutoBreaker");
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        const { getWeapon } = await import("@constants/items");
        const objects = [701, 702, 703].map(sid => {
            const o = ObjectManager.getObject(sid)!;
            return { x: o.x, y: o.y, scale: o.scale, danger: true, friendly: false };
        });
        return objectsHit({ x: 1000, y: 1000 }, AutoBreaker.aimAngle, getWeapon(GREAT_HAMMER).range, objects).length;
    }

    it("off (default): the usual aim reaches at most two of the three spikes", async () => {
        expect(await swing([])).toBeLessThan(3);
    });

    it("on: one swing reaches all three spikes", async () => {
        expect(await swing(["trapBreakAnyAngle"])).toBe(3);
    });
});
