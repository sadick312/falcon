// 1C: reload timing. The server decides when a weapon may swing again; Falcon must act on exactly that tick.
//
// The server's rule (1.8.2, bundle.js `player.update`): a swing sets `reloads[w] = weapon.speed × hat.atkSpd`. On each
// later tick, if the reload is still above 0 it goes down by that tick's time (1000 / 9 ms); a swing only happens on a
// tick that *starts* at or below 0, and leftover time isn't carried over. So after a swing on tick s0, the next one
// can come on tick s0 + ceil(S / tick) + 1. Our hit packet has to be sent while handling the tick before that one,
// so Falcon must see the weapon as ready on tick s0 + ceil(S / tick): not earlier (the hit would be wasted) and not
// later (a wasted tick).
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;
const SAMURAI_ARMOR = 20;
const BULL_HELMET = 7;
const SERVER_TICK_MS = 1000 / 9;

/** Ticks after a swing on which Falcon has to decide the next hit (the server allows it one tick later). */
const decideAfter = (reloadMs: number) => Math.ceil(reloadMs / SERVER_TICK_MS);

async function enemyWith(weaponIndex: number, skinIndex = 0, enable: string[] = []) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.spawn({ sid: ENEMY, x: 1300, y: 1000, weaponIndex, skinIndex });
    game.update();
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    return PlayerManager.get(ENEMY)!;
}

/** The enemy swings (GATHER_ANIMATION, then the tick's UPDATE_PLAYERS); returns the first tick after it on which Falcon sees the weapon ready. */
function ticksUntilReady(enemy: { reloads: Record<number, number> }, weaponIndex: number) {
    game!.handlers.K(ENEMY, false, weaponIndex);
    game!.update();
    expect(enemy.reloads[weaponIndex]).toBeLessThan(1);
    for (let k = 1; k <= 20; k++) {
        game!.update();
        if (enemy.reloads[weaponIndex] === 1) return k;
    }
    return -1;
}

describe("reload per weapon", () => {
    // [weapon id, name, reload in ms]
    const WEAPONS: [number, string, number][] = [
        [0, "tool hammer", 300], [1, "hand axe", 400], [2, "great axe", 400], [3, "short sword", 300],
        [4, "katana", 300], [5, "polearm", 700], [6, "bat", 300], [7, "daggers", 100], [8, "stick", 400],
        [9, "hunting bow", 600], [10, "great hammer", 400], [12, "crossbow", 700], [13, "repeater crossbow", 230],
        [14, "mc grabby", 700], [15, "musket", 1500]
    ];

    for (const [id, name, reload] of WEAPONS) {
        it(`${name}: ready on the last tick before the server allows the next swing`, async () => {
            const enemy = await enemyWith(id);
            expect(ticksUntilReady(enemy, id)).toBe(decideAfter(reload));
        });

        it(`${name} with Samurai Armor (×0.78): ready on that tick too`, async () => {
            const enemy = await enemyWith(id, SAMURAI_ARMOR);
            expect(ticksUntilReady(enemy, id)).toBe(decideAfter(reload * 0.78));
        });
    }

    it("Samurai Armor really is faster where the tick count changes (polearm 7 → 5 ticks, musket 14 → 11)", () => {
        expect([decideAfter(700), decideAfter(700 * 0.78)]).toEqual([7, 5]);
        expect([decideAfter(1500), decideAfter(1500 * 0.78)]).toEqual([14, 11]);
    });

    // 1.8.2's weapon variants (gold, diamond, ruby) only have a damage multiplier (`val`), no speed: the reload stays.
    for (const [variant, name] of [[1, "gold"], [2, "diamond"], [3, "ruby"]] as const) {
        it(`a ${name} polearm and musket reload exactly like plain ones`, async () => {
            for (const [id, reload] of [[5, 700], [15, 1500]] as const) {
                game?.done();
                game = await startGame();
                game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
                game.setLoadout([5], [0, 3, 6, 10, 15]);
                game.spawn({ sid: ENEMY, x: 1300, y: 1000, weaponIndex: id, weaponVariant: variant });
                game.update();
                const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
                expect(ticksUntilReady(PlayerManager.get(ENEMY)!, id)).toBe(decideAfter(reload));
            }
        });
    }

    it("uses the hat worn at the swing: Samurai taken off right after still gives the Samurai reload", async () => {
        const enemy = await enemyWith(5, SAMURAI_ARMOR);
        game!.handlers.K(ENEMY, false, 5);
        game!.update(); // the swing's tick: still Samurai
        game!.update([{ sid: ENEMY, skinIndex: BULL_HELMET }]);
        let k = 1;
        while (enemy.reloads[5] !== 1 && k < 20) { game!.update(); k++; }
        expect(k).toBe(decideAfter(700 * 0.78));
    });

    it("doesn't reload a weapon while it isn't held (the server only counts down the held one)", async () => {
        const enemy = await enemyWith(5);
        game!.handlers.K(ENEMY, false, 5);
        game!.update();
        const afterSwing = enemy.reloads[5];
        for (let i = 0; i < 10; i++) game!.update([{ sid: ENEMY, weaponIndex: 10 }]);
        expect(enemy.reloads[5]).toBe(afterSwing);
    });

    it("tracks a crossbow shot (seen as its projectile) the same way", async () => {
        const enemy = await enemyWith(12);
        // The bolt appears 70 px in front of the shooter (enemy at x 1300, firing towards -x).
        game!.handlers.X(1230, 1000, Math.PI, 1200, 2.5, 2, 0, 900);
        game!.update();
        expect(enemy.reloads[12]).toBe(0);
        let k = 0;
        while (enemy.reloads[12] !== 1 && k < 20) { game!.update(); k++; }
        expect(k).toBe(decideAfter(700));
    });
});

