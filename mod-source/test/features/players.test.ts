// Feature #45, Players (PlayerManager, PlayerEntityHandler, PlayerCombatManager, PlayerPlacementManager,
// PlayerStateManager): the player list (by sid and id, plus the visible ones), each player's weapons (seen when held,
// otherwise guessed), reloads (only the held weapon reloads, as in 1.8.2), trap state, and the server update order.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const POLEARM = 5;
const DAGGERS = 7;
const GREAT_HAMMER = 10;
const MUSKET = 15;
const SAMURAI_ARMOR = 20;

async function setUp(enemy: { weaponIndex?: number; skinIndex?: number; x?: number } = {}) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
    game.spawn({ sid: 2, x: enemy.x ?? 1300, y: 1000, weaponIndex: enemy.weaponIndex ?? POLEARM, skinIndex: enemy.skinIndex ?? 0 });
    game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
    game.update();
    game.update();
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { default: PlayerStateManager } = await import("@core/logic/players/core/PlayerStateManager");
    return { PlayerManager, PlayerStateManager, enemy: PlayerManager.get(2)! };
}

describe("Players", () => {
    it("knows every player by sid and id, and forgets one who leaves", async () => {
        const { PlayerManager } = await setUp();
        const enemy = PlayerManager.get(2)!;
        expect(PlayerManager.get(enemy.id)).toBe(enemy);
        expect(PlayerManager.players.visible.all).toContain(enemy);
        PlayerManager.remove(enemy);
        expect(PlayerManager.get(2)).toBeUndefined();
        expect(PlayerManager.players.visible.all).not.toContain(enemy);
        expect(PlayerManager.players.handler.all.map(p => p.sid)).toEqual([ME]);
    });

    it("knows the server update order, and says so when it doesn't", async () => {
        const { PlayerStateManager } = await setUp();
        game!.update([], [2, ME]);
        expect(PlayerStateManager.updatesBefore(2, ME)).toBe(true);
        expect(PlayerStateManager.updatesBefore(ME, 99)).toBeNull();
    });

    it("marks a player standing in an enemy pit trap as trapped", async () => {
        const { LIST_ID_MAP } = await import("@constants/items");
        const { enemy } = await setUp();
        game!.addObjects([{ sid: 600, x: 1300, y: 1020, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME }]);
        game!.update();
        game!.update();
        expect(enemy.trap?.sid).toBe(600);
    });

    it("restarts the reload of the weapon used, and refills it at the weapon's speed", async () => {
        const { default: items } = await import("@constants/items");
        const { enemy } = await setUp();
        game!.handlers.K(2, false, POLEARM);
        expect(enemy.reloads[POLEARM]).toBe(0);
        const ticks = Math.ceil(items.weapons[POLEARM].speed / 111) + 1;
        for (let i = 0; i < ticks; i++) game!.update();
        expect(enemy.reloads[POLEARM]).toBe(1);
    });

    it("guesses a great hammer as the unseen secondary of a daggers player, else a musket (P24)", async () => {
        // A leftover line used to overwrite the great-hammer guess with the musket.
        const daggers = await setUp({ weaponIndex: DAGGERS });
        expect(daggers.enemy.weaponData.primary).toBe(DAGGERS);
        expect(daggers.enemy.weaponData.secondary).toBe(GREAT_HAMMER);
        expect(daggers.enemy.reloads[GREAT_HAMMER]).toBe(1);
        const polearm = await setUp({ weaponIndex: POLEARM });
        expect(polearm.enemy.weaponData.secondary).toBe(MUSKET);
    });

    it("reloads 22% faster after a swing in Samurai Armor, as 1.8.2 does (P25)", async () => {
        // 1.8.2: reload = weapon.speed × hat.atkSpd (Samurai Armor 0.78): a polearm is ready after 546 ms. Falcon
        // used the plain 700 ms, so after 666 ms it still thought the polearm was reloading.
        const { default: items } = await import("@constants/items");
        const { enemy } = await setUp({ skinIndex: SAMURAI_ARMOR });
        game!.handlers.K(2, false, POLEARM);
        const ticks = Math.ceil(items.weapons[POLEARM].speed * 0.8 / 111);
        for (let i = 0; i < ticks; i++) game!.update();
        expect(enemy.reloads[POLEARM]).toBe(1);
    });

    it("uses the plain reload time without Samurai Armor", async () => {
        const { default: items } = await import("@constants/items");
        const { enemy } = await setUp();
        game!.handlers.K(2, false, POLEARM);
        const ticks = Math.ceil(items.weapons[POLEARM].speed * 0.8 / 111);
        for (let i = 0; i < ticks; i++) game!.update();
        expect(enemy.reloads[POLEARM]).toBeLessThan(1);
    });
});
