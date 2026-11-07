// B3: the Defense System's late-hit check (pattern recognition while we're trapped next to an enemy spike). When an
// enemy we expected to pre-hit doesn't swing, it processes that enemy again so its damage is counted after all. It did
// this also for enemies whose damage the first pass had already counted, which added their damage (and knockback) twice.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

/** Trapped in an enemy pit trap, touching an enemy spike, a polearm enemy next to us who never swings. */
async function trappedTicks(ticks: number, beforeTick?: (tick: number) => Promise<void>) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: ["usePatternRec"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1100, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.addObjects([
        { sid: 700, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: 2 },
        { sid: 701, x: 1000, y: 1080, itemId: LIST_ID_MAP.SPIKES, owner: 2 }
    ]);
    const { default: ModManager } = await import("@core/ModManager");
    const perTick: string[][] = [];
    for (let i = 0; i < ticks; i++) {
        await beforeTick?.(i);
        game.update();
        perTick.push([...ModManager.brainState.sources]);
    }
    return perTick;
}

describe("late-hit check", () => {
    it("runs while we're trapped next to an enemy spike (so the test below means something)", async () => {
        const ticks = await trappedTicks(6);
        expect(ticks.some(sources => sources.includes("checkLateHit:2"))).toBe(true);
    });

    it("never counts the same enemy's weapon damage twice in one tick", async () => {
        const ticks = await trappedTicks(6);
        for (const sources of ticks) {
            const counted = sources.filter(s => /^(primary|secondary|reducedPrimary|reducedSecondary|superReducedPrimary|superReducedSecondary)Damage$/.test(s));
            expect(counted.length).toBeLessThanOrEqual(1);
        }
    });

    it("still counts an enemy the first pass left out, once", async () => {
        type Processor = { processEnemy: (...args: unknown[]) => { primaryDamage: number; ignored?: boolean } };
        let calls = 0;
        const ticks = await trappedTicks(2, async (tick) => {
            if (tick !== 1) return;
            const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
            const ds = DefenseSystem as unknown as Processor;
            const original = ds.processEnemy.bind(DefenseSystem);
            // The first pass leaves the enemy out (as pattern recognition does for a pre-hitter); later calls run normally.
            vi.spyOn(ds, "processEnemy").mockImplementation((...args) => {
                calls++;
                return calls === 1 ? { primaryDamage: 0, hasRuby: false, hasSecondaryHitRecently: false, ignored: true } as never : original(...args);
            });
        });

        expect(ticks[1]).toContain("checkLateHit:2");
        expect(calls).toBe(2);
        expect(ticks[1].filter(s => s === "secondaryDamage")).toHaveLength(1);
    });
});
