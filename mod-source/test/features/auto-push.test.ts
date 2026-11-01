// Feature #16, Auto Push (AutoPusher): with a trapped enemy in range, picks the best enemy-dangerous spike near the
// trap, walks to the spot that pushes the enemy into it (pathfinding when more than 110 away), and stops once the
// enemy is on the spike.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

interface Scenario {
    enable?: boolean;
    trapped?: boolean;
    meX?: number;
    shift?: boolean;
    ticks?: number;
}

/** The enemy is trapped at (1100, 1000) with our spike to its right (1180); we approach from the left. */
async function play(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["autoPush"] });
    game.spawn({ sid: ME, x: s.meX ?? 1020, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1100, y: 1000 });
    game.setLoadout([5], [0, 3, 6, 15]);
    const objects = [{ sid: 700, x: 1180, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: ME }];
    if (s.trapped !== false) objects.push({ sid: 600, x: 1100, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME });
    game.addObjects(objects);

    const { Input } = await import("@ui/Hook");
    const { default: AutoPusher } = await import("@core/mod/combat/core/AutoPusher");
    const { default: Pathfinder } = await import("@services/pathfinding/Pathfinder");
    const find = vi.spyOn(Pathfinder, "find").mockImplementation(() => new Promise(() => { }));
    Input.keys["ShiftLeft"] = !!s.shift;
    try {
        for (let i = 0; i < (s.ticks ?? 2); i++) game.update();
    } finally {
        Input.keys["ShiftLeft"] = false;
    }
    return { AutoPusher, pathRequests: find.mock.calls.length };
}

describe("Auto Push", () => {
    it("pushes: walks toward the enemy on the side away from the spike", async () => {
        const { AutoPusher } = await play();
        expect(AutoPusher.autoPushing).toBe(true);
        expect(AutoPusher.theSpike?.sid).toBe(700);
        // Moving right (toward +x), which drives the enemy into the spike on its right.
        expect(Math.cos(AutoPusher.moveDir!)).toBeGreaterThan(0.9);
    });

    it("does nothing when the enemy isn't trapped", async () => {
        const { AutoPusher } = await play({ trapped: false });
        expect(AutoPusher.autoPushing).toBe(false);
        expect(AutoPusher.theSpike).toBeUndefined();
    });

    it("does nothing out of range, with the toggle off, or while holding Shift", async () => {
        expect((await play({ meX: 600 })).AutoPusher.autoPushing).toBe(false);
        expect((await play({ enable: false })).AutoPusher.autoPushing).toBe(false);
        expect((await play({ shift: true })).AutoPusher.autoPushing).toBe(false);
    });

    it("asks the pathfinder for a route when more than 110 away", async () => {
        const { pathRequests } = await play({ meX: 950, ticks: 1 });
        expect(pathRequests).toBe(1);
    });

    it("today asks again every tick while the first route is still being worked out (possible issue P9)", async () => {
        const { pathRequests } = await play({ meX: 950, ticks: 4 });
        expect(pathRequests).toBe(4);
    });
});
