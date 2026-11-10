// Shame and Anti Bull fixes (user request, 10 Nov 2026): Anti Bull keeps working at 4+ shame ("Keep On at High
// Shame", on by default) and, when it does stand down, drops its old Spike Gear decision; "Accurate Enemy Shame"
// starts on in a new config.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

/**
 * The anti-bull scene from anti-bull.test.ts (the enemy swings before tick 2; its polearm finishes reloading on
 * tick 9) with our shame at `shame`. `staleConsider` starts Anti Bull with a decision left over from before.
 * Returns the ticks `consider` was up.
 */
async function considerTicks(enable: string[], shame: number, staleConsider = false) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1100, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 15]);
    game.update();
    game.handlers.K(2, true, 5);
    game.Client.player.shameCount = shame;

    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    if (staleConsider) AttackManager.antiBuller.consider = true;
    const ticks: number[] = [];
    for (let i = 0; i < 10; i++) {
        game.Client.player.shameCount = shame;
        game.update();
        if (AttackManager.antiBuller.consider) ticks.push(game.tick);
    }
    return ticks;
}

function findSetting(node: unknown, id: string): { status?: unknown } | undefined {
    if (Array.isArray(node)) return node.map(n => findSetting(n, id)).find(Boolean);
    if (node && typeof node === "object") {
        if ((node as { id?: string }).id === id) return node as { status?: unknown };
        return Object.values(node).map(n => findSetting(n, id)).find(Boolean);
    }
    return undefined;
}

describe("Anti Bull at high shame", () => {
    it("with 'Keep On at High Shame', still asks for Spike Gear at 5 shame", async () => {
        expect(await considerTicks(["antiBull", "antiBullHighShame"], 5)).toEqual([9]);
    });

    it("below 4 shame, works the same with or without it", async () => {
        expect(await considerTicks(["antiBull"], 3)).toEqual([9]);
        game?.done();
        expect(await considerTicks(["antiBull", "antiBullHighShame"], 3)).toEqual([9]);
    });

    it("without it, stands down at 5 shame and drops a decision left from before", async () => {
        expect(await considerTicks(["antiBull"], 5, true)).toEqual([]);
    });
});

describe("new defaults", () => {
    it("start with Keep On at High Shame and Accurate Enemy Shame on, Shame-Safe Healing still off", async () => {
        vi.resetModules();
        const { combatSettings } = await import("@core/menu/content/combat");
        const { defenseSettings } = await import("@core/menu/content/defense");
        expect(findSetting(combatSettings, "antiBullHighShame")?.status).toBe(true);
        expect(findSetting(combatSettings, "accurateEnemyShame")?.status).toBe(true);
        // Left off on purpose: in the replays our tracked shame runs high, and then it skips eats a fight needs.
        expect(findSetting(defenseSettings, "shameSafeHealing")?.status).toBe(false);
        // Anti Bull itself still starts off.
        expect(findSetting(combatSettings, "antiBull")?.status).toBe(false);
    });
});
