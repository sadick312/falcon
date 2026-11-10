// Defense brief, D1 and D2: 1.8.2's shame rule (bundle.js buildItem): the first food eaten within 120 ms of a hit
// adds a shame, later food takes 2 off, and reaching 8 locks eating for 30 s before that food is used, so it doesn't
// heal. Only eating changes shame; regen, healing pads and lifesteal don't.
//  D1 "Shame-Safe Healing" (Auto Healing sub-setting, default off): at 7 shame, Auto Heal doesn't eat within those
//     120 ms (a hit this tick or last); it eats the next tick instead.
//  D2 "Accurate Enemy Shame" (Combat, default off): an enemy's heal changes their shame count only when it looks like
//     food (20+, or 16+ to full health); otherwise it's left alone and their last hit time is kept.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;

describe("D1: Shame-Safe Healing", () => {
    /** We're at `shame`, an enemy polearm next to us makes the next hit lethal, and we were just hit. Apples eaten per tick. */
    async function emergency(shame: number, enable: string[]) {
        game = await startGame({ enable: ["autoHeal", "defensiveHatSwitching", ...enable] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: ENEMY, x: 1090, y: 1000, weaponIndex: 5 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        delete game.Client.player.skins[6]; // no soldier helmet: eating is the only answer
        game.Client.player.shameCount = shame;

        const eaten: number[] = [];
        game.setHealth(ME, 50); // the hit
        for (let i = 0; i < 2; i++) {
            const before = game.sent.length;
            game.update();
            eaten.push(game.sent.slice(before).filter(p => p.type === "z" && p.args[0] === 0 && p.args[1] === false).length);
        }
        return eaten;
    }

    it("off (default): at 7 shame it eats right after the hit, as before (in 1.8.2 that locks eating for 30 s)", async () => {
        expect((await emergency(7, []))[0]).toBeGreaterThan(0);
    });

    it("on: at 7 shame it waits out the 120 ms and eats the next tick", async () => {
        const eaten = await emergency(7, ["shameSafeHealing"]);
        expect(eaten[0]).toBe(0);
        expect(eaten[1]).toBeGreaterThan(0);
    });

    it("on: below 7 shame it eats right away as before (one more shame doesn't lock)", async () => {
        expect((await emergency(6, ["shameSafeHealing"]))[0]).toBeGreaterThan(0);
    });

    it("wouldShameLock: only 7+ shame and a hit seen this tick or last", async () => {
        game = await startGame();
        const { default: AutoHealer } = await import("@core/mod/defense/defense-modules/AutoHealer");
        const { tickState } = await import("@core/TickState");
        tickState.tick = 50;
        expect(AutoHealer.wouldShameLock({ shameCount: 7, hitTime: 49 })).toBe(true);
        expect(AutoHealer.wouldShameLock({ shameCount: 7, hitTime: 48 })).toBe(false);
        expect(AutoHealer.wouldShameLock({ shameCount: 6, hitTime: 49 })).toBe(false);
        expect(AutoHealer.wouldShameLock({ shameCount: 7, hitTime: 0 })).toBe(false);
    });
});

describe("D2: Accurate Enemy Shame", () => {
    /** The enemy is hit, then heals `heals` (each a separate health update) in the same tick. */
    async function enemyHeals(heals: number[], enable: string[], startHealth = 60) {
        game = await startGame({ enable });
        game.spawn({ sid: ME, x: 1000, y: 1000 });
        game.spawn({ sid: ENEMY, x: 1300, y: 1000 });
        game.update();
        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        const enemy = PlayerManager.get(ENEMY)!;
        enemy.shameCount = 3;

        game.setHealth(ENEMY, startHealth); // hit
        let health = startHealth;
        for (const heal of heals) {
            health = Math.min(100, health + heal);
            game.setHealth(ENEMY, health);
        }
        return enemy;
    }

    it("off (default): any heal right after a hit counts as eating, regen too", async () => {
        const enemy = await enemyHeals([3], []);
        expect(enemy.shameCount).toBe(4);
    });

    it("on: Angel Wings regen (+3) and a healing pad (+15) don't change shame, and the hit time is kept", async () => {
        const enemy = await enemyHeals([3, 15], ["accurateEnemyShame"]);
        expect(enemy.shameCount).toBe(3);
        expect(enemy.hitTime).not.toBe(0);
    });

    it("on: their next real food after the regen still counts as eating right after the hit", async () => {
        const enemy = await enemyHeals([3, 20], ["accurateEnemyShame"]);
        expect(enemy.shameCount).toBe(4);
        expect(enemy.hitTime).toBe(0);
    });

    it("on: food cut short at full health (+16 to 100) counts; regen to full doesn't", async () => {
        expect((await enemyHeals([16], ["accurateEnemyShame"], 84)).shameCount).toBe(4);
        game!.done();
        expect((await enemyHeals([3], ["accurateEnemyShame"], 97)).shameCount).toBe(3);
    });

    it("looksLikeFood", async () => {
        game = await startGame();
        const { default: HealthUpdateEvent } = await import("@core/socket/events/core/HealthUpdateEvent");
        expect(HealthUpdateEvent.looksLikeFood(20, 80, 100)).toBe(true);
        expect(HealthUpdateEvent.looksLikeFood(40, 70, 100)).toBe(true);
        expect(HealthUpdateEvent.looksLikeFood(15, 65, 100)).toBe(false);
        expect(HealthUpdateEvent.looksLikeFood(3, 100, 100)).toBe(false);
        expect(HealthUpdateEvent.looksLikeFood(15, 100, 100)).toBe(false);
        expect(HealthUpdateEvent.looksLikeFood(16, 100, 100)).toBe(true);
    });

    it("our own shame count is unchanged by the setting (it already counts only food we ate)", async () => {
        game = await startGame({ enable: ["accurateEnemyShame"] });
        game.spawn({ sid: ME, x: 1000, y: 1000 });
        game.update();
        const player = game.Client.player;
        player.shameCount = 3;
        game.setHealth(ME, 60);
        game.setHealth(ME, 63); // regen, no food eaten
        expect(player.shameCount).toBe(3);
    });
});
