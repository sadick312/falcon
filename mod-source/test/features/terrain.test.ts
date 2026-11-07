// B3: the ground under a player, checked against 1.8.2's Player.update (index-8f264913.js):
// - water (slowdown and the eastward current) applies only off platforms: `!this.zIndex && |y - 7200| <= 362`, where
//   zIndex is what the previous tick's collisions set (the server sends it in each player update);
// - snow slows players without a cold-immune hat (×0.75), water ×0.33 (×0.75 with flipper hat).
// Movement simulation, the Hat System's flipper hat and Safe Walk's projection all follow these rules.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const RIVER_Y = 7200;
const BOOSTER = 12;
const FLIPPER = 31;

async function setUp(y: number, zIndex = 0, objects: { sid: number; x: number; y: number; itemId: number; owner?: number }[] = []) {
    game = await startGame();
    game.spawn({ sid: ME, x: 3000, y, weaponIndex: 5, zIndex });
    game.spawn({ sid: 2, x: 12000, y: 12000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.addObjects(objects);
    game.update();
    const { default: Sim } = await import("@core/mod/simulation/MovementPhysicsSimulator");
    const { LIST_ID_MAP } = await import("@constants/items");
    return { Sim, LIST_ID_MAP, player: game.Client.player };
}

describe("water and platforms in the movement simulation", () => {
    it("the river current pushes a player east", async () => {
        const { Sim, player } = await setUp(RIVER_Y);
        const state = player.getSimulationState();
        state.velX = 0;
        state.velY = 0;

        const next = Sim.simTick(state, null);
        expect(next.velX).toBeGreaterThan(0);
    });

    it("but not a player who stood on a platform last tick", async () => {
        const { Sim, player } = await setUp(RIVER_Y, 1);
        const state = player.getSimulationState();
        expect(state.zIndex).toBe(1);
        state.velX = 0;
        state.velY = 0;

        const next = Sim.simTick(state, null);
        expect(next.velX).toBe(0);
    });

    it("and walking on a platform isn't slowed by the water", async () => {
        const off = await setUp(RIVER_Y, 0);
        const offState = off.player.getSimulationState();
        offState.velX = offState.velY = 0;
        const inWater = off.Sim.simTick(offState, Math.PI / 2).velY;
        game!.done();

        const on = await setUp(RIVER_Y, 1);
        const onState = on.player.getSimulationState();
        onState.velX = onState.velY = 0;
        const onPlatform = on.Sim.simTick(onState, Math.PI / 2).velY;

        expect(onPlatform / inWater).toBeCloseTo(1 / 0.33, 5);
    });

    it("standing on a platform sets zIndex for the next tick; it resets once off it", async () => {
        const { LIST_ID_MAP: ids } = await import("@constants/items");
        const { Sim, player } = await setUp(RIVER_Y, 0, [{ sid: 800, x: 3000, y: RIVER_Y, itemId: ids.PLATFORM, owner: ME }]);
        const state = player.getSimulationState();
        state.velX = state.velY = 0;

        const onIt = Sim.simTick(state, null);
        expect(onIt.zIndex).toBe(1);

        const away = Sim.simTick({ ...onIt, x: 5000, velX: 0, velY: 0 }, null);
        expect(away.zIndex).toBe(0);
    });
});

describe("flipper hat", () => {
    /** One tick moving right; the hat we switched to, or undefined. */
    async function hatAt(y: number, zIndex: number) {
        await setUp(y, zIndex);
        game!.Client.lastMoveDir = 0;
        const before = game!.sent.length;
        game!.update([{ sid: ME, zIndex }]);
        const change = game!.sent.slice(before).find(p => p.type === "c" && p.args[0] === false && p.args[2] === false);
        return change?.args[1] as number | undefined;
    }

    it("is worn in the river", async () => {
        expect(await hatAt(RIVER_Y, 0)).toBe(FLIPPER);
    });

    it("isn't worn on a platform over the river, where the water doesn't slow us", async () => {
        expect(await hatAt(RIVER_Y, 1)).toBe(BOOSTER);
    });
});
