// Feature #43, Projectiles (ProjectileManager): on ADD_PROJECTILE, works out who fired it (a player whose position is
// 70 behind the projectile, or a turret / turret-gear player at its start for speed 1.5), and from the speed which
// weapon (1.8.2: bow 1.6, crossbow 2.5, repeater 2, musket 3.6; Marksman Cap multiplies arrow speed by 1.3). That
// sets the shooter's secondary and reload, flags bow-insta threats, and adds a projectile for the hit simulation.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const HUNTING_BOW = 9;
const CROSSBOW = 12;
const REPEATER = 13;
const MUSKET = 15;

/** Enemy 2 at (1300, 1000) holding a bow fires toward us at `speed`; returns their secondary and its reload. */
async function fire(speed: number) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1300, y: 1000, weaponIndex: HUNTING_BOW });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
    game.update();
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const enemy = PlayerManager.get(2)!;
    // ADD_PROJECTILE: x, y, dir, range, speed, indx, layer, sid. It starts 70 in front of the shooter.
    game.handlers.X(1230, 1000, Math.PI, 1000, speed, 0, 0, 9000);
    return { secondary: enemy.weaponData.secondary, reloads: enemy.reloads };
}

describe("Projectiles", () => {
    it("tells the weapon from the projectile speed", async () => {
        expect((await fire(1.6)).secondary).toBe(HUNTING_BOW);
        expect((await fire(2.5)).secondary).toBe(CROSSBOW);
        expect((await fire(2)).secondary).toBe(REPEATER);
        expect((await fire(3.6)).secondary).toBe(MUSKET);
    });

    it("tells the weapon when the shooter wears Marksman Cap (speed × 1.3)", async () => {
        // Every Marksman Cap shot used to be taken for a musket (damage 50).
        expect((await fire(1.6 * 1.3)).secondary).toBe(HUNTING_BOW);
        expect((await fire(2.5 * 1.3)).secondary).toBe(CROSSBOW);
        expect((await fire(2 * 1.3)).secondary).toBe(REPEATER);
        expect((await fire(3.6 * 1.3)).secondary).toBe(MUSKET);
    });

    it("restarts the shooter's reload for that weapon", async () => {
        const { reloads } = await fire(1.6);
        expect(reloads[HUNTING_BOW]).toBe(0);
    });
});
