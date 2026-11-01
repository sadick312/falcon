// P1: on a fake tick (PacketBatcher's stand-in when a real update is late) the server update order is unknown.
// Attack decisions that depend on it wait for a real tick; defensive predictions assume the worst.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

/** What PacketBatcher dispatches as a fake tick: an UPDATE_PLAYERS with no players. */
const fakeTick = (g: Game) => g.handlers.a([], [], []);

describe("PlayerStateManager.updatesBefore", () => {
    it("is true/false from the last real update, and null on a fake tick", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000 });
        game.spawn({ sid: 2, x: 1500, y: 1000 });
        const { default: PlayerStateManager } = await import("@core/logic/players/core/PlayerStateManager");

        game.update([], [ME, 2]);
        expect(PlayerStateManager.updatesBefore(ME, 2)).toBe(true);
        expect(PlayerStateManager.updatesBefore(2, ME)).toBe(false);

        fakeTick(game);
        expect(PlayerStateManager.updatesBefore(ME, 2)).toBeNull();
    });
});

describe("attacks on a fake tick", () => {
    it("Velocity Hits waits, even where it would hit on a real tick", async () => {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["velocityHits"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1110, y: 1000 });
        game.setLoadout([5], [0, 3, 6, 10]);
        game.addObjects([{ sid: 500, x: 1180, y: 1000, itemId: LIST_ID_MAP.GREATER_SPIKES, owner: ME }]);
        // The enemy really updates first, which Velocity Hits must not attack into.
        for (let i = 0; i < 3; i++) game.update([], [2, ME]);
        fakeTick(game);

        const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const { default: VelocityAttacker } = await import("@combat-modules/VelocityAttacker");
        const module = new VelocityAttacker();
        module.init();
        DefenseSystem.canPlaceOnMe = false;
        const queued = vi.spyOn(AttackManager, "addAttackQueue");
        module.run();
        expect(queued).not.toHaveBeenCalled();
    });

    it("Knockback Hits waits for the next real tick", async () => {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["attackFactoringKB:hits"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1100, y: 1000 });
        game.setLoadout([5], [0, 3, 6, 10]);
        game.addObjects([{ sid: 500, x: 1180, y: 1000, itemId: LIST_ID_MAP.GREATER_SPIKES, owner: ME }]);

        // The first tick after spawning is a fake one: no bull hit. The next real tick hits.
        fakeTick(game);
        const BULL_HELMET = 7;
        const bull = () => game!.sent.filter(p => p.type === "c" && p.args[1] === BULL_HELMET).length;
        expect(bull()).toBe(0);
        game.update();
        expect(bull()).toBe(1);
    });
});
