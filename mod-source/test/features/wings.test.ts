// Blood Wings Optimizations and Angel Wings Regen (HatSystem.fetchBestAccessory, AutoHealer, WingsUtils).
// 1.8.2: Blood Wings heals healD 0.2 of the damage of a melee hit on a player; Angel Wings regenerates 3 health a
// second. Neither counts as eating, so neither adds shame.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(async () => {
    const { Input } = await import("@ui/Hook");
    Input.keys["Space"] = false;
    game?.done();
});

const POLEARM = 5;
const MONKEY_TAIL = 11;
const ANGEL_WINGS = 13;
const BLOOD_WINGS = 18;

interface Scenario {
    enable?: string[];
    health?: number;
    enemyX?: number;
    swing?: boolean;
    aim?: number;
    wearing?: number;
    shame?: number;
    /** The enemy just swung, so only its (guessed) musket + turret, 75, threatens us: not lethal at 85 health. */
    enemyReloading?: boolean;
}

/** One checked tick; returns the accessory the Hat System chose, apples eaten and Auto Heal's response. */
async function play(s: Scenario = {}) {
    game = await startGame({ enable: s.enable ?? ["bloodWingsOptimizations", "angelWingsRegen", "autoHeal"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM, tailIndex: s.wearing ?? 0 });
    game.spawn({ sid: 2, x: s.enemyX ?? 1150, y: 1000, weaponIndex: POLEARM });
    game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
    game.update();
    if (s.health !== undefined) game.setHealth(ME, s.health);
    game.update();
    game.update();

    const player = game.Client.player;
    player.shameCount = s.shame ?? 0;
    if (s.enemyReloading) {
        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        PlayerManager.get(2)!.reloads[POLEARM] = 0;
    }
    const { Input } = await import("@ui/Hook");
    vi.spyOn(Input, "getAttackDir").mockReturnValue(s.aim ?? 0);
    Input.keys["Space"] = !!s.swing;

    const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
    const { default: ModManager } = await import("@core/ModManager");
    let accessory: number | undefined;
    vi.spyOn(HatSystem, "storeEquip").mockImplementation((id, isAccessory) => { if (isAccessory) accessory = id; });

    const before = game.sent.length;
    game.update([{ sid: ME, tailIndex: s.wearing ?? 0 }]);
    const eaten = game.sent.slice(before).filter(p => p.type === "z" && p.args[0] === 0 && p.args[1] === false).length;
    return { accessory, eaten, response: ModManager.brainState.healingResponse };
}

describe("Blood Wings Optimizations", () => {
    it("wears Blood Wings for a melee hit on an enemy while hurt", async () => {
        expect((await play({ health: 60, swing: true })).accessory).toBe(BLOOD_WINGS);
    });

    it("doesn't at full health, when the swing misses every enemy, without a swing, or when off", async () => {
        expect((await play({ swing: true })).accessory).not.toBe(BLOOD_WINGS);
        // The bull hit aims at the nearest enemy by itself, so only reach matters.
        expect((await play({ health: 60, swing: true, enemyX: 1400 })).accessory).not.toBe(BLOOD_WINGS);
        expect((await play({ health: 60 })).accessory).not.toBe(BLOOD_WINGS);
        expect((await play({ health: 60, swing: true, enable: ["autoHeal"] })).accessory).not.toBe(BLOOD_WINGS);
    });

    it("at 4+ shame, lets a Blood Wings hit heal instead of eating", async () => {
        const { eaten, response } = await play({ health: 85, swing: true, wearing: BLOOD_WINGS, shame: 5, enemyReloading: true });
        expect(eaten).toBe(0);
        expect(response).toBe("blood wings heal");
    });

    it("still eats at low shame, or when Blood Wings isn't on yet", async () => {
        expect((await play({ health: 85, swing: true, wearing: BLOOD_WINGS, shame: 1, enemyReloading: true })).eaten).toBeGreaterThan(0);
        expect((await play({ health: 85, swing: true, shame: 5, enemyReloading: true })).eaten).toBeGreaterThan(0);
    });

    it("still eats right away when the coming damage could kill", async () => {
        // Lethal damage is handled before the shame rules, Blood Wings or not.
        expect((await play({ health: 60, swing: true, wearing: BLOOD_WINGS, shame: 5 })).eaten).toBeGreaterThan(0);
    });
});

describe("Angel Wings Regen", () => {
    it("wears Angel Wings while hurt with no enemy close", async () => {
        expect((await play({ health: 60, enemyX: 2000, enable: ["angelWingsRegen"] })).accessory).toBe(ANGEL_WINGS);
    });

    it("keeps Monkey Tail at full health, with an enemy close, or when off", async () => {
        expect((await play({ enemyX: 2000, enable: ["angelWingsRegen"] })).accessory).toBe(MONKEY_TAIL);
        expect((await play({ health: 60, enemyX: 1200, enable: ["angelWingsRegen"] })).accessory).not.toBe(ANGEL_WINGS);
        expect((await play({ health: 60, enemyX: 2000, enable: [] })).accessory).toBe(MONKEY_TAIL);
    });
});