describe("our own hit fires on the first tick reload allows", () => {
    it("sends the next Knockback Hit exactly 7 ticks after the server confirmed the polearm swing", async () => {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["attackFactoringKB:hits"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: ENEMY, x: 1100, y: 1000 });
        game.setLoadout([5], [0, 3, 6, 10]);
        game.addObjects([{ sid: 500, x: 1180, y: 1000, itemId: LIST_ID_MAP.GREATER_SPIKES, owner: ME }]);

        const hitTicks = () => game!.sent.filter(p => p.type === "c" && p.args[0] === false && p.args[1] === BULL_HELMET).map(p => p.tick);

        game.update();
        const firstHit = hitTicks()[0]!;
        expect(firstHit).toBe(game.tick);

        // The server swings on the next tick: GATHER_ANIMATION for us, then that tick's update.
        game.handlers.K(ME, true, 5);
        game.update();
        const swing = game.tick;

        for (let i = 0; i < 10; i++) game.update();
        const later = hitTicks().filter(t => t > swing);
        expect(later[0]).toBe(swing + decideAfter(700));
    });
});

describe("guessing an enemy's other weapon", () => {
    async function weaponData(weaponIndex: number) {
        const enemy = await enemyWith(weaponIndex);
        game!.update();
        return enemy;
    }

    it("assumes a ready musket while only a primary has been seen", async () => {
        const enemy = await weaponData(5);
        expect(enemy.weaponData.secondary).toBe(15);
        expect(enemy.weaponData.secondaryConfirmed).toBe(false);
        expect(enemy.getReload(1)).toBe(1);
    });

    it("assumes a gold great hammer for daggers and stick", async () => {
        for (const primary of [7, 8]) {
            const enemy = await weaponData(primary);
            expect(enemy.weaponData.secondary).toBe(10);
            game!.done();
        }
    });

    it("assumes a ready diamond polearm while only a secondary has been seen", async () => {
        const enemy = await weaponData(15);
        expect(enemy.weaponData.primary).toBe(5);
        expect(enemy.weaponData.primaryConfirmed).toBe(false);
        expect(enemy.getReload(0)).toBe(1);
    });

    it("keeps a seen great hammer, shield, musket or repeater after the enemy switches back to the primary", async () => {
        for (const secondary of [10, 11, 13, 15]) {
            const enemy = await enemyWith(secondary);
            game!.update([{ sid: ENEMY, weaponIndex: 5 }]);
            game!.update();
            expect(enemy.weaponData.secondary).toBe(secondary);
            expect(enemy.weaponData.secondaryConfirmed).toBe(true);
            game!.done();
        }
    });

    it("keeps the musket's reload after a shot and a switch to the primary", async () => {
        const enemy = await enemyWith(15);
        game!.handlers.X(1230, 1000, Math.PI, 1400, 3.6, 5, 0, 901);
        game!.update();
        game!.update([{ sid: ENEMY, weaponIndex: 5 }]);
        expect(enemy.getReload(1)).toBe(0);
    });

});

