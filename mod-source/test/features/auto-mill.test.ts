// Feature #21, Auto Mill (AutoMiller): toggled with Z. Every time we've moved 99 units, places 3 windmills behind us
// (straight back and about 69° to each side), until we own 299 windmills (the sandbox limit); then it turns itself off.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const WINDMILL = 10;

interface Scenario {
    on?: boolean;
    moveDir?: number | null;
    millCount?: number;
    /** How far we move before the tick that is checked. */
    moved?: number;
    /** Placements already made this tick (hotkeys) before Auto Mill runs. */
    alreadyPlaced?: number;
}

/** Returns the angles windmills were placed at during the checked tick, and whether Auto Mill is still on. */
async function play(s: Scenario = {}) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    game.setLoadout([5], [0, 3, 6, WINDMILL, 15]);
    const { default: AutoMiller } = await import("@placing/modules/AutoMiller");
    game.update();

    const player = game.Client.player;
    player.itemCounts[3] = s.millCount ?? 0;
    AutoMiller.data.status = s.on !== false;
    game.Client.lastMoveDir = s.moveDir === undefined ? 0 : s.moveDir;

    // The placement count is reset at the end of each tick, so read it right after Auto Mill has run.
    const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
    const main = AutoMiller.main.bind(AutoMiller);
    let counted = -1;
    vi.spyOn(AutoMiller, "main").mockImplementation(() => {
        PlacementSystem.totalPlacements += s.alreadyPlaced ?? 0;
        main();
        counted = PlacementSystem.totalPlacements;
    });

    const before = game.sent.length;
    game.update([{ sid: ME, x: 1000 + (s.moved ?? 120), y: 1000 }]);
    const sent = game.sent.slice(before);
    const angles: number[] = [];
    for (let i = 0; i < sent.length; i++) {
        const p = sent[i];
        if (p.type === "z" && p.args[0] === WINDMILL && p.args[1] === false) angles.push(sent[i + 1].args[1] as number);
    }
    return { angles, stillOn: AutoMiller.data.status, counted };
}

describe("Auto Mill", () => {
    it("places 3 windmills behind us once we've moved 99 units", async () => {
        const { angles } = await play({ moveDir: 0 });
        expect(angles.length).toBe(3);
        // Moving right (0), so behind is PI, and the side ones about 1.2 either way.
        expect(angles[0]).toBeCloseTo(Math.PI);
        expect(angles[1]).toBeCloseTo(Math.PI - 1.20427718);
        expect(angles[2]).toBeCloseTo(Math.PI + 1.20427718);
    });

    it("waits until we've moved far enough", async () => {
        expect((await play({ moved: 50 })).angles).toEqual([]);
    });

    it("does nothing when off or when we aren't moving", async () => {
        expect((await play({ on: false })).angles).toEqual([]);
        expect((await play({ moveDir: null })).angles).toEqual([]);
    });

    it("turns itself off at 299 windmills", async () => {
        const { angles, stillOn } = await play({ millCount: 299 });
        expect(angles).toEqual([]);
        expect(stillOn).toBe(false);
    });

    it("counts its windmills toward the 4-per-tick cap (P12)", async () => {
        // They used to go out on top of it: the count stayed 0.
        const { angles, counted } = await play();
        expect(angles.length).toBe(3);
        expect(counted).toBe(3);
    });

    it("places only what's left of the cap", async () => {
        const { angles, counted } = await play({ alreadyPlaced: 2 });
        expect(angles.length).toBe(2);
        expect(angles[0]).toBeCloseTo(Math.PI);
        expect(counted).toBe(4);
        expect((await play({ alreadyPlaced: 4 })).angles).toEqual([]);
    });

    it("stops at the limit part-way through a batch", async () => {
        expect((await play({ millCount: 297 })).angles.length).toBe(2);
    });
});
