// Pure helpers that the replay tests only reach indirectly: placement intervals, ping smoothing, the packet budget,
// settings migration, the HTTP helper and a few small utilities.
import { NetworkError, fetchJson } from "@services/network/Http";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("small utilities", () => {
    it("randFloat stays in [min, max + 1), like randInt (only used for a random sprite rotation)", async () => {
        const { default: randFloat } = await import("@utils/random/randFloat");
        for (let i = 0; i < 200; i++) {
            const value = randFloat(2, 5);
            expect(value).toBeGreaterThanOrEqual(2);
            expect(value).toBeLessThan(6);
        }
    });

    it("Stack pushes, pops, peeks and ignores undefined", async () => {
        const { default: Stack } = await import("@menu/misc/Stack");
        const stack = new Stack<number>();
        expect(stack.isEmpty()).toBe(true);

        stack.push(1);
        stack.push(undefined as unknown as number);
        stack.push(2);
        expect([stack.size(), stack.peek()]).toEqual([2, 2]);
        expect(stack.pop()).toBe(2);

        stack.clear();
        expect(stack.pop()).toBeUndefined();
    });

    it("HealerUtils gives apples 20, cookies 40 and cheese 30 health", async () => {
        const { default: HealerUtils } = await import("@core/mod/defense/utils/HealerUtils");
        expect([0, 1, 2].map((id) => HealerUtils.getFoodValue(id))).toEqual([20, 40, 30]);
    });

    it("isCactusObject is true only for bushes in the desert at the bottom of the map", async () => {
        const { isCactusObject } = await import("@constants/world");
        const { default: ScriptConfig } = await import("@utils/config/ScriptConfig");
        const desertY = ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;

        expect(isCactusObject({ type: 1, y: desertY })).toBe(true);
        expect(isCactusObject({ type: 1, y: desertY - 1 })).toBe(false);
        expect(isCactusObject({ type: 0, y: desertY + 100 })).toBe(false);
    });
});

describe("PingTracker", () => {
    it("uses the median of the last five pings, so one spike doesn't move it", async () => {
        vi.resetModules();
        const { default: PingTracker } = await import("@core/mod/utils/PingTracker");
        expect(PingTracker.getStablePing()).toBe(50);

        for (const ping of [60, 62, 61, 400, 63]) PingTracker.update(ping);
        expect(PingTracker.getCurrentPing()).toBe(63);
        expect(PingTracker.getStablePing()).toBe(62);

        // Even count: average of the two middle values. Then old pings drop out of the window of five.
        vi.resetModules();
        const { default: Fresh } = await import("@core/mod/utils/PingTracker");
        Fresh.update(10);
        Fresh.update(30);
        expect(Fresh.getStablePing()).toBe(20);
        for (const ping of [100, 100, 100, 100, 100]) Fresh.update(ping);
        expect(Fresh.getStablePing()).toBe(100);
    });
});

