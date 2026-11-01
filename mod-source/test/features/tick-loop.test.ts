// Feature #47, Tick loop (ModManager): on every player update, in order: reset the tick's state, run queued actions,
// update players (traps, turrets, enemy placements, our predicted next position, projectiles, ghosts), Auto Break's
// target, the Defense System's threat scan, which objects will break, Auto Place's spots, Auto Push, the attack
// modules, the Combat Controller, the Defense System's response (healing, hats, movement), placements, the aim, and
// clean-up. Nothing runs before we've spawned.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const POLEARM = 5;

describe("Tick loop", () => {
    it("doesn't run before we've spawned, then counts ticks", async () => {
        game = await startGame();
        const { default: ModManager } = await import("@core/ModManager");
        const before = game.sent.length;
        game.handlers.a([], [], []);
        expect(game.sent.length).toBe(before);

        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
        const tick = ModManager.tick;
        game.update();
        game.update();
        expect(ModManager.tick).toBe(tick + 2);
        expect(ModManager.brainState.tick).toBe(tick + 2);
    });

    it("clears the tick's projectile damage at the end of the tick", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
        game.update();
        game.Client.player.projDamages.push(25);
        game.update();
        expect(game.Client.player.projDamages).toEqual([]);
        expect(game.Client.player.hadProjDamages).toBe(true);
    });

    it("expects a wall to break when a Samurai Armor polearm is ready next tick", async () => {
        // The reload left is 0.2 of 700 ms; in Samurai Armor (×0.78) one tick (111 ms) is enough. This check used the
        // plain weapon speed, so it didn't expect the hit.
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.spawn({ sid: 2, x: 1300, y: 1000, weaponIndex: POLEARM });
        game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
        game.addObjects([{ sid: 701, x: 1300, y: 1090, itemId: LIST_ID_MAP.WOOD_WALL, owner: ME }]);
        game.update();
        game.update();

        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        const enemy = PlayerManager.get(2)!;
        const wall = ObjectManager.getObject(701)!;
        wall.health = 1;
        enemy.reloads[POLEARM] = 0.8;
        enemy.reloadTimes[POLEARM] = 700 * 0.78;
        const { default: ModManager } = await import("@core/ModManager");
        (ModManager as unknown as { updateObjects(): void }).updateObjects();
        expect(wall.willBreak).toBe(true);
    });
});