describe("Trust Seen Weapons (default off)", () => {
    const TRUST = ["trustSeenWeapons"];

    /** The enemy fires a crossbow, then holds their polearm for two ticks. */
    async function crossbowThenPolearm(enable: string[]) {
        const enemy = await enemyWith(12, 0, enable);
        game!.handlers.X(1230, 1000, Math.PI, 1200, 2.5, 2, 0, 900);
        game!.update();
        game!.update([{ sid: ENEMY, weaponIndex: 5 }]);
        game!.update();
        return enemy;
    }

    it("on: keeps a seen crossbow and its reload after a shot and a switch to the primary", async () => {
        const enemy = await crossbowThenPolearm(TRUST);
        expect(enemy.weaponData.secondary).toBe(12);
        expect(enemy.weaponData.secondaryConfirmed).toBe(true);
        expect(enemy.getReload(1)).toBe(0);
    });

    it("on: the kept crossbow finishes reloading once held again, on the usual tick", async () => {
        const enemy = await crossbowThenPolearm(TRUST);
        let k = 0;
        while (enemy.getReload(1) !== 1 && k < 20) { game!.update([{ sid: ENEMY, weaponIndex: 12 }]); k++; }
        // The server only counts down the held weapon, and the switch came right after the shot: the full 7 ticks.
        expect(k).toBe(decideAfter(700));
    });

    it("on: keeps a seen hunting bow too", async () => {
        const enemy = await enemyWith(9, 0, TRUST);
        game!.update([{ sid: ENEMY, weaponIndex: 5 }]);
        expect(enemy.weaponData.secondary).toBe(9);
    });

    it("off (default): a seen crossbow becomes a loaded musket when the primary is held, as before", async () => {
        const enemy = await crossbowThenPolearm([]);
        expect(enemy.weaponData.secondary).toBe(15);
        expect(enemy.weaponData.secondaryConfirmed).toBe(false);
        expect(enemy.getReload(1)).toBe(1);
    });

    it("on: guesses a katana, not a polearm, for a seen short sword while a bow is held, and keeps that guess", async () => {
        const enemy = await enemyWith(3, 0, TRUST);
        game!.update();
        game!.update([{ sid: ENEMY, weaponIndex: 9 }]);
        expect(enemy.weaponData.primary).toBe(4);
        expect(enemy.weaponData.primaryConfirmed).toBe(false);
        expect(enemy.getReload(0)).toBe(1);
        game!.update();
        game!.update();
        expect(enemy.weaponData.primary).toBe(4);

        // Back to the short sword: it is the confirmed primary again.
        game!.update([{ sid: ENEMY, weaponIndex: 3 }]);
        expect(enemy.weaponData.primary).toBe(3);
        expect(enemy.weaponData.primaryConfirmed).toBe(true);
    });

    it("off (default): a seen short sword becomes a diamond polearm guess while a bow is held, as before", async () => {
        const enemy = await enemyWith(3);
        game!.update();
        game!.update([{ sid: ENEMY, weaponIndex: 9 }]);
        expect(enemy.weaponData.primary).toBe(5);
    });

    it("on: still guesses a polearm when no primary has been seen", async () => {
        const enemy = await enemyWith(9, 0, TRUST);
        game!.update();
        expect(enemy.weaponData.primary).toBe(5);
        expect(enemy.weaponData.primaryConfirmed).toBe(false);
    });

    it("is off by default", async () => {
        vi.resetModules(); // earlier games turned it on in their copy of the settings
        const { combatSettings } = await import("@menu/content/combat");
        const find = (items: { id: string; status?: unknown; settings?: unknown[] }[]): unknown =>
            items.map(i => i.id === "trustSeenWeapons" ? i : find((i.settings ?? []) as never)).find(Boolean);
        expect((find(combatSettings as never) as { status: boolean }).status).toBe(false);
    });
});
