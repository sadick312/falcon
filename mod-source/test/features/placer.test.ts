// Feature #24, Placer helpers (Placer, PlacerUtils): from the graded spots, picks up to 4 (minus what was already
// placed this tick), best grade first (traps first on a tie), without two that overlap. If that gives fewer than 4, a
// second pass adds overlapping ones as backups (at least 0.3 rad apart, never overlapping an important one), in case
// the server refuses the first. Spots overlapping a recent replacement or a pending preplacement are skipped.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

interface Spot {
    angle: number;
    grade: number;
    trap?: boolean;
}

/** Runs Placer.process on hand-made spots around us; `blocked` puts a fresh replacement on that angle. */
async function choose(spots: Spot[], blocked?: number) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();

    const { default: Angle } = await import("@placing/Angle");
    const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
    const { default: ModManager } = await import("@core/ModManager");
    const { LIST_ID_MAP, default: items } = await import("@constants/items");

    const buffer = spots.map(s => {
        const id = s.trap ? LIST_ID_MAP.PIT_TRAP : LIST_ID_MAP.SPIKES;
        const scale = items.list[id].scale;
        const angle = new Angle(1000 + Math.cos(s.angle) * (35 + scale), 1000 + Math.sin(s.angle) * (35 + scale), scale, s.angle, id);
        angle.grade = s.grade;
        return angle;
    });

    if (blocked !== undefined) {
        const replacement = PlacementSystem.AutoReplacer.replacements[0];
        const scale = items.list[LIST_ID_MAP.SPIKES].scale;
        replacement.x = 1000 + Math.cos(blocked) * (35 + scale);
        replacement.y = 1000 + Math.sin(blocked) * (35 + scale);
        replacement.scale = scale;
        replacement.tick = ModManager.tick;
    }

    const placer = PlacementSystem.AutoPlacer as unknown as {
        process(buffer: unknown[], count: number, total: number, options: object, dontPlace?: boolean): { angle: number }[];
    };
    return placer.process(buffer, buffer.length, 4, {}, true).map(a => a.angle);
}

describe("Placer", () => {
    it("picks the best spots first, never two that overlap", async () => {
        // 0 and 0.2 overlap; 0 and 0.6 overlap too, but are 0.3+ apart, so 0.6 is only a backup.
        const chosen = await choose([{ angle: 0.2, grade: 1 }, { angle: 0, grade: 5 }, { angle: Math.PI, grade: 3 }]);
        expect(chosen).toEqual([0, Math.PI]);
    });

    it("prefers a trap when grades are equal", async () => {
        const chosen = await choose([{ angle: 0, grade: 2 }, { angle: Math.PI, grade: 2, trap: true }]);
        expect(chosen[0]).toBe(Math.PI);
    });

    it("adds overlapping backups when it has fewer than 4", async () => {
        const chosen = await choose([{ angle: 0, grade: 5 }, { angle: 0.4, grade: 4 }]);
        expect(chosen).toEqual([0, 0.4]);
    });

    it("skips a spot overlapping a recent replacement", async () => {
        const chosen = await choose([{ angle: 0, grade: 5 }, { angle: Math.PI, grade: 4 }], Math.PI);
        expect(chosen).toEqual([0]);
    });

    it("today skips the backups when the lowest-graded spot happens to be skipped (possible issue P16)", async () => {
        // Same as the backup case plus a low-graded spot that a replacement blocks: the second pass only starts from
        // the last candidate, and that one is skipped with `continue`, so 0.4 is never added.
        const chosen = await choose([{ angle: 0, grade: 5 }, { angle: 0.4, grade: 4 }, { angle: Math.PI, grade: 1 }], Math.PI);
        expect(chosen).toEqual([0]);
    });
});
