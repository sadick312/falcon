// Feature #22, Angle Finder (AngleFinder, Angle, AngleGrader): works out which directions around a player are free
// for a spike or a trap (each nearby building and the river block an arc), spreads "Angle Finder Level"'s budget of
// sample angles over the free arcs, and has the graders score each one.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const MAP_CENTER = 7200;
const RIVER_HALF_WIDTH = 362; // 1.8.2: riverWidth 724

interface Building {
    angle: number;
    distance: number;
}

/** Returns the free spots the finder offers around us (no grading), and the buildings it had to avoid. */
async function find(buildings: Building[] = [], y = 3000) {
    const { LIST_ID_MAP, default: items } = await import("@constants/items");
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    const objects = buildings.map((b, i) => ({
        sid: 900 + i,
        x: 1000 + Math.cos(b.angle) * b.distance,
        y: y + Math.sin(b.angle) * b.distance,
        itemId: LIST_ID_MAP.SPIKES,
        owner: 2
    }));
    game.addObjects(objects);
    game.update();
    game.update();

    const { default: AngleFinder } = await import("@placing/AngleFinder");
    const count = AngleFinder.compute(game.Client.player, { grade: false });
    const spots = AngleFinder.angleBuffer.slice(0, count);
    const buildingScale = items.list[LIST_ID_MAP.SPIKES].scale;
    const overlapping = spots.filter(s => objects.some(o => Math.hypot(s.x - o.x, s.y - o.y) < s.scale + buildingScale - 0.1));
    return { spots, overlapping };
}

describe("Angle Finder", () => {
    it("offers spikes and traps all around us in the open", async () => {
        const { spots } = await find();
        expect(spots.some(s => s.isTrap)).toBe(true);
        expect(spots.some(s => s.isSpike)).toBe(true);
        // Spread over the whole circle: some in every quarter.
        for (let q = 0; q < 4; q++) {
            expect(spots.some(s => s.angle >= q * Math.PI / 2 && s.angle < (q + 1) * Math.PI / 2)).toBe(true);
        }
    });

    it("never offers a spot that overlaps a building", async () => {
        const { spots, overlapping } = await find([{ angle: 0, distance: 150 }, { angle: 2, distance: 140 }]);
        expect(spots.length).toBeGreaterThan(0);
        expect(overlapping).toEqual([]);
        // The building straddling angle 0 blocks both sides of it.
        expect(spots.some(s => Math.cos(s.angle) > 0.99)).toBe(false);
    });

    it("still avoids every building in a crowded base", async () => {
        // 40 buildings all around us: the old buffer filled up after about 30 arcs, ignored the rest, and offered
        // spots on top of them.
        const crowded = Array.from({ length: 40 }, (_, i) => ({ angle: i * 2 * Math.PI / 40, distance: i % 2 ? 170 : 150 }));
        const { overlapping } = await find(crowded);
        expect(overlapping).toEqual([]);
    });

    it("today refuses spots just outside the river that the game allows (possible issue P13)", async () => {
        // We stand 100 north of the river band. A spot straight down (angle PI/2) lands about 15 short of the band,
        // which 1.8.2's checkItemLocation allows, but Falcon models the river as a circle 362 + the building's size.
        const { spots } = await find([], MAP_CENTER - RIVER_HALF_WIDTH - 100);
        const down = spots.filter(s => Math.sin(s.angle) > 0.99);
        expect(down.length).toBe(0);
        // Straight up is fine.
        expect(spots.some(s => Math.sin(s.angle) < -0.99)).toBe(true);
    });
});
