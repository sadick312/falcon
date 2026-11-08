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

    // Fixed scenarios with the expected numbers worked out from 1.8.2's formulas (dt = 111 ms per tick).
    const DT = 111;
    const DECEL = Math.pow(0.993, DT);
    const RIVER_Y = 7200; // the map's middle, inside the river band

    /** Our state at (x, y), standing still, with hat `skin` and platform flag `zIndex`. */
    async function stateAt(x: number, y: number, skin = 0, zIndex = 0) {
        const { Sim } = await setUp();
        const s = game!.Client.player.getSimulationState();
        Object.assign(s, { x, y, velX: 0, velY: 0, skinIndex: skin, zIndex, slowMult: 1, lockMove: false });
        return { Sim, s };
    }

    it("river: the current pushes a still player right by 0.0011 × dt per tick", async () => {
        const { WATER_CURRENT } = await import("@constants/world");
        const { Sim, s } = await stateAt(5000, RIVER_Y);
        const next = Sim.simTick(s, null);
        const vel = WATER_CURRENT * DT;
        expect(next.x).toBeCloseTo(5000 + vel * DT, 6);
        expect(next.y).toBe(RIVER_Y);
        expect(next.velX).toBeCloseTo(vel * DECEL, 9);
    });

    it("river: the Flipper Hat cuts the current to 40%", async () => {
        const { WATER_CURRENT } = await import("@constants/world");
        const { Sim, s } = await stateAt(5000, RIVER_Y, 31);
        const next = Sim.simTick(s, null);
        expect(next.x).toBeCloseTo(5000 + WATER_CURRENT * 0.4 * DT * DT, 6);
    });

    it("river: no current on a platform (zIndex), or just outside the band", async () => {
        const { RIVER_HALF_WIDTH } = await import("@constants/world");
        const onPlatform = await stateAt(5000, RIVER_Y, 0, 1);
        expect(onPlatform.Sim.simTick(onPlatform.s, null).x).toBe(5000);

        game?.done();
        const outside = await stateAt(5000, RIVER_Y - RIVER_HALF_WIDTH - 1);
        expect(outside.Sim.simTick(outside.s, null).x).toBe(5000);
    });

    it("river: swimming across is 0.33× the speed on land (0.75× with the Flipper Hat)", async () => {
        const up = -Math.PI / 2;
        const speedAt = async (y: number, skin = 0) => {
            game?.done();
            const { Sim, s } = await stateAt(5000, y, skin);
            return Sim.simTick(s, up).velY;
        };
        const land = await speedAt(3000);
        expect(land).toBeLessThan(0);
        expect(await speedAt(RIVER_Y)).toBeCloseTo(land * 0.33, 9);
        expect(await speedAt(RIVER_Y, 31)).toBeCloseTo(land * 0.75, 9);
    });

    it("knockback: pushes away from the hitter by knockPower, then slows by 0.993^dt each tick", async () => {
        const { Sim, s } = await stateAt(1000, 3000);
        const res = Sim.simulate(s, [[{ type: "knockback", pos: { x: 900, y: 3000 }, knockPower: 0.6 }]], 2);
        // Tick 1 moves 0.6 × dt, tick 2 the slowed 0.6 × 0.993^dt × dt; straight away from the hitter.
        expect(res.pos.x).toBeCloseTo(1000 + 0.6 * DT + 0.6 * DECEL * DT, 6);
        expect(res.pos.y).toBeCloseTo(3000, 9);
    });

    it("knockback: a diagonal hit splits the push by direction", async () => {
        const { Sim, s } = await stateAt(1000, 3000);
        const res = Sim.simulate(s, [[{ type: "knockback", pos: { x: 900, y: 2900 }, knockPower: 0.6 }]], 1);
        const each = 0.6 * Math.SQRT1_2 * DT;
        expect(res.pos.x).toBeCloseTo(1000 + each, 6);
        expect(res.pos.y).toBeCloseTo(3000 + each, 6);
    });

    it("knockback: deals its damage and counts a kill as a one-tick", async () => {
        const { Sim, s } = await stateAt(1000, 3000);
        const res = Sim.simulate(s, [[{ type: "knockback", pos: { x: 900, y: 3000 }, knockPower: 0.3, damage: 200 }]], 1);
        expect(res.oneTicked).toBe(true);
    });

    it("map edge: a knockback into the border stops at the player's radius", async () => {
        const { Sim, s } = await stateAt(60, 3000);
        const res = Sim.simulate(s, [[{ type: "knockback", pos: { x: 160, y: 3000 }, knockPower: 1 }]], 1);
        expect(res.pos.x).toBe(s.scale);
    });
});

