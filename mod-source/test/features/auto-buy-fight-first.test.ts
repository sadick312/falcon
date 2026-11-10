// Auto Buy > Fight-First Order (off by default): fight hats first (Monkey Tail, Soldier, Bull, Booster, EMP, ...),
// buying the first item on that list we don't own and can afford, so cheaper items get bought while saving for an
// expensive one. Off, Auto Buy keeps its original order and waits for each item in turn.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const MONKEY_TAIL = 11, ANGEL_WINGS = 13, BLOOD_WINGS = 18;
const SOLDIER = 6, BULL = 7, BOOSTER = 12, WINTER_CAP = 15, EMP = 22, TANK = 40, TURRET = 53;

/**
 * Store purchases sent when our points become `points`. We own everything except `missing` ([id, isAccessory]).
 */
async function buys(points: number, missing: [number, boolean][], fightFirst = true) {
    game = await startGame({ enable: fightFirst ? ["autoBuy", "autoBuy:fightFirst"] : ["autoBuy"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    const player = game.Client.player;
    for (const [id, isAccessory] of missing) delete (isAccessory ? player.tails : player.skins)[id];

    const before = game.sent.length;
    game.handlers.N("points", points);
    return game.sent.slice(before).filter(p => p.type === "c" && p.args[0] === true).map(p => [p.args[1], p.args[2]]);
}

describe("Auto Buy: Fight-First Order", () => {
    it("buys EMP before tank gear (the original order waits for tank gear first)", async () => {
        const missing: [number, boolean][] = [[TANK, false], [EMP, false]];
        expect(await buys(10000, missing, false)).toEqual([]);
        expect(await buys(10000, missing)).toEqual([[EMP, false]]);
    });

    it("follows the fight-first order: monkey tail, soldier, bull, booster, EMP", async () => {
        const all: [number, boolean][] = [[MONKEY_TAIL, true], [SOLDIER, false], [BULL, false], [BOOSTER, false], [EMP, false]];
        expect(await buys(6000, all)).toEqual([[MONKEY_TAIL, true]]);
        expect(await buys(6000, all.slice(1))).toEqual([[SOLDIER, false]]);
        expect(await buys(6000, all.slice(2))).toEqual([[BULL, false]]);
        expect(await buys(6000, all.slice(3))).toEqual([[BOOSTER, false]]);
        expect(await buys(6000, all.slice(4))).toEqual([[EMP, false]]);
    });

    it("picks up a cheaper item while saving for an expensive one", async () => {
        // Soldier (4000) isn't affordable at 1000; winter cap (600) further down is.
        expect(await buys(1000, [[SOLDIER, false], [WINTER_CAP, false]])).toEqual([[WINTER_CAP, false]]);
    });

    it("skips what we own and buys nothing when nothing missing is affordable", async () => {
        expect(await buys(5000, [[TURRET, false]])).toEqual([]);
        expect(await buys(10000, [[TURRET, false]])).toEqual([[TURRET, false]]);
    });

    it("also buys Angel Wings and Blood Wings, last", async () => {
        expect(await buys(15000, [[ANGEL_WINGS, true], [BLOOD_WINGS, true]])).toEqual([[ANGEL_WINGS, true]]);
        expect(await buys(20000, [[BLOOD_WINGS, true]])).toEqual([[BLOOD_WINGS, true]]);
    });

    it("buys one item per points update", async () => {
        expect(await buys(100000, [[SOLDIER, false], [BULL, false]])).toEqual([[SOLDIER, false]]);
    });

    it("is off by default", async () => {
        // Fresh modules: the tests above turned the toggle on in the shared menu objects.
        vi.resetModules();
        const { utilitySettings } = await import("@core/menu/content/utility");
        const find = (node: unknown): { status?: unknown } | undefined => {
            if (Array.isArray(node)) return node.map(find).find(Boolean);
            if (node && typeof node === "object") {
                if ((node as { id?: string }).id === "autoBuy:fightFirst") return node as { status?: unknown };
                return Object.values(node).map(find).find(Boolean);
            }
            return undefined;
        };
        expect(find(utilitySettings)?.status).toBe(false);
    });
});
