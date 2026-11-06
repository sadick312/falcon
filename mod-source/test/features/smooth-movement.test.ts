// On-screen movement (CameraManager.lerpEntities, PlayerUpdateEvent): each player is drawn sliding from where it was
// drawn to its newest real position over 170 ms (up to 1.7× when it keeps moving). A fake tick, run when a real
// update is late, carries no positions, so it must not restart the slide.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 2000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
    game.update();
    const { default: CameraManager } = await import("@rendering/core/CameraManager");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    return { CameraManager, enemy: PlayerManager.get(2)! };
}

describe("Smooth movement", () => {
    it("slides a moving player toward its new position between updates", async () => {
        const { CameraManager, enemy } = await setUp();
        game!.update([{ sid: 2, x: 2100 }]);
        CameraManager.lerpEntities(85); // half of the 170 ms slide
        expect(enemy.render_position.x).toBeCloseTo(2050);
    });

    it("keeps sliding through a fake tick instead of pulling the player back (lag spike)", async () => {
        const { CameraManager, enemy } = await setUp();
        game!.update([{ sid: 2, x: 2100 }]);
        CameraManager.lerpEntities(85);
        const before = enemy.render_position.x;

        // A fake tick: the real update is late, so the batcher runs the tick with no positions.
        game!.handlers.a([], [], []);
        CameraManager.lerpEntities(85);

        // It used to restart the slide from 2050 toward 2100; now it continues where it was (2100 at 170 ms).
        expect(enemy.render_position.x).toBeGreaterThan(before);
        expect(enemy.render_position.x).toBeCloseTo(2100);
        expect(enemy.last_render_position.x).toBeCloseTo(2000);
    });

    it("restarts the slide when the late real update arrives", async () => {
        const { CameraManager, enemy } = await setUp();
        game!.update([{ sid: 2, x: 2100 }]);
        CameraManager.lerpEntities(85);
        game!.handlers.a([], [], []);
        CameraManager.lerpEntities(85);

        game!.update([{ sid: 2, x: 2200 }]);
        expect(enemy.deltaTime).toBe(0);
        expect(enemy.last_render_position.x).toBeCloseTo(2100);
        CameraManager.lerpEntities(85);
        expect(enemy.render_position.x).toBeCloseTo(2150);
    });
});
