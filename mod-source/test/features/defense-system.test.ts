// Feature #26, Defense System (DefenseSystem): every tick adds up how much damage we could take before the next one
// (each nearby enemy's ready weapons in range, with bull helmet; turrets; spikes we touch or could be knocked into;
// arrows and bullets on the way; reflection from hitting a Spike Gear / Corrupt X Wings enemy) and decides whether
// soldier helmet or EMP helmet are worth it. Auto Heal and the Hat System act on that total.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

interface Scenario {
    enemyX?: number;
    enemyTail?: number;
    myTail?: number;
    spikeAt?: { x: number; y: number };
}

/** One tick with an enemy (polearm) to our right; returns the tick's threat total and where it came from. */
async function threat(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5, tailIndex: s.myTail ?? 0 });
    game.spawn({ sid: 2, x: s.enemyX ?? 1100, y: 1000, weaponIndex: 5, tailIndex: s.enemyTail ?? 0 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    if (s.spikeAt) game.addObjects([{ sid: 700, ...s.spikeAt, itemId: LIST_ID_MAP.SPIKES, owner: 2 }]);
    game.update();
    game.update();
    const { default: ModManager } = await import("@core/ModManager");
    return { total: ModManager.brainState.totalDamage, sources: ModManager.brainState.sources };
}

describe("Defense System", () => {
    it("counts a nearby enemy's ready primary, with bull helmet", async () => {
        const { total, sources } = await threat();
        expect(sources).toContain("primaryDamage");
        expect(total).toBeGreaterThan(45);
    });

    it("ignores an enemy out of reach", async () => {
        const { sources } = await threat({ enemyX: 1400 });
        expect(sources).not.toContain("primaryDamage");
    });

    it("counts an enemy spike we're touching", async () => {
        const { sources } = await threat({ enemyX: 2000, spikeAt: { x: 1000, y: 1080 } });
        expect(sources).toContain("spikeDamage");
    });

    it("adds up every arrow and bullet on the way, even after spotting a one-tick threat", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 4000, y: 4000 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
        const { STORE_HAT_MAP } = await import("@constants/store");
        game.Client.player.projDamages.push(25, 35);
        DefenseSystem.state.totalDamage = 0;
        (DefenseSystem as unknown as { considerProjectiles(primary: number): void }).considerProjectiles(80);
        // 25 + 80 can kill, so soldier helmet; the loop used to stop there and leave the 35 out (total 25).
        expect(DefenseSystem.state.totalDamage).toBe(60);
        expect(DefenseSystem.skinIndex).toBe(STORE_HAT_MAP.SOLDIER_HELMET);
    });

    it("today lets OUR Monkey Tail change how hard a Monkey Tail enemy can hit (possible issue P17)", async () => {
        const { STORE_ACCESSORY_MAP } = await import("@constants/store");
        const monkey = STORE_ACCESSORY_MAP.MONKEY_TAIL;
        const without = await threat({ enemyTail: monkey });
        const withOurs = await threat({ enemyTail: monkey, myTail: monkey });
        // The enemy's possible damage should not depend on what we wear; here it drops when we put Monkey Tail on.
        expect(withOurs.total).toBeLessThan(without.total);
    });
});
