// Feature #1, Velocity Hits (VelocityAttacker): a bull-helmet hit on an enemy standing next to one of our spikes,
// when the hit plus the spike would do at least 100 damage.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

interface Scenario {
    enable?: boolean;
    spike?: "SPIKES" | "GREATER_SPIKES";
    spikeOwner?: number;
    /** Server update order; we update first by default. */
    order?: number[];
    tail?: number;
    enemyX?: number;
}

/** Sets the scene, then runs the module once on its own. Returns how many attacks it queued. */
async function velocityHit(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["velocityHits"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5, tailIndex: s.tail ?? 0 });
    game.spawn({ sid: 2, x: s.enemyX ?? 1110, y: 1000 });
    game.spawn({ sid: 3, x: 3000, y: 3000 });
    game.setLoadout([5], [0, 3, 6, 10]);
    game.addObjects([{ sid: 500, x: (s.enemyX ?? 1110) + 70, y: 1000, itemId: LIST_ID_MAP[s.spike ?? "GREATER_SPIKES"], owner: s.spikeOwner ?? ME }]);
    for (let i = 0; i < 3; i++) game.update([], s.order);

    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: VelocityAttacker } = await import("@combat-modules/VelocityAttacker");

    const module = new VelocityAttacker();
    module.init();
    // In polearm range the enemy can nearly always place a spike on us, and the module then holds back on purpose.
    DefenseSystem.canPlaceOnMe = false;
    const queued = vi.spyOn(AttackManager, "addAttackQueue");
    module.run();
    return queued.mock.calls.length;
}

describe("Velocity Hits", () => {
    it("hits when polearm (45 x 1.5) plus a greater spike (35) reaches 100", async () => {
        expect(await velocityHit()).toBe(1);
    });

    it("holds back when a normal spike (20) leaves it short of 100", async () => {
        expect(await velocityHit({ spike: "SPIKES" })).toBe(0);
    });

    it("does nothing when the toggle is off", async () => {
        expect(await velocityHit({ enable: false })).toBe(0);
    });

    it("ignores spikes owned by the enemy itself", async () => {
        expect(await velocityHit({ spikeOwner: 2 })).toBe(0);
    });

    it("counts spikes owned by another player", async () => {
        expect(await velocityHit({ spikeOwner: 3 })).toBe(1);
    });

    it("only hits when the enemy updates after us on the server (gold tech)", async () => {
        expect(await velocityHit({ order: [2, ME, 3] })).toBe(0);
    });

    it("never hits while wearing the Monkey Tail", async () => {
        const { STORE_ACCESSORY_MAP } = await import("@constants/store");
        expect(await velocityHit({ tail: STORE_ACCESSORY_MAP.MONKEY_TAIL })).toBe(0);
    });

    it("needs the enemy within polearm range", async () => {
        expect(await velocityHit({ enemyX: 1300 })).toBe(0);
    });
});
