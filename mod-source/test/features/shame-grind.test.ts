// B2, Shame Grind (ShameGrinder): while the enemy is trapped, fakes Apple Insta with a bull hit (no trap break) so an
// enemy who eats right after being hit gains shame. Apple Insta waits until the enemy is shamed (8 shame: 30 s without
// healing), or a fake landed and their shame didn't rise (they stopped eating right after hits), or 12 fakes.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;
const SHAME_HAT = 45;
const ALL = ["shameGrind", "appleInsta", "autoPlacing", "preplacer"];

/** The Apple Insta setup: enemy in our pit trap 90 away, diamond polearm + great hammer. */
async function setUp(enable = ALL, weapons = [5, 10]) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: weapons[0] });
    game.spawn({ sid: ENEMY, x: 1090, y: 1000 });
    game.setLoadout(weapons, [0, 3, 6, 15]);
    game.addObjects([{ sid: 600, x: 1090, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME }]);
    game.update([{ sid: ME, weaponIndex: weapons[1], weaponVariant: 2 }]);
    game.update([{ sid: ME, weaponIndex: weapons[0], weaponVariant: 2 }]);

    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: ModManager } = await import("@core/ModManager");
    const grinder = AttackManager.shameGrinder;
    // The setup ticks above already faked once; start each test from a clean count.
    grinder.reset();
    AttackManager.stopAttackAction();
    let health = 100;

    /** One server tick; returns the attack we started on it (its reason), if any. */
    const tick = (changes: Parameters<Game["update"]>[0] = []) => {
        game!.update(changes);
        return AttackManager.currentAttackAction?.reason;
    };
    /** Our fake hit lands; with `heals`, the enemy eats in the same tick (+1 shame in 1.8.2). */
    const respond = (heals: boolean) => {
        health -= 30;
        game!.setHealth(ENEMY, health);
        if (heals) {
            health = 100;
            game!.setHealth(ENEMY, health);
        }
    };
    return { grinder, tick, respond, ModManager, enemy: () => ModManager.enemyData.nearest! };
}

describe("Shame Grind", () => {
    it("fakes Apple Insta with a bull hit while the enemy is trapped, and Apple Insta waits", async () => {
        const g = await setUp();
        expect(g.tick()).toBe("shameGrind");
        expect(g.grinder.holdsAppleInsta()).toBe(true);
        expect(g.grinder.fakes).toBe(1);
    });

    it("keeps faking while the enemy eats right after each hit", async () => {
        const g = await setUp();
        for (let i = 0; i < 4; i++) {
            g.tick();
            g.respond(true);
            g.tick();
            g.tick();
        }
        expect(g.enemy().shameCount).toBeGreaterThanOrEqual(3);
        expect(g.grinder.fakes).toBeGreaterThanOrEqual(3);
        expect(g.grinder.finished).toBe(false);
        expect(g.grinder.holdsAppleInsta()).toBe(true);
    });

    it("lets Apple Insta go once the enemy is shamed and can't heal", async () => {
        const g = await setUp();
        g.tick();
        g.tick([{ sid: ENEMY, skinIndex: SHAME_HAT }]);
        expect(g.enemy().clowned).toBe(true);
        expect(g.grinder.finished).toBe(true);
        expect(g.grinder.holdsAppleInsta()).toBe(false);
    });

    it("lets Apple Insta go when a fake landed and the enemy didn't eat right away", async () => {
        const g = await setUp();
        g.tick();
        g.respond(false);
        g.tick();
        g.tick();
        expect(g.grinder.finished).toBe(true);
        expect(g.grinder.holdsAppleInsta()).toBe(false);
    });

    it("doesn't decide from a fake that didn't land", async () => {
        const g = await setUp();
        g.tick();
        g.tick();
        g.tick();
        expect(g.grinder.finished).toBe(false);
        expect(g.grinder.fakes).toBe(2);
    });

    it("gives up after 12 fakes so the kill isn't stalled for good", async () => {
        const g = await setUp();
        for (let i = 0; i < 60 && !g.grinder.finished; i++) {
            if (g.tick() === "shameGrind") g.respond(true);
            // Keep the enemy's shame from reaching 8 (Shame hat), so only the fake count can end it.
            if (g.enemy().shameCount >= 6) g.enemy().shameCount = 0;
        }
        expect(g.grinder.fakes).toBe(12);
        expect(g.grinder.finished).toBe(true);
    });

    it("starts over for another enemy or after the enemy leaves the trap", async () => {
        const g = await setUp();
        g.tick();
        g.respond(false);
        g.tick();
        g.tick();
        expect(g.grinder.finished).toBe(true);

        g.tick([{ sid: ENEMY, x: 1400 }]);
        g.tick([{ sid: ENEMY, x: 1090 }]);
        expect(g.grinder.finished).toBe(false);
        expect(g.grinder.holdsAppleInsta()).toBe(true);
    });

    it("does nothing without Apple Insta, Preplacements or Auto Place, or when off", async () => {
        for (const missing of ALL) {
            const g = await setUp(ALL.filter(id => id !== missing));
            expect(g.tick()).not.toBe("shameGrind");
            expect(g.grinder.holdsAppleInsta()).toBe(false);
            game!.done();
        }
    });

    it("needs the great hammer that the real Apple Insta finishes with", async () => {
        const g = await setUp(ALL, [5, 15]);
        expect(g.tick()).not.toBe("shameGrind");
    });

    it("forgets everything when we respawn", async () => {
        const g = await setUp();
        g.tick();
        g.grinder.reset();
        expect(g.grinder.fakes).toBe(0);
        expect(g.grinder.finished).toBe(false);
    });

    it("Apple Insta itself stands down while grinding, and is free again once finished", async () => {
        const g = await setUp();
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const apple = AttackManager.appleInstakiller as unknown as { canExecute(): boolean };
        g.tick();
        AttackManager.stopAttackAction();
        expect(apple.canExecute()).toBe(false);

        g.grinder.finished = true;
        expect(apple.canExecute()).toBe(true);
    });
});
