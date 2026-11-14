// A player's last_position is only updated while they are in view. When one comes back into view, the classic code
// took their old position as "last tick's", so next_position (real * 2 - last) and every speed worked out from it
// were huge for that tick. Now a player back in view counts as not moving on that tick.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;

describe("player back in view", () => {
    it("next_position isn't thrown far ahead on the tick they reappear", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: ENEMY, x: 1300, y: 1000, weaponIndex: 5 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        game.update();

        // The server says the enemy left our view (the update's hidden list), then it's missing for a few ticks, then it
        // comes back 400 further right.
        vi.advanceTimersByTime(1000 / 9);
        game.handlers.a([ME, 1000, 1000, 0], [], [ENEMY]);
        for (let i = 0; i < 3; i++) game.update([], [ME]);
        game.update([{ sid: ENEMY, x: 1700, y: 1000 }]);

        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        const enemy = PlayerManager.get(ENEMY)!;
        expect(enemy.real_position.x).toBe(1700);
        expect(enemy.next_position.x).toBe(1700);
    });

    it("a player who stayed in view keeps their movement", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: ENEMY, x: 1300, y: 1000, weaponIndex: 5 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        game.update([{ sid: ENEMY, x: 1320, y: 1000 }]);

        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        expect(PlayerManager.get(ENEMY)!.next_position.x).toBe(1340);
    });
});
