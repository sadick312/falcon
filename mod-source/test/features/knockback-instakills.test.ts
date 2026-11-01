// Feature #3, Knockback Instakills (AutoInstakiller): a two-hit combo, bull helmet + primary then turret gear +
// secondary (reversed against a great hammer or a Spike Gear target), when the simulated combo pushes the enemy
// into a spike, kills or pit-traps them. Checked from the packets sent during real ticks.
import { afterEach, describe, expect, it } from "vitest";
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