describe("IntervalHelper.computeInterval (where an item can be placed around one object)", () => {
    async function setup() {
        const { default: IntervalHelper } = await import("@utils/geometry/IntervalHelper");
        const { default: GameObject } = await import("@constants/GameObject");
        const { default: items } = await import("@constants/items");
        const spike = items.list.find((item) => item.name === "spikes")!;
        // A tree-sized natural object (type 0) at a given position.
        const tree = (x: number, y: number) => new GameObject(x, y, 0, 50, 0, -1);
        return { IntervalHelper, spike, tree };
    }

    it("blocks nothing when the object is out of reach", async () => {
        const { IntervalHelper, spike, tree } = await setup();
        expect(IntervalHelper.computeInterval({ x: 0, y: 0 }, tree(1000, 1000), spike)).toBe(0);
        expect(IntervalHelper.computeBufferLength).toBe(0);
    });

    it("blocks the whole circle when the object is right on top of the player", async () => {
        const { IntervalHelper, spike, tree } = await setup();
        expect(IntervalHelper.computeInterval({ x: 0, y: 0 }, tree(5, 5), spike)).toBe(1);
        expect(IntervalHelper.computeBuffer[0]).toEqual([0, Math.PI * 2]);
    });

    it("blocks an arc centred on the direction to the object", async () => {
        const { IntervalHelper, spike, tree } = await setup();
        // Straight down: direction pi / 2, far from the 0 / 2pi wrap point.
        expect(IntervalHelper.computeInterval({ x: 0, y: 0 }, tree(0, 100), spike)).toBe(1);

        const [start, end] = IntervalHelper.computeBuffer[0];
        expect((start + end) / 2).toBeCloseTo(Math.PI / 2, 6);
        expect(end - start).toBeGreaterThan(0);
        expect(end - start).toBeLessThan(Math.PI);
    });

    it("splits an arc that crosses angle 0 into two intervals", async () => {
        const { IntervalHelper, spike, tree } = await setup();
        // Straight right: direction 0, so the arc runs from just below 2pi round to just above 0.
        expect(IntervalHelper.computeInterval({ x: 0, y: 0 }, tree(100, 0), spike)).toBe(2);

        const [[aStart, aEnd], [bStart, bEnd]] = IntervalHelper.computeBuffer;
        expect(aEnd).toBe(Math.PI * 2);
        expect(bStart).toBe(0);
        // Symmetric around 0.
        expect(Math.PI * 2 - aStart).toBeCloseTo(bEnd, 6);
    });
});

describe("PacketTracker (packets per second budget)", () => {
    it("counts only the packets sent in the last second, and does nothing before init", async () => {
        vi.resetModules();
        let now = 5_000;
        vi.spyOn(performance, "now").mockImplementation(() => now);
        const { default: PacketTracker } = await import("@core/utils/PacketTracker");

        PacketTracker.add();
        expect(PacketTracker.getCurrent()).toBe(0);
        expect(PacketTracker.request("PLACE", 5)).toBe(0);

        PacketTracker.init();
        for (let i = 0; i < 10; i++) {
            PacketTracker.add();
            now += 50;
        }
        expect(PacketTracker.getCurrent()).toBe(10);

        // Sent at 5000, 5050 ... 5450 ms; at 6300 ms only those from 5300 on are within the last second.
        now += 800;
        expect(PacketTracker.getCurrent()).toBe(4);
    });

    it("grants at most what fits under the 110-packet limit over the next two ticks", async () => {
        vi.resetModules();
        vi.spyOn(performance, "now").mockImplementation(() => 5_000);
        const { default: PacketTracker } = await import("@core/utils/PacketTracker");
        PacketTracker.init();

        // Nothing sent yet, 14 packets reserved per tick for attack, aim, hat, food, move and weapon:
        // after two more ticks 42 are reserved, leaving (110 - 42) / 3 = 22 placements (3 packets each).
        expect(PacketTracker.request("PLACE", 100)).toBe(22);
        expect(PacketTracker.request("PLACE", 4)).toBe(4);
        // Padding reserves room that the request itself can't use.
        expect(PacketTracker.request("PLACE", 100, 66)).toBe(0);
    });
});

describe("settings migration and validation", () => {
    it("migrateSettings copies, drops the version key and turns non-objects into {}", async () => {
        const { migrateSettings, SETTINGS_VERSION_KEY } = await import("@menu/settingsVersion");
        const saved = { [SETTINGS_VERSION_KEY]: 0, renderNames: false };

        expect(migrateSettings(saved)).toEqual({ renderNames: false });
        expect(saved).toHaveProperty(SETTINGS_VERSION_KEY);
        for (const bad of [null, 5, "x", [1, 2]]) expect(migrateSettings(bad)).toEqual({});
        // Settings from a newer Falcon pass through unchanged.
        expect(migrateSettings({ [SETTINGS_VERSION_KEY]: 99, a: 1 })).toEqual({ a: 1 });
    });

    it("isValidSettingValue accepts only values the menu could have stored", async () => {
        const { isValidSettingValue } = await import("@menu/settingsVersion");
        const item = (type: string, extra = {}) => ({ label: "", id: "x", type, ...extra }) as Parameters<typeof isValidSettingValue>[0];

        expect(isValidSettingValue(item("toggle"), true)).toBe(true);
        expect(isValidSettingValue(item("toggle"), "true")).toBe(false);
        expect(["5", 5, "2.5"].every((v) => isValidSettingValue(item("slider"), v))).toBe(true);
        expect(["", "abc", null, {}].some((v) => isValidSettingValue(item("number"), v))).toBe(false);

        const select = item("select", { options: [{ label: "A", value: 0 }, { label: "B", value: "1" }] });
        expect([0, "0", 1, "1"].every((v) => isValidSettingValue(select, v))).toBe(true);
        expect(isValidSettingValue(select, 2)).toBe(false);
    });
});

