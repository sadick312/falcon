// Feature #51, Packet handlers (SocketListener, socket/events): one handler per server packet. Player updates, swings,
// health (damage, healing, shame, the bull-helmet timer), store, animals, objects, projectiles, alliances, chat,
// leaderboard, death and respawn.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1300, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    return { PlayerManager };
}

describe("Packet handlers", () => {
    it("forget a player who leaves (REMOVE_PLAYER)", async () => {
        const { PlayerManager } = await setUp();
        const enemy = PlayerManager.get(2)!;
        game!.handlers.E(enemy.id);
        expect(PlayerManager.get(2)).toBeUndefined();
    });

    it("keep our item counts (UPDATE_ITEM_COUNTS)", async () => {
        await setUp();
        game!.handlers.S(3, 5);
        expect(game!.Client.player.itemCounts[3]).toBe(5);
    });

    it("count shame when we heal right after a hit, and lose 2 when we heal later", async () => {
        await setUp();
        const player = game!.Client.player;
        game!.setHealth(ME, 60);
        game!.setHealth(ME, 80); // same tick: shame +1
        expect(player.shameCount).toBe(1);
        game!.setHealth(ME, 70);
        game!.update();
        game!.update();
        game!.setHealth(ME, 90); // 2 ticks later: shame -2, not below 0
        expect(player.shameCount).toBe(0);
    });

    it("restart a turret's count when it fires (SHOOT_TURRET)", async () => {
        const { LIST_ID_MAP } = await import("@constants/items");
        await setUp();
        game!.addObjects([{ sid: 800, x: 1500, y: 1000, itemId: LIST_ID_MAP.TURRET, owner: 2 }]);
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        const turret = ObjectManager.getObject(800)!;
        turret.reload = 15;
        game!.handlers.M(800, Math.PI);
        expect(turret.reload).toBe(0);
    });

    it("today counts a healing-pad heal right after a hit as eating (possible issue P26)", async () => {
        // 1.8.2 only changes shame when food is eaten (`consume`); regen, accessories and healing pads don't.
        // A +15 healing-pad tick in the same tick as a hit still adds shame here.
        await setUp();
        const player = game!.Client.player;
        game!.setHealth(ME, 60);
        game!.setHealth(ME, 75);
        expect(player.shameCount).toBe(1);
    });
});
