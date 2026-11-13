// Camera > "View Distance" (default 100% = the classic view) and "Limit Wheel Zoom" (off by default).
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp(enable: string[] = [], settings: Record<string, unknown> = {}) {
    game = await startGame({ enable, settings });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    const view = await import("@rendering/core/ViewDistance");
    const { default: RenderingConfig } = await import("@rendering/RenderingConfig");
    return { view, RenderingConfig };
}

describe("View Distance", () => {
    it("defaults to 100%: the reset view is the classic 1920 × 1080", async () => {
        const { view, RenderingConfig } = await setUp([], { viewDistance: 100 });
        view.setViewPercent(view.viewPercent());
        expect(RenderingConfig.maxScreenWidth).toBe(1920);
        expect(RenderingConfig.maxScreenHeight).toBe(1080);
    });

    it("uses the slider's value, kept within 75-250%", async () => {
        const { view, RenderingConfig } = await setUp([], { viewDistance: "150" });
        view.setViewPercent(view.viewPercent());
        expect(RenderingConfig.maxScreenWidth).toBe(2880);
        game!.Menu.itemMap.viewDistance.status = 999;
        expect(view.viewPercent()).toBe(250);
    });

    it("moving the slider changes the view on the next frame; the first frame only remembers it", async () => {
        const { view, RenderingConfig } = await setUp([], { viewDistance: 100 });
        RenderingConfig.maxScreenWidth = 1920 * 1.25;
        expect(view.applyViewDistanceChange()).toBe(false);
        expect(RenderingConfig.maxScreenWidth).toBe(1920 * 1.25);
        game!.Menu.itemMap.viewDistance.status = "200";
        expect(view.applyViewDistanceChange()).toBe(true);
        expect(RenderingConfig.maxScreenWidth).toBe(3840);
        expect(view.applyViewDistanceChange()).toBe(false);
    });
});

describe("Limit Wheel Zoom", () => {
    it("off (classic): the wheel zooms without limit, 5% a step", async () => {
        const { view, RenderingConfig } = await setUp();
        view.setViewPercent(100);
        for (let i = 0; i < 40; i++) view.wheelZoom(true);
        expect(view.currentViewPercent()).toBeGreaterThan(600);
        view.setViewPercent(100);
        view.wheelZoom(false);
        expect(RenderingConfig.maxScreenWidth).toBeCloseTo(1920 * 0.95);
    });

    it("on: stays between 75% and 250%", async () => {
        const { view } = await setUp(["limitWheelZoom"]);
        view.setViewPercent(100);
        for (let i = 0; i < 40; i++) view.wheelZoom(true);
        expect(view.currentViewPercent()).toBeCloseTo(250);
        for (let i = 0; i < 80; i++) view.wheelZoom(false);
        expect(view.currentViewPercent()).toBeCloseTo(75);
    });

    it("both are classic by default", async () => {
        vi.resetModules();
        const { visualSettings } = await import("@menu/content/visual");
        type Item = { id: string; status?: unknown; settings?: Item[] };
        const find = (items: Item[], id: string): Item | undefined =>
            items.map(i => i.id === id ? i : find(i.settings ?? [], id)).find(Boolean);
        expect(find(visualSettings as Item[], "viewDistance")?.status).toBe(100);
        expect(find(visualSettings as Item[], "limitWheelZoom")?.status).toBe(false);
    });
});