describe("fetchJson", () => {
    afterEach(() => vi.unstubAllGlobals());

    const response = (status: number, body: string) => new Response(body, { status });

    it("returns parsed JSON", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => response(200, '{"ok":1}')));
        await expect(fetchJson("https://x/", {}, { step: "test", timeoutMs: 1000 })).resolves.toEqual({ ok: 1 });
    });

    it("retries server errors with backoff, but not client errors", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response(503, "busy"))
            .mockResolvedValueOnce(response(200, "[1]"));
        vi.stubGlobal("fetch", fetchMock);
        await expect(fetchJson("https://x/", {}, { step: "test", timeoutMs: 1000, retries: 1, backoffMs: 0 })).resolves.toEqual([1]);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const notFound = vi.fn(async () => response(404, "nope"));
        vi.stubGlobal("fetch", notFound);
        const err = await fetchJson("https://x/", {}, { step: "list", timeoutMs: 1000, retries: 3, backoffMs: 0 }).catch((e: unknown) => e) as NetworkError;
        expect(err).toBeInstanceOf(NetworkError);
        expect([err.step, err.status, err.retryable, err.message]).toEqual(["list", 404, false, "HTTP 404: nope"]);
        expect(notFound).toHaveBeenCalledTimes(1);
    });

    it("explains timeouts and invalid JSON", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("timed out", "TimeoutError"); }));
        await expect(fetchJson("https://x/", {}, { step: "t", timeoutMs: 2000 })).rejects.toThrow("Request timed out after 2s");

        vi.stubGlobal("fetch", vi.fn(async () => response(200, "<html>")));
        await expect(fetchJson("https://x/", {}, { step: "t", timeoutMs: 2000 })).rejects.toThrow("not valid JSON");
    });
});

describe("endpoint overrides (falcon-endpoint-overrides in localStorage)", () => {
    async function loadEndpoints(overrides: Record<string, unknown>, hostMode?: string) {
        localStorage.setItem("falcon-endpoint-overrides", JSON.stringify(overrides));
        if (hostMode) localStorage.setItem("falcon-host-mode", hostMode);
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        vi.resetModules();
        return (await import("@constants/Endpoints")).default;
    }

    it("keeps an override only if it's https on the game's own domain", async () => {
        const endpoints = await loadEndpoints({
            apiOrigin: "https://evil.example",
            gameOrigin: "http://sandbox.moomoo.io",
            protocolUrl: "https://cdn.moomoo.io/protocol.js",
            serverListPath: "/servers-test"
        });

        expect(endpoints.config.apiOrigin).toBe("https://api-sandbox2.moomoo.io");
        expect(endpoints.config.gameOrigin).toBe("https://sandbox.moomoo.io");
        expect(endpoints.config.protocolUrl).toBe("https://cdn.moomoo.io/protocol.js");
        expect(endpoints.config.serverListPath).toBe("/servers-test");
    });

    it("lets a local test page pick the moomodding.io profile", async () => {
        const endpoints = await loadEndpoints({}, "moomodding");
        expect([endpoints.mode, endpoints.gameVersion]).toEqual(["moomodding", "1.8.2"]);
    });
});
