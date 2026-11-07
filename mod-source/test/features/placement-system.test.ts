// Feature #17, Placement System: placing one item (checkPlace / place, with the building limit), the placement
// hotkeys (H, Q, F, V, K), and starting Auto Place for an enemy within "Range".
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const SPIKES = 6;

async function setUp(enable: string[] = []) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1300, y: 1000 });
    // Food, wall, spikes, windmill, pit trap: Auto Place needs the trap in the 5th slot.
    game.setLoadout([5], [0, 3, SPIKES, 10, 15]);
    // The packet budget is only switched on by a live connection; replay mode leaves it off (every request: 0).
    const { default: PacketTracker } = await import("@core/utils/PacketTracker");
    PacketTracker.init();
    game.update();
    const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
    return PlacementSystem;
}

const placedNow = () => game!.sent.filter(p => p.type === "z" && p.args[1] === false).map(p => p.args[0]);

describe("Placement System: placing one item", () => {
    it("places on a free spot: select the item, then 'hit' at the angle", async () => {
        const PlacementSystem = await setUp();
        expect(PlacementSystem.checkPlace(SPIKES, Math.PI)).toBe(true);
        expect(placedNow()).toEqual([SPIKES]);
        expect(game!.sent.find(p => p.type === "F")?.args).toEqual([1, Math.PI]);
    });

    it("doesn't place on an occupied spot, or an item we don't have", async () => {
        const PlacementSystem = await setUp();
        // A tree where the spike would go (35 + 49 to our left).
        game!.addObjects([{ sid: 900, x: 1000 - 84, y: 1000, scale: 80, type: 0 }]);
        game!.update(); // the nearby-object lists are rebuilt once per tick
        expect(PlacementSystem.checkPlace(SPIKES, Math.PI)).toBe(false);
        expect(PlacementSystem.checkPlace(7, 0)).toBe(false);
        expect(placedNow()).toEqual([]);
    });

    it("stops at the building limit", async () => {
        const PlacementSystem = await setUp();
        const { default: items } = await import("@constants/items");
        const group = items.list[SPIKES].group;
        game!.Client.player.itemCounts[group.id] = group.sandboxLimit ?? 99;
        PlacementSystem.place(SPIKES, 0);
        expect(placedNow()).toEqual([]);
    });

    it("tells the caller what happened: placed, full or not owned (B4)", async () => {
        const PlacementSystem = await setUp();
        const { default: items } = await import("@constants/items");
        const group = items.list[SPIKES].group;

        expect(PlacementSystem.place(SPIKES, 0)).toBe("placed");
        expect(PlacementSystem.place(7, 0)).toBe("not-owned");

        game!.Client.player.itemCounts[group.id] = 99;
        expect(PlacementSystem.place(SPIKES, 0)).toBe("full");
        // A caller's own running count (several placements before the server's count arrives) is used when given.
        expect(PlacementSystem.place(SPIKES, 0, 98)).toBe("placed");
        expect(placedNow()).toEqual([SPIKES, SPIKES]);
    });

    it("uses 1.8.2's sandbox limits: 299 for windmills, 99 for spikes", async () => {
        const PlacementSystem = await setUp();
        expect(PlacementSystem.getPlaceLimit(10)).toBe(299);
        expect(PlacementSystem.getPlaceLimit(SPIKES)).toBe(99);
        expect(PlacementSystem.getPlaceLimit(0)).toBeUndefined(); // food has no limit
    });

    it("checkPlace says no, and draws no marker, when the building limit is full", async () => {
        const PlacementSystem = await setUp();
        const { default: items } = await import("@constants/items");
        game!.Client.player.itemCounts[items.list[SPIKES].group.id] = 99;
        game!.Client.markers.length = 0;

        expect(PlacementSystem.checkPlace(SPIKES, Math.PI)).toBe(false);
        expect(game!.Client.markers).toHaveLength(0);
    });
});

describe("Placement System: hotkeys", () => {
    it("V places a spike, and only counts toward the 4-per-tick cap if it really placed", async () => {
        const PlacementSystem = await setUp();
        const { Input } = await import("@ui/Hook");
        vi.spyOn(Input, "getAttackDir").mockReturnValue(Math.PI);
        const macro = (PlacementSystem as unknown as { macro(): void }).macro.bind(PlacementSystem);

        Input.keys["KeyV"] = true;
        try {
            PlacementSystem.totalPlacements = 0;
            macro();
            expect(PlacementSystem.totalPlacements).toBe(1);

            // Now the spot is taken (by a tree): no placement, and the cap isn't used up.
            game!.addObjects([{ sid: 901, x: 1000 - 84, y: 1000, scale: 80, type: 0 }]);
            game!.update();
            PlacementSystem.totalPlacements = 0;
            macro();
            expect(PlacementSystem.totalPlacements).toBe(0);
        } finally {
            Input.keys["KeyV"] = false;
        }
    });

    it("F doesn't count toward the cap when the trap limit is full (B4)", async () => {
        const PlacementSystem = await setUp();
        const { default: items } = await import("@constants/items");
        const { Input } = await import("@ui/Hook");
        vi.spyOn(Input, "getAttackDir").mockReturnValue(Math.PI);
        const macro = (PlacementSystem as unknown as { macro(): void }).macro.bind(PlacementSystem);
        game!.Client.player.itemCounts[items.list[15].group.id] = 99;

        Input.keys["KeyF"] = true;
        try {
            PlacementSystem.totalPlacements = 0;
            macro();
            expect(PlacementSystem.totalPlacements).toBe(0);
            expect(placedNow()).toEqual([]);
        } finally {
            Input.keys["KeyF"] = false;
        }
    });
});

describe("Placement System: Auto Place", () => {
    it("runs Auto Place for an enemy within Range, with a pit trap in the trap slot", async () => {
        const PlacementSystem = await setUp(["autoPlacing"]);
        const execute = vi.spyOn(PlacementSystem.AutoPlacer, "execute").mockImplementation(() => { });
        PlacementSystem.main();
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("not for an enemy beyond Range, or with Auto Place off", async () => {
        let PlacementSystem = await setUp(["autoPlacing"]);
        game!.Menu.itemMap.autoPlaceRange.status = 200;
        let execute = vi.spyOn(PlacementSystem.AutoPlacer, "execute").mockImplementation(() => { });
        PlacementSystem.main();
        expect(execute).not.toHaveBeenCalled();
        game!.done();

        PlacementSystem = await setUp([]);
        execute = vi.spyOn(PlacementSystem.AutoPlacer, "execute").mockImplementation(() => { });
        PlacementSystem.main();
        expect(execute).not.toHaveBeenCalled();
    });
});
