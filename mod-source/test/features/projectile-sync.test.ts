// Feature #7, Projectile Sync (ProjectileSyncer): a bull-helmet hit timed with a projectile about to hit the enemy,
// when our hit plus the incoming projectile damage reaches 100. Projectiles come from real ADD_PROJECTILE packets.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const BULL_HELMET = 7;
const MUSKET_BULLET = 5;
const ARROW = 0;

interface Scenario {
    enable?: boolean;
    projectile?: number | null;
    enemyX?: number;
    tail?: number;
}

/** A third player (sid 3) fires at the enemy from 400 units behind it, so the shot arrives next tick. */
async function play(s: Scenario = {}) {
    const { default: items } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["projectileSync"] });
    const enemyX = s.enemyX ?? 1100;
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5, tailIndex: s.tail ?? 0 });
    game.spawn({ sid: 2, x: enemyX, y: 1000 });
    game.spawn({ sid: 3, x: enemyX + 500, y: 1000, weaponIndex: 15 });
    game.setLoadout([5], [0, 3, 6, 10]);
    game.update();

    if (s.projectile !== null) {
        const p = items.projectiles[s.projectile ?? MUSKET_BULLET];
        game.handlers.X(enemyX + 400, 1000, Math.PI, p.range, p.speed, s.projectile ?? MUSKET_BULLET, 0, 900);
    }
    for (let i = 0; i < 3; i++) game.update();
    return game.sent.filter(p => p.type === "c" && p.args[1] === BULL_HELMET).map(p => p.tick);
}

describe("Projectile Sync", () => {
    it("bull-hits as a musket bullet (50) arrives: 45 x 1.5 + 50 reaches 100", async () => {
        expect(await play()).toEqual([2]);
    });

    it("holds back for an arrow (25): 67.5 + 25 is short of 100", async () => {
        expect(await play({ projectile: ARROW })).toEqual([]);
    });

    it("does nothing without an incoming projectile", async () => {
        expect(await play({ projectile: null })).toEqual([]);
    });

    it("does nothing when the toggle is off", async () => {
        expect(await play({ enable: false })).toEqual([]);
    });

    it("needs the enemy within polearm range", async () => {
        expect(await play({ enemyX: 1300 })).toEqual([]);
    });

    it("never hits while wearing the Monkey Tail", async () => {
        const { STORE_ACCESSORY_MAP } = await import("@constants/store");
        expect(await play({ tail: STORE_ACCESSORY_MAP.MONKEY_TAIL })).toEqual([]);
    });
});
