// Feature #6, Dynamic One Tick (OneTicker): a turret gear bullet plus a bull-helmet hit with a diamond polearm or
// ruby katana, timed to land together (25 + 53.1 x 1.5 = 104.65), while walking in from ~230 units away.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const TURRET_GEAR = 53;
const BULL_HELMET = 7;

interface Scenario {
    enable?: string[];
    variant?: number;
    enemyHat?: number;
    tail?: number;
}

/** We walk toward a still enemy (20 units per tick) and end 230 units away, then take one more step. */
async function play(s: Scenario = {}) {
    game = await startGame({ enable: s.enable ?? ["dynamicOneTick"] });
    const startX = 900;
    game.spawn({ sid: ME, x: startX, y: 1000, weaponIndex: 5, weaponVariant: s.variant ?? 2, tailIndex: s.tail ?? 0 });
    game.spawn({ sid: 2, x: 1230, y: 1000, skinIndex: s.enemyHat ?? 0 });
    game.setLoadout([5], [0, 3, 6, 10]);
    for (let i = 1; i <= 6; i++) game.update([{ sid: ME, x: startX + 20 * i }]);

    return game.sent
        .filter(p => p.type === "c" && (p.args[1] === TURRET_GEAR || p.args[1] === BULL_HELMET))
        .map(p => [p.tick, p.args[1]]);
}

describe("Dynamic One Tick", () => {
    it("puts on turret gear, then hits with the bull helmet on the next tick", async () => {
        expect(await play()).toEqual([[5, TURRET_GEAR], [6, BULL_HELMET]]);
    });

    it("needs at least a diamond polearm (a stone one is too weak)", async () => {
        expect(await play({ variant: 0 })).toEqual([]);
    });

    it("does nothing when the toggle is off", async () => {
        expect(await play({ enable: [] })).toEqual([]);
    });

    it("holds back against a Soldier Helmet (x0.75), unless 'Ignore Hats' is on", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        expect(await play({ enemyHat: STORE_HAT_MAP.SOLDIER_HELMET })).toEqual([]);
        expect(await play({ enemyHat: STORE_HAT_MAP.SOLDIER_HELMET, enable: ["dynamicOneTick", "oneTickIgnoreHats"] }))
            .toEqual([[5, TURRET_GEAR], [6, BULL_HELMET]]);
    });

    it("holds back against an EMP Helmet, which stops the turret bullet", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        expect(await play({ enemyHat: STORE_HAT_MAP.EMP_HELMET })).toEqual([]);
    });

    it("never one-ticks while wearing the Monkey Tail", async () => {
        const { STORE_ACCESSORY_MAP } = await import("@constants/store");
        expect(await play({ tail: STORE_ACCESSORY_MAP.MONKEY_TAIL })).toEqual([]);
    });
});
