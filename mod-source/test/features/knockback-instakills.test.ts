// Feature #3, Knockback Instakills (AutoInstakiller): a two-hit combo, bull helmet + primary then turret gear +
// secondary (reversed against a great hammer or a Spike Gear target), when the simulated combo pushes the enemy
// into a spike, kills or pit-traps them. Checked from the packets sent during real ticks.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const BULL_HELMET = 7;
const TURRET_GEAR = 53;

interface Scenario {
    enable?: boolean;
    weapons?: number[];
    spike?: boolean;
    enemyHat?: number;
}

/** Plays 4 ticks; returns, per tick, the weapon selected and hat equipped by the combo. */
async function play(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["attackFactoringKB:insta"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1100, y: 1000, skinIndex: s.enemyHat ?? 0 });
    game.setLoadout(s.weapons ?? [5, 15], [0, 3, 6, 10]);
    if (s.spike !== false) game.addObjects([{ sid: 500, x: 1180, y: 1000, itemId: LIST_ID_MAP.GREATER_SPIKES, owner: ME }]);
    for (let i = 0; i < 4; i++) game.update();

    const steps: [tick: number, weapon: unknown, hat: unknown][] = [];
    for (const hat of game.sent.filter(p => p.type === "c" && (p.args[1] === BULL_HELMET || p.args[1] === TURRET_GEAR))) {
        const weapon = game.sent.find(p => p.type === "z" && p.tick === hat.tick);
        steps.push([hat.tick, weapon?.args[0], hat.args[1]]);
    }
    return steps;
}

describe("Knockback Instakills", () => {
    it("runs bull + polearm, then turret gear + musket, when the knockback lands the enemy on a spike", async () => {
        expect(await play()).toEqual([[1, 5, BULL_HELMET], [2, 15, TURRET_GEAR]]);
    });

    it("doesn't repeat the combo while the musket is still reloading", async () => {
        // The old code marked our musket ready every tick until we had held it once, and planned another combo here.
        const steps = await play();
        expect(steps.filter(([tick]) => tick > 2)).toEqual([]);
    });

    it("reverses the combo with the great hammer we actually own", async () => {
        // Our weapons come from UPDATE_ITEMS; the old code guessed a musket for us too and switched to item 15.
        expect((await play({ weapons: [5, 10] })).slice(0, 2)).toEqual([[1, 10, TURRET_GEAR], [2, 5, BULL_HELMET]]);
    });

    it("reverses the combo against a Spike Gear target", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        expect((await play({ enemyHat: STORE_HAT_MAP.SPIKE_GEAR })).slice(0, 2)).toEqual([[1, 15, TURRET_GEAR], [2, 5, BULL_HELMET]]);
    });

    it("does nothing without a spike to push into", async () => {
        expect(await play({ spike: false })).toEqual([]);
    });

    it("does nothing without a secondary weapon", async () => {
        expect(await play({ weapons: [5] })).toEqual([]);
    });

    it("does nothing when the toggle is off", async () => {
        expect(await play({ enable: false })).toEqual([]);
    });
});

