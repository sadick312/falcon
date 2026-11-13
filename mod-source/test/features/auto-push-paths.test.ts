// Auto Push (AutoPusher): the paths auto-push.test.ts doesn't reach. Once the pathfinder answers, Auto Push walks to
// the route's next node; a route that no longer ends at the push spot is thrown away and asked for again; and with
// the enemy already on the spike it stands still for a tick, then pushes again if the spike didn't hurt them.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

interface Point { x: number; y: number }

/** Lets the pathfinder's answer (a resolved promise) reach AutoPusher before the next tick. */
async function flush() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** The enemy is trapped at (1100, 1000) with our spike at (spikeX, 1000); we stand at (meX, 1000). */
async function setUp(meX: number, spikeX: number, route?: (start: Point, goal: Point) => Point[]) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: ["autoPush"] });
    game.spawn({ sid: ME, x: meX, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1100, y: 1000 });
    game.setLoadout([5], [0, 3, 6, 15]);
    game.addObjects([
        { sid: 700, x: spikeX, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: ME },
        { sid: 600, x: 1100, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME }
    ]);

    const { default: AutoPusher } = await import("@core/mod/combat/core/AutoPusher");
    const { default: Pathfinder } = await import("@services/pathfinding/Pathfinder");
    const find = vi.spyOn(Pathfinder, "find").mockImplementation((start: Point, goal: Point) =>
        Promise.resolve(route ? route({ ...start }, { ...goal }) : []));
    return { AutoPusher, find };
}

describe("Auto Push: routes and stopping", () => {
    it("walks to the next node of the route once the pathfinder answers", async () => {
        // A detour straight up, then to the push spot.
        const { AutoPusher, find } = await setUp(950, 1180, (start, goal) => [start, { x: start.x, y: start.y - 60 }, goal]);
        game!.update();
        expect(find).toHaveBeenCalledTimes(1);
        await flush();

        game!.update();
        expect(find).toHaveBeenCalledTimes(1);
        expect(AutoPusher.autoPushing).toBe(true);
        expect(Math.sin(AutoPusher.moveDir!)).toBeLessThan(-0.9);
    });

    it("asks again when the route doesn't end at the push spot", async () => {
        const { find } = await setUp(950, 1180, (start, goal) => [start, { x: goal.x, y: goal.y + 100 }]);
        game!.update();
        await flush();
        game!.update();
        expect(find).toHaveBeenCalledTimes(2);
    });

    it("stands still for one tick with the enemy on the spike, then pushes again if it didn't hurt them", async () => {
        const { AutoPusher } = await setUp(1020, 1140);
        game!.update();
        expect(AutoPusher.autoPushing).toBe(true);
        expect(AutoPusher.moveDir).toBeNull();

        game!.update();
        expect(AutoPusher.moveDir).not.toBeNull();
    });
});
