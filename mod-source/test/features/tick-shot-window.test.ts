// "Tick-Based Shot Window" (Utility > Packet Management, off by default): two shots from one enemy within 4 server
// ticks mean a bow insta. Classic counts the 4 ticks as a 444 ms timer, so when server ticks arrive late (lag, jitter)
// shots 2 ticks apart can be more than 444 ms apart and the insta is missed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;

/** Enemy at (1300, 1000) shoots, then shoots again `ticks` server ticks later with `extraMs` of lag in between. */
async function twoShots(enable: string[], ticks: number, extraMs: number) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: ENEMY, x: 1300, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");

    // ADD_PROJECTILE (x, y, dir, range, speed, index, layer, sid): a musket-speed bullet towards us, 70 in front of the enemy.
    game.handlers.X(1230, 1000, Math.PI, 1000, 3.6, 0, 1, 9001);
    expect(DefenseSystem.isBeingBowInstaed).toBe(false);
    for (let i = 0; i < ticks; i++) {
        if (i === 0) vi.advanceTimersByTime(extraMs);
        game.update();
    }
    game.handlers.X(1230, 1000, Math.PI, 1000, 3.6, 0, 1, 9002);
    return DefenseSystem.isBeingBowInstaed;
}

describe("Tick-Based Shot Window", () => {
    it("classic (off): shots 2 ticks apart are an insta on time, but not after 400 ms of lag", async () => {
        expect(await twoShots([], 2, 0)).toBe(true);
        expect(await twoShots([], 2, 400)).toBe(false);
    });

    it("on: shots 2 ticks apart are an insta, lag or not", async () => {
        expect(await twoShots(["tickShotWindow"], 2, 0)).toBe(true);
        expect(await twoShots(["tickShotWindow"], 2, 400)).toBe(true);
    });

    it("on: shots 4 or more ticks apart are not", async () => {
        expect(await twoShots(["tickShotWindow"], 4, 0)).toBe(false);
        expect(await twoShots(["tickShotWindow"], 6, 0)).toBe(false);
    });

    it("is off by default", async () => {
        vi.resetModules();
        const { utilitySettings } = await import("@menu/content/utility");
        type Item = { id: string; status?: unknown; settings?: Item[] };
        const find = (items: Item[], id: string): Item | undefined =>
            items.map(i => i.id === id ? i : find(i.settings ?? [], id)).find(Boolean);
        expect(find(utilitySettings as Item[], "tickShotWindow")?.status).toBe(false);
    });
});
