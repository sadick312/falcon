// Phase 3B part 1: the Reload HUD's rows and the "Combat Debug Log" reload lines.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => {
    game?.done();
    vi.restoreAllMocks();
});

const ENEMY = 2;
const SERVER_TICK_MS = 1000 / 9;

async function setup(enable: string[] = []) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5, 10], [0, 3, 6, 10, 15]);
    game.spawn({ sid: ENEMY, x: 1300, y: 1000, weaponIndex: 5 });
    game.update();
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { default: Client } = await import("@core/Client");
    const hud = await import("@rendering/utils/mod/renderReloadHud");
    return { enemy: PlayerManager.get(ENEMY)!, me: Client.player, hud };
}

describe("ticksUntilReady", () => {
    it("is 0 when ready, and counts whole server ticks otherwise", async () => {
        const { hud } = await setup();
        expect(hud.ticksUntilReady(1, 700)).toBe(0);
        expect(hud.ticksUntilReady(0, 700)).toBe(Math.ceil(700 / SERVER_TICK_MS));
        expect(hud.ticksUntilReady(0.5, 700)).toBe(Math.ceil(350 / SERVER_TICK_MS));
    });
});

describe("Reload HUD rows", () => {
    it("shows our primary and secondary, then the enemy's two weapons", async () => {
        const { me, enemy, hud } = await setup();
        const rows = hud.reloadHudRows(me, enemy);
        expect(rows.map(r => `${r.who}:${r.weapon}`)).toEqual([
            "You:polearm", "You:great hammer", "Enemy:polearm", "Enemy:musket?"
        ]);
        expect(rows.every(r => r.reload === 1 && r.ticksLeft === 0)).toBe(true);
    });

    it("counts down the enemy polearm after a swing, matching the reload Falcon acts on", async () => {
        const { me, enemy, hud } = await setup();
        game!.handlers.K(ENEMY, false, 5);
        game!.update();
        const after = hud.reloadHudRows(me, enemy).find(r => r.who === "Enemy" && r.weapon === "polearm")!;
        expect(after.reload).toBeLessThan(1);
        expect(after.ticksLeft).toBeGreaterThan(0);
        let ticks = 0;
        while (enemy.reloads[5] !== 1 && ticks < 20) {
            const before = hud.reloadHudRows(me, enemy).find(r => r.who === "Enemy" && r.weapon === "polearm")!.ticksLeft;
            game!.update();
            ticks++;
            const now = hud.reloadHudRows(me, enemy).find(r => r.who === "Enemy" && r.weapon === "polearm")!.ticksLeft;
            expect(now).toBeLessThanOrEqual(before);
        }
        expect(hud.reloadHudRows(me, enemy).find(r => r.who === "Enemy" && r.weapon === "polearm")!.ticksLeft).toBe(0);
    });

    it("shows only our rows without an enemy", async () => {
        const { me, hud } = await setup();
        expect(hud.reloadHudRows(me, null).map(r => r.who)).toEqual(["You", "You"]);
    });
});

describe("Combat Debug Log (default off)", () => {
    it("on: logs the swing and how many ticks the reload took (polearm: 7)", async () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        await setup(["combatDebugLog"]);
        game!.handlers.K(ENEMY, false, 5);
        for (let i = 0; i < 12; i++) game!.update();
        const lines = log.mock.calls.map(c => String(c[0])).filter(l => l.startsWith("[reload]"));
        expect(lines.some(l => l.includes("event=swing") && l.includes("weapon=polearm") && l.includes("reloadMs=700"))).toBe(true);
        expect(lines.some(l => l.includes("event=ready") && l.includes("ticksAfterSwing=7"))).toBe(true);
    });

    it("off: logs nothing", async () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        await setup();
        game!.handlers.K(ENEMY, false, 5);
        for (let i = 0; i < 12; i++) game!.update();
        expect(log.mock.calls.some(c => String(c[0]).startsWith("[reload]"))).toBe(false);
    });

    it("is off by default, and so is the Reload HUD", async () => {
        vi.resetModules();
        const { configsSettings } = await import("@menu/content/other");
        const { visualSettings } = await import("@menu/content/visual");
        type Item = { id: string; status?: unknown; settings?: Item[] };
        const find = (items: Item[], id: string): Item | undefined =>
            items.map(i => i.id === id ? i : find(i.settings ?? [], id)).find(Boolean);
        expect(find(configsSettings as Item[], "combatDebugLog")?.status).toBe(false);
        expect(find(visualSettings as Item[], "reloadBars:hud")?.status).toBe(false);
    });
});
