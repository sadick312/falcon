// Feature #38, Game event tracking (GameEventTracker): answers "did this player attack since the last tick?" for
// Pattern Recognition. A tick tracks a player; their gather animation (`K`) or a projectile they fire (`X`) before
// the next tick confirms it.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const HUNTING_BOW = 9;

describe("Game event tracking", () => {
    /** Enemy 2 at (1300, 1000) holding a bow, tracked for projectiles; then a projectile packet arrives. */
    async function shot(projectile: { x: number; sid: number }) {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1300, y: 1000, weaponIndex: HUNTING_BOW });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        game.update();
        const { default: GameEventTracker } = await import("@core/mod/utils/GameEventTracker");
        GameEventTracker.prepare();
        GameEventTracker.clean();
        GameEventTracker.track(2, "X");
        // ADD_PROJECTILE: x, y, dir, range, speed, indx, layer, sid (the projectile's own sid).
        game.handlers.X(projectile.x, 1000, Math.PI, 1000, 1.6, 0, 0, projectile.sid);
        return GameEventTracker.confirm(2, "X");
    }

    it("confirms a tracked player's shot by who fired it", async () => {
        // The arrow leaves 70 in front of the enemy, toward us. Its sid is not the enemy's: the shooter used to be
        // read from the packet's last value, which is the projectile's own sid, so this was never confirmed.
        expect(await shot({ x: 1230, sid: 9000 })).toBe(true);
    });

    it("doesn't confirm a projectile fired by someone else that happens to share the player's sid", async () => {
        expect(await shot({ x: 3000, sid: 2 })).toBe(false);
    });

    it("confirms a gather animation from a tracked player, and nothing untracked", async () => {
        game = await startGame();
        const { default: GameEventTracker } = await import("@core/mod/utils/GameEventTracker");
        GameEventTracker.prepare();
        GameEventTracker.track(2, "K");
        GameEventTracker.updateTracker(2, "K");
        GameEventTracker.updateTracker(3, "K");
        expect(GameEventTracker.confirm(2, "K")).toBe(true);
        expect(GameEventTracker.confirm(3, "K")).toBe(false);
        GameEventTracker.clean();
        expect(GameEventTracker.confirm(2, "K")).toBe(false);
    });
});
