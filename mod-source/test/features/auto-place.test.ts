// Feature #18, Auto Place / Preplacements (AutoPlacer): each tick the Angle Finder picks up to 4 spots around a nearby
// enemy, and Auto Place places them (preplacements, for buildings about to break, a moment later so they land on the
// next server tick). "Two Tick Placements" only places on even ticks. Hotkey placements share the 4-per-tick cap.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const SPIKES = 6;
const PIT_TRAP = 15;

/** Enemy 150 units away in the open; we have spikes and pit traps. Returns "tick:item" for each placement. */
async function play(enable: string[], ticks = 4, during?: () => Promise<void>) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1150, y: 1000 });
    game.setLoadout([5], [0, 3, SPIKES, 10, PIT_TRAP]);
    // The packet budget is only switched on by a live connection; replay mode leaves it off.
    (await import("@core/utils/PacketTracker")).default.init();
    await during?.();
    for (let i = 0; i < ticks; i++) game.update();
    return game.sent.filter(p => p.type === "z" && p.args[1] === false).map(p => `${p.tick}:${p.args[0]}`);
}

describe("Auto Place", () => {
    it("places up to 4 pit traps around the enemy each tick", async () => {
        const placed = await play(["autoPlacing"], 2);
        expect(placed).toEqual(["1:15", "1:15", "1:15", "1:15", "2:15", "2:15", "2:15", "2:15"]);
    });

    it("with Two Tick Placements, only places on even ticks", async () => {
        const ticks = new Set((await play(["autoPlacing", "twoTickPlacements"], 4)).map(p => p.split(":")[0]));
        expect([...ticks]).toEqual(["2", "4"]);
    });

    it("does nothing when Auto Place is off", async () => {
        expect(await play([], 2)).toEqual([]);
    });

    it("keeps to the 4-per-tick cap when a hotkey places in the same tick (P10)", async () => {
        const placed = await play(["autoPlacing"], 1, async () => {
            const { Input } = await import("@ui/Hook");
            Input.keys["KeyV"] = true; // spike hotkey, released after the tick below
        });
        const { Input } = await import("@ui/Hook");
        Input.keys["KeyV"] = false;
        // Auto Place picked its 4 spots before the hotkey placed; it used to place all of them (1 spike + 4 traps).
        expect(placed.filter(p => p === `1:${SPIKES}`).length).toBe(1);
        expect(placed.length).toBe(4);
    });
});

describe("Auto Place: preplacements", () => {
    type PlacerInternals = {
        cachedBestAngles: { redefine(x: number, y: number, scale: number, angle: number, id: number, pre?: boolean, predict?: boolean): void }[];
        cachedBestAnglesCount: number;
        execute(player: unknown): void;
    };

    /**
     * One preplacement (a pit trap 84 to our right, for a building about to break) handed straight to Auto Place's
     * execute(). `sinceUpdate` is how long ago the last server update arrived.
     */
    async function preplace(opts: { sinceUpdate: number; predict?: boolean; enable?: string[] }) {
        game = await startGame({ enable: opts.enable ?? ["autoPlacing", "preplacer"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1300, y: 1000 });
        game.setLoadout([5], [0, 3, SPIKES, 10, PIT_TRAP]);
        (await import("@core/utils/PacketTracker")).default.init();
        game.update();

        const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
        const { default: PlayerUpdateEvent } = await import("@core/socket/events/core/PlayerUpdateEvent");
        const placer = PlacementSystem.AutoPlacer as unknown as PlacerInternals;
        placer.cachedBestAngles[0].redefine(1084, 1000, 50, 0, PIT_TRAP, true, opts.predict);
        placer.cachedBestAnglesCount = 1;
        PlayerUpdateEvent.lastReceive = performance.now() - opts.sinceUpdate;
        game.Client.markers.length = 0;

        const before = game.sent.length;
        placer.execute(game.Client.player);
        const placed = () => game!.sent.slice(before).filter(p => p.type === "z" && p.args[1] === false).map(p => p.args[0]);
        return { placed, PlacementSystem };
    }

    it("places at once when the next server tick is already due", async () => {
        const { placed } = await preplace({ sinceUpdate: 500 });
        expect(placed()).toEqual([PIT_TRAP]);
    });

    it("otherwise waits, so it lands on the next server tick", async () => {
        const { placed } = await preplace({ sinceUpdate: 0 });
        expect(placed()).toEqual([]);
        vi.advanceTimersByTime(120);
        expect(placed()).toEqual([PIT_TRAP]);
    });

    it("drops a waiting trap if Apple Insta blocked that spot in the meantime", async () => {
        const { placed, PlacementSystem } = await preplace({ sinceUpdate: 0 });
        PlacementSystem.blockTrapPlacement({ x: 1084, y: 1000, scale: 50 } as never, 2);
        vi.advanceTimersByTime(120);
        expect(placed()).toEqual([]);
    });

    it("waits the same way with \"No Rounding\" on (no half-millisecond padding)", async () => {
        const { placed } = await preplace({ sinceUpdate: 0, enable: ["autoPlacing", "preplacer", "prenorounding"] });
        vi.advanceTimersByTime(120);
        expect(placed()).toEqual([PIT_TRAP]);
    });

    it("marks a predicted placement as predictive", async () => {
        await preplace({ sinceUpdate: 500, predict: true });
        const { PlacementTypes } = await import("@placing/utils/Placer");
        expect(game!.Client.markers.map(m => m.type)).toContain(PlacementTypes.PREDICTIVE);
    });

    it("still sends preplacements on odd ticks with Two Tick Placements", async () => {
        const { placed } = await preplace({ sinceUpdate: 500, enable: ["autoPlacing", "preplacer", "twoTickPlacements"] });
        // The game is on tick 1 here (odd), when normal placements wait.
        expect(placed()).toEqual([PIT_TRAP]);
    });
});
