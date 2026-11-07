// Feature #26, Defense System (DefenseSystem): every tick adds up how much damage we could take before the next one
// (each nearby enemy's ready weapons in range, with bull helmet; turrets; spikes we touch or could be knocked into;
// arrows and bullets on the way; reflection from hitting a Spike Gear / Corrupt X Wings enemy) and decides whether
// soldier helmet or EMP helmet are worth it. Auto Heal and the Hat System act on that total.
import { afterEach, describe, expect, it, vi } from "vitest";
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

    it("counts a Monkey Tail enemy's weapon + turret at full damage, whatever we wear (P17)", async () => {
        const { STORE_ACCESSORY_MAP } = await import("@constants/store");
        const monkey = STORE_ACCESSORY_MAP.MONKEY_TAIL;
        const without = await threat({ enemyTail: monkey });
        const withOurs = await threat({ enemyTail: monkey, myTail: monkey });
        // It used to read our tail: the estimate dropped when we put Monkey Tail on.
        expect(withOurs.total).toBe(without.total);
        // The enemy can take the tail off and hit with weapon + turret (25).
        const { default: items } = await import("@constants/items");
        expect(without.total).toBeGreaterThanOrEqual(items.weapons[5].dmg + 25);
    });
});

describe("Defense System: no random decisions (B1)", () => {
    type Internals = {
        spikeTickPatternRec: { amount: number; currentMax: number; resolveOccurances: number; hasOccuredBefore: boolean };
        processSpikeTickPotential(reset?: boolean): boolean;
        handleSpikePlacement(hammer: boolean, primary: number, spike: number, onMe: boolean): void;
        previousOnMeState: boolean;
        state: { sources: string[]; totalDamage: number };
    };

    async function setUp() {
        game = await startGame({ enable: ["usePatternRec"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 4000, y: 4000 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
        const { default: ModManager } = await import("@core/ModManager");
        return { ds: DefenseSystem as unknown as Internals, ModManager };
    }

    it("Pattern Recognition leaves out 1 spike-tick threat on even ticks and 2 on odd ones", async () => {
        const { ds, ModManager } = await setUp();
        // The coin flip this replaced would say 2 here on every tick.
        vi.spyOn(Math, "random").mockReturnValue(0.99);

        for (const [tick, expected] of [[10, 1], [11, 2]]) {
            const data = ds.spikeTickPatternRec;
            data.currentMax = 3;
            data.amount = 2;
            data.hasOccuredBefore = true;
            data.resolveOccurances = 0;
            ModManager.tick = tick;
            ds.processSpikeTickPotential();
            expect(data.resolveOccurances).toBe(expected);
        }
    });

    it("counts a spike that can be placed on us while our shame is 0-2, not from 3", async () => {
        const { ds } = await setUp();
        // The coin flip this replaced would have left shame 2 out here.
        vi.spyOn(Math, "random").mockReturnValue(0);
        const player = game!.Client.player;
        player.wasTrapped = false;

        const counted = (shame: number) => {
            player.shameCount = shame;
            ds.previousOnMeState = true; // not "just" able to place on us
            ds.state.sources.length = 0;
            ds.handleSpikePlacement(false, 30, 20, true);
            return ds.state.sources.includes("onMeSpike");
        };

        expect([counted(0), counted(2), counted(3), counted(5)]).toEqual([true, true, false, false]);
    });
});
