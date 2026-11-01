// Feature #35, Movement / knockback simulation (MovementPhysicsSimulator, SimulationStates): replays 1.8.2's player
// physics (Player.update + checkCollision in game.js) to predict where a player ends up: movement speed with weapon /
// hat / tail / snow / river multipliers, the river current, 1-4 sub-steps per tick by speed, push-out from buildings
// (velocity × 0.75), spike damage and the 1.5 bounce, pit traps, boost pads, teleporters, deceleration (0.993^dt) and
// the map edge. Knockback and damage actions can be applied per tick.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

type Building = { x: number; y: number; itemId: "SPIKES" | "PIT_TRAP" | "WOOD_WALL"; owner?: number };

async function setUp(buildings: Building[] = []) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.addObjects(buildings.map((b, i) => ({ sid: 900 + i, x: b.x, y: b.y, itemId: LIST_ID_MAP[b.itemId], owner: b.owner ?? 2 })));
    game.update();
    game.update();
    const { default: Sim } = await import("@core/mod/simulation/MovementPhysicsSimulator");
    /** Our state at (x, 1000) moving right at `velX` per ms. */
    const state = (x: number, velX: number) => {
        const s = game!.Client.player.getSimulationState();
        s.x = x;
        s.y = 1000;
        s.velX = velX;
        s.velY = 0;
        return s;
    };
    return { Sim, state };
}

describe("Movement / knockback simulation", () => {
    it("slows a moving player by 0.993^111 per tick", async () => {
        const { Sim, state } = await setUp();
        const next = Sim.simTick(state(1000, 0.5), null);
        expect(next.velX).toBeCloseTo(0.5 * Math.pow(0.993, 111), 5);
        expect(next.x).toBeCloseTo(1000 + 0.5 * 111, 3);
    });

    it("counts an enemy spike hit: its damage and the bounce", async () => {
        const { Sim, state } = await setUp([{ x: 1150, y: 1000, itemId: "SPIKES" }]);
        const res = Sim.simulate(state(1000, 0.6), [], 1);
        expect(res.spikesHit).toBe(1);
        expect(res.totalDamage).toBe(20);
    });

    it("stops a player in an enemy pit trap", async () => {
        const { Sim, state } = await setUp([{ x: 1090, y: 1000, itemId: "PIT_TRAP" }]);
        const res = Sim.simulate(state(1000, 0.6), [], 2);
        expect(res.trapped).toBe(true);
    });

    it("counts spike damage in the one-tick step even after another simulation hit the same spike", async () => {
        // simTick never reset the "already hit this tick" marks, so a hit marked by an earlier simulate() was skipped.
        const { Sim, state } = await setUp([{ x: 1150, y: 1000, itemId: "SPIKES" }]);
        Sim.simulate(state(1000, 0.6), [], 1);
        const next = Sim.simTick(state(1000, 0.6), null);
        expect(next.spikeDamages).toBe(20);
    });

    it("handles each building once per tick, like 1.8.2 (P21)", async () => {
        // Fast into a wall (4 sub-steps). 1.8.2 handles each object once per tick (the `W` map in Player.update), so
        // the velocity is cut by 0.75 once; Falcon used to cut it again on every sub-step that still touched the wall.
        const { Sim, state } = await setUp([{ x: 1150, y: 1000, itemId: "WOOD_WALL" }]);
        const next = Sim.simTick(state(1000, 1.6), null);
        const oneCut = 1.6 * 0.75 * Math.pow(0.993, 111);
        expect(next.velX).toBeCloseTo(oneCut, 5);
    });
});
