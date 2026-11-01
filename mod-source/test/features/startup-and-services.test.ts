// Features #65 Server browser (ServerBrowser, Http), #66 Connection error screens, #67 Sub-millisecond timers
// (TaskScheduler), #68 Profiler (dev builds only) and #69 Script config. #63 Startup and page setup is exercised by
// every test through the test helper's page setup.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("Script config", () => {
    it("matches 1.8.2's game constants", async () => {
        const { default: ScriptConfig } = await import("@utils/config/ScriptConfig");
        expect(ScriptConfig.MAP_SIZE).toBe(14400);
        expect(ScriptConfig.SNOW_BIOME_TOP).toBe(2400);
        expect(ScriptConfig.PLAYER_SPEED).toBe(0.0016);
        expect(ScriptConfig.SERVER_UPDATE_SPEED).toBe(111); // 9 updates a second
        expect(ScriptConfig.GATHER_ANGLE).toBeCloseTo(Math.PI / 2.6);
        expect(ScriptConfig.HIT_ANGLE).toBeCloseTo(Math.PI / 2);
        expect(ScriptConfig.SHIELD_ANGLE).toBeCloseTo(Math.PI / 3);
        expect(ScriptConfig.GATHER_WIGGLE).toBe(10);
        expect(ScriptConfig.TURRET_GEAR_RELOAD).toBe(2500);
        expect(ScriptConfig.WEAPON_VARIANTS.map(v => [v.xp, v.val])).toEqual([[0, 1], [3000, 1.1], [7000, 1.18], [12000, 1.18]]);
    });
});

describe("Sub-millisecond timers", () => {
    it("keeps running other tasks after one throws", async () => {
        // A throwing task used to stop the scheduler for good.
        const { default: TaskScheduler } = await import("@services/event-timer/TaskScheduler");
        vi.spyOn(console, "error").mockImplementation(() => { });
        TaskScheduler.init();
        const ran: string[] = [];
        TaskScheduler.setTimeout(() => { throw new Error("boom"); }, 5);
        TaskScheduler.setTimeout(() => ran.push("same batch"), 5);
        await vi.waitFor(() => expect(ran).toEqual(["same batch"]));
        TaskScheduler.setTimeout(() => ran.push("later"), 5);
        await vi.waitFor(() => expect(ran).toEqual(["same batch", "later"]));
    });
});

describe("Network requests", () => {
    it("retries a 5xx, then gives a readable error", async () => {
        const { fetchJson } = await import("@services/network/Http");
        const fetch = vi.fn(async () => new Response("down", { status: 503, statusText: "Unavailable" }));
        vi.stubGlobal("fetch", fetch);
        await expect(fetchJson("https://example.test/servers", {}, { step: "server-list", timeoutMs: 1000, retries: 2, backoffMs: 1 }))
            .rejects.toThrow("HTTP 503 Unavailable: down");
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("doesn't retry a 404", async () => {
        const { fetchJson } = await import("@services/network/Http");
        const fetch = vi.fn(async () => new Response("", { status: 404 }));
        vi.stubGlobal("fetch", fetch);
        await expect(fetchJson("https://example.test/x", {}, { step: "join", timeoutMs: 1000, retries: 2, backoffMs: 1 })).rejects.toThrow("HTTP 404");
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});

describe("Profiler", () => {
    it("measures nothing unless switched on", async () => {
        localStorage.removeItem("falcon-profiler");
        vi.resetModules();
        const { profileStart } = await import("@services/profiler/Profiler");
        expect(profileStart()).toBe(0);
    });
});