describe("Knockback Instakills damage estimate", () => {
    it("doesn't apply the Monkey Tail cut to a projectile secondary in the reversed combo", async () => {
        const { STORE_ACCESSORY_MAP, STORE_HAT_MAP } = await import("@constants/store");
        game = await startGame({ enable: ["attackFactoringKB:insta"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5, tailIndex: STORE_ACCESSORY_MAP.MONKEY_TAIL });
        game.spawn({ sid: 2, x: 1100, y: 1000, skinIndex: STORE_HAT_MAP.SPIKE_GEAR });
        game.setLoadout([5, 15], [0, 3, 6, 10]);
        game.update();

        const { default: AutoInstakiller } = await import("@combat-modules/AutoInstakiller");
        const { default: PlayerCombatManager } = await import("@core/logic/players/core/PlayerCombatManager");
        const module = new AutoInstakiller() as unknown as {
            modifySimulationActions(...args: unknown[]): void;
            simulationActions: { damage?: number }[][];
        };
        const player = game.Client.player;
        const primary = { ...PlayerCombatManager.fetch(player, 0) };
        const secondary = { ...PlayerCombatManager.fetch(player, 1) };

        // (player, isFasterExecution, shouldReverseInsta, hasProjectile, primary, secondary)
        module.modifySimulationActions(player, true, true, true, primary, secondary);
        // Musket: 50 damage, not 50 x 0.2.
        expect(module.simulationActions[0][1].damage).toBe(50);
    });
});

describe("Knockback Instakills: when it holds back, and Auto Insta (ATOS)", () => {
    interface Setup {
        enable?: string[];
        weapons?: number[];
        enemyX?: number;
        /** Server update order for the checked tick (default: us first). */
        order?: number[];
        before?: (ctx: { game: Game }) => Promise<void> | void;
    }

    /** Polearm + musket, greater spike behind the enemy (as in play()); returns the attack started on the checked tick. */
    async function reason(s: Setup = {}) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: s.enable ?? ["attackFactoringKB:insta"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: (s.weapons ?? [5, 15])[0] });
        game.spawn({ sid: 2, x: s.enemyX ?? 1100, y: 1000 });
        game.setLoadout(s.weapons ?? [5, 15], [0, 3, 6, 10, 15]);
        game.addObjects([{ sid: 500, x: (s.enemyX ?? 1100) + 80, y: 1000, itemId: LIST_ID_MAP.GREATER_SPIKES, owner: ME }]);
        game.update();
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        // The setup tick may already have started a combo; only an attack started on the checked tick counts.
        AttackManager.stopAttackAction();
        await s.before?.({ game });
        game.update([], s.order);
        return AttackManager.currentAttackAction?.reason;
    }

    it("runs the combo when the enemy updates before us too", async () => {
        expect(await reason({ order: [2, ME] })).toBe("autoInstaKill");
    });

    it("waits when the enemy is out of reach", async () => {
        expect(await reason({ enemyX: 1400 })).toBeUndefined();
    });

    it("never runs with a tool hammer as the primary", async () => {
        expect(await reason({ weapons: [0, 15] })).toBeUndefined();
    });

    it("leaves a trapped enemy alone, unless Auto Insta (ATOS) asked for it", async () => {
        const trap = async ({ game }: { game: Game }) => {
            const { LIST_ID_MAP } = await import("@constants/items");
            game.addObjects([{ sid: 600, x: 1100, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME }]);
        };
        expect(await reason({ before: trap })).toBeUndefined();

        const atos = await reason({
            before: async (ctx) => {
                await trap(ctx);
                const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
                AttackManager.autoInstaToggle = true;
            }
        });
        expect(atos).toBe("ATOS");
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        expect(AttackManager.autoInstaToggle).toBe(false);
    });

    it("Auto Insta (ATOS) runs even with the toggle off", async () => {
        expect(await reason({
            enable: [],
            before: async () => {
                const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
                AttackManager.autoInstaToggle = true;
            }
        })).toBe("ATOS");
    });

    it("stands down while Auto Place is about to re-trap the enemy", async () => {
        expect(await reason({
            before: async () => {
                const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
                // probePlacements sets this each tick; keep it set for the checked tick.
                const probe = vi.spyOn(AttackManager as unknown as { probePlacements(): void }, "probePlacements");
                probe.mockImplementation(() => { AttackManager.placeIntent.retrap = true; });
            }
        })).toBeUndefined();
    });

    it("waits while we're trapped, unless 'Allow In Trap' is on", async () => {
        const trapUs = async ({ game }: { game: Game }) => {
            const { LIST_ID_MAP } = await import("@constants/items");
            game.addObjects([{ sid: 601, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: 2 }]);
        };
        expect(await reason({ before: trapUs })).toBeUndefined();
        expect(await reason({ enable: ["attackFactoringKB:insta", "attackFactoringKB:insta:allowInTrap"], before: trapUs })).toBe("autoInstaKill");
    });

    it("waits on a fake tick, when the update order is unknown", async () => {
        game = await startGame({ enable: ["attackFactoringKB:insta"] });
        const { LIST_ID_MAP } = await import("@constants/items");
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1100, y: 1000 });
        game.setLoadout([5, 15], [0, 3, 6, 10]);
        game.addObjects([{ sid: 500, x: 1180, y: 1000, itemId: LIST_ID_MAP.GREATER_SPIKES, owner: ME }]);
        game.update();
        const { default: PlayerStateManager } = await import("@core/logic/players/core/PlayerStateManager");
        const { default: AutoInstakiller } = await import("@combat-modules/AutoInstakiller");
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        PlayerStateManager.placementMap.clear();
        const queued = vi.spyOn(AttackManager, "addAttackQueue");
        const module = new AutoInstakiller();
        module.init();
        module.run();
        expect(queued).not.toHaveBeenCalled();
    });
});
