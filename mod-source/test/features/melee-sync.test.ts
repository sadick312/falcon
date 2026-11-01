// Feature #8, Melee Sync (AutoMeleeSyncer): a bull-helmet hit together with a chosen partner (meleeSyncTarget = their
// sid) when both primaries are reloaded, both reach an enemy, and the two hits add up to 100.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const BULL_HELMET = 7;
const PARTNER = 3;

interface Scenario {
    enable?: boolean;
    target?: string;
    partnerX?: number;
    partnerWeapon?: number;
}

/** We are at x 1000, the enemy at 1100, the partner on the other side of the enemy. */
async function play(s: Scenario = {}) {
    game = await startGame({ enable: s.enable === false ? [] : ["meleeSync"], settings: { meleeSyncTarget: s.target ?? String(PARTNER) } });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1100, y: 1000 });
    game.spawn({ sid: PARTNER, x: s.partnerX ?? 1200, y: 1000, weaponIndex: s.partnerWeapon ?? 5 });
    game.setLoadout([5], [0, 3, 6, 10]);
    for (let i = 0; i < 3; i++) game.update();

    const bull = game.sent.filter(p => p.type === "c" && p.args[1] === BULL_HELMET);
    const aims = game.sent.filter(p => p.type === "D" && bull.some(b => b.tick === p.tick)).map(p => p.args[0] as number);
    return { ticks: bull.map(b => b.tick), aims };
}

describe("Melee Sync", () => {
    it("bull-hits the enemy both of us reach, aiming at it", async () => {
        const { ticks, aims } = await play();
        expect(ticks[0]).toBe(1);
        expect(aims[0]).toBeCloseTo(0, 5);
    });

    it("needs a partner set (-1 means no one)", async () => {
        expect((await play({ target: "-1" })).ticks).toEqual([]);
    });

    it("needs the partner within reach of the enemy", async () => {
        expect((await play({ partnerX: 1400 })).ticks).toEqual([]);
    });

    it("needs the two hits to reach 100 (polearm 67.5 + daggers 30 is short)", async () => {
        const { WEAPON_ID_MAP } = await import("@constants/items");
        expect((await play({ partnerWeapon: WEAPON_ID_MAP.DAGGERS })).ticks).toEqual([]);
    });

    it("does nothing when the toggle is off", async () => {
        expect((await play({ enable: false })).ticks).toEqual([]);
    });
});
