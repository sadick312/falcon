// Feature #5, Spike Tick (SpikeTicker): while spike placements are graded, marks a spike next to a trapped enemy when
// our primary can hit them; when AutoReplacer places such a spike after a trap breaks, the next tick bull-hits.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ALL = ["spikeTick", "autoPlacing", "replacer"];

interface Scenario {
    enable?: string[];
    weapons?: number[];
    inTrap?: boolean;
    enemyX?: number;
    settings?: Record<string, unknown>;
}

async function setUp(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable ?? ALL, settings: s.settings });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: (s.weapons ?? [5])[0] });
    game.spawn({ sid: 2, x: s.enemyX ?? 1090, y: 1000 });
    game.setLoadout(s.weapons ?? [5, 10], [0, 3, 6, 15]);
    if (s.inTrap !== false) game.addObjects([{ sid: 600, x: s.enemyX ?? 1090, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME }]);
    game.update();

    const { default: ModManager } = await import("@core/ModManager");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    return { enemy: ModManager.enemyData.nearest!, AttackManager, LIST_ID_MAP };
}

async function marks(s: Scenario = {}) {
    const { enemy, AttackManager, LIST_ID_MAP } = await setUp(s);
    const angle = { grade: 0, id: LIST_ID_MAP.SPIKES, spikeTick: false };
    AttackManager.spikeTicker.process(angle as never, enemy);
    return angle.spikeTick;
}

describe("Spike Tick: marking a spike", () => {
    it("marks it when our polearm is reloaded and the trapped enemy is in range", async () => {
        expect(await marks()).toBe(true);
    });

    it("doesn't when the enemy isn't trapped", async () => {
        expect(await marks({ inTrap: false })).toBe(false);
    });

    it("doesn't when the enemy is out of polearm range", async () => {
        expect(await marks({ enemyX: 1300 })).toBe(false);
    });

    it("needs 'Allow Low Damage Primaries' for daggers", async () => {
        expect(await marks({ weapons: [7, 10] })).toBe(false);
        expect(await marks({ weapons: [7, 10], settings: { appleAllowsLowDamagePri: true } })).toBe(true);
    });
});

describe("Spike Tick: the hit", () => {
    it("bull-hits on the tick after a spike-tick spike was placed", async () => {
        const { AttackManager } = await setUp();
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        AttackManager.spikeTicker.consider = true;
        AttackManager.spikeTicker.run();
        expect(queued).toHaveBeenCalledTimes(1);
        expect(queued.mock.calls[0][0].sequence[0].reason).toBe("spikeTick");
    });

    it("does nothing without a spike-tick spike", async () => {
        const { AttackManager } = await setUp();
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        AttackManager.spikeTicker.run();
        expect(queued).not.toHaveBeenCalled();
    });

    it("forgets the chance if it can't hit on that tick, instead of hitting later", async () => {
        // Spike Tick off when the spike is placed, turned on two ticks later: the old code hit then.
        const { AttackManager } = await setUp({ enable: ["autoPlacing", "replacer"] });
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        AttackManager.spikeTicker.consider = true;
        AttackManager.spikeTicker.run();
        expect(AttackManager.spikeTicker.consider).toBe(false);

        game!.update();
        game!.update();
        game!.Menu.itemMap.spikeTick.status = true;
        AttackManager.spikeTicker.run();
        expect(queued).not.toHaveBeenCalled();
    });

    it("never hits while wearing the Monkey Tail", async () => {
        const { STORE_ACCESSORY_MAP } = await import("@constants/store");
        const { AttackManager } = await setUp();
        game!.update([{ sid: ME, tailIndex: STORE_ACCESSORY_MAP.MONKEY_TAIL }]);
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        AttackManager.spikeTicker.consider = true;
        AttackManager.spikeTicker.run();
        expect(queued).not.toHaveBeenCalled();
    });
});
