// A4: the server browser (ui/ServerBrowser.ts): reading both sites' server lists, the cache, the list on screen
// (order, ?server= preselect, double-click to join, refresh, cancel), pings, and the "recent server" buttons' data.
import { afterEach, describe, expect, it, vi } from "vitest";

/** As served by sandbox.moomodding.io/servers (copied from the live page's MOOMODDING_SERVERS, 7 Nov 2026). */
const MOOMODDING_LIST = [
    { id: "1:1", region: "1", name: "1", key: "1:1", display_name: "Frankfurt 1", ip: "s1.moomodding.io", port: 443, playerCount: 3, playerCapacity: 30 },
    { id: "2:1", region: "2", name: "1", key: "2:1", display_name: "Miami 1", ip: "s2.moomodding.io", port: 443, playerCount: 9, playerCapacity: 30 },
    { id: "3:1", region: "3", name: "1", key: "3:1", display_name: "Singapore 1", ip: "singaporemoomoddingserver.onrender.com", port: 8443, playerCount: 0, playerCapacity: 30 }
];

const MOOMOO_LIST = [
    { key: "abc", name: "0", regionName: "Frankfurt", region: "eu", playerCount: 12, playerCapacity: 40, auth: false, version: "1.28" },
    { key: "def", name: "1", regionName: "Miami", region: "na", playerCount: 30, playerCapacity: 40, auth: false, version: "1.28" }
];

interface FetchSetup {
    list?: unknown;
    status?: number;
    /** Make /ping requests fail. */
    pingFails?: boolean;
}

function stubFetch(setup: FetchSetup) {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/ping")) {
            if (setup.pingFails) throw new TypeError("Failed to fetch");
            return new Response("", { status: 200 });
        }
        return new Response(JSON.stringify(setup.list), { status: setup.status ?? 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return { calls, fetchMock, listCalls: () => calls.filter(url => !url.endsWith("/ping")).length };
}

async function load(mode: "moomodding" | "moomoo-sandbox", search = "") {
    vi.resetModules();
    localStorage.setItem("falcon-host-mode", mode);
    window.history.replaceState(null, "", `/${search}`);
    await import("@core/socket/SocketListener");
    const { default: ServerBrowser } = await import("@ui/ServerBrowser");
    const { default: Client } = await import("@core/Client");
    const connect = vi.spyOn(Client, "connect").mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => { });
    return { ServerBrowser, Client, connect };
}

const options = () => [...document.querySelectorAll<HTMLButtonElement>(".server-browser-option")];
const byId = (id: string) => document.getElementById(id)!;

afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
});

describe("reading the server list", () => {
    it("turns moomodding.io entries into hosts, labels and capacities", async () => {
        const { calls } = stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser } = await load("moomodding");

        const data = await ServerBrowser.getData();

        expect(calls[0]).toBe("https://sandbox.moomodding.io/servers");
        expect(data.map(s => [s.key, s.label, s.host, s.capacity])).toEqual([
            ["1:1", "Frankfurt 1", "s1.moomodding.io", 30],
            ["2:1", "Miami 1", "s2.moomodding.io", 30],
            // A port other than 443 is kept.
            ["3:1", "Singapore 1", "singaporemoomoddingserver.onrender.com:8443", 30]
        ]);
    });

    it("falls back to region:name when a moomodding entry has no display name", async () => {
        stubFetch({ list: [{ ...MOOMODDING_LIST[0], display_name: "", playerCapacity: undefined }] });
        const { ServerBrowser } = await load("moomodding");

        const [server] = await ServerBrowser.getData();
        expect(server.label).toBe("1:1");
        expect(server.capacity).toBe(0);
    });

    it("builds {key}.{region}.moomoo.io hosts on sandbox.moomoo.io", async () => {
        const { calls } = stubFetch({ list: MOOMOO_LIST });
        const { ServerBrowser } = await load("moomoo-sandbox");

        const data = await ServerBrowser.getData();

        expect(calls[0]).toBe("https://api-sandbox2.moomoo.io/servers?v=1.28");
        expect(data.map(s => [s.label, s.host, s.capacity])).toEqual([
            ["Frankfurt 0", "abc.eu.moomoo.io", 40],
            ["Miami 1", "def.na.moomoo.io", 40]
        ]);
    });

    it("skips malformed entries but keeps the good ones", async () => {
        stubFetch({ list: [MOOMODDING_LIST[0], { key: "x" }, null, { ...MOOMODDING_LIST[1], ip: undefined }] });
        const { ServerBrowser } = await load("moomodding");

        const data = await ServerBrowser.getData();
        expect(data.map(s => s.key)).toEqual(["1:1"]);
    });

    it("reports a list that isn't an array, or has no usable entry, as an API change", async () => {
        stubFetch({ list: { servers: [] } });
        let { ServerBrowser } = await load("moomodding");
        await expect(ServerBrowser.getData()).rejects.toThrow(/not an array/);

        stubFetch({ list: [{ nope: true }] });
        ({ ServerBrowser } = await load("moomodding"));
        await expect(ServerBrowser.getData()).rejects.toThrow(/unexpected shape/);
    });

    it("accepts an empty list", async () => {
        stubFetch({ list: [] });
        const { ServerBrowser } = await load("moomodding");
        await expect(ServerBrowser.getData()).resolves.toEqual([]);
    });

    it("reports an HTTP error without retrying a 404", async () => {
        const { listCalls } = stubFetch({ list: "gone", status: 404 });
        const { ServerBrowser } = await load("moomodding");

        await expect(ServerBrowser.getData()).rejects.toThrow(/HTTP 404/);
        expect(listCalls()).toBe(1);
    });

    it("caches the list, shares one request between callers, and refetches when forced", async () => {
        const { listCalls } = stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser } = await load("moomodding");

        await Promise.all([ServerBrowser.getData(), ServerBrowser.getData()]);
        expect(listCalls()).toBe(1);

        await ServerBrowser.getData();
        expect(listCalls()).toBe(1);

        await ServerBrowser.getData(true);
        expect(listCalls()).toBe(2);
    });

    it("refetches once the cache is older than 15 s", async () => {
        const { listCalls } = stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser } = await load("moomodding");
        const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);

        await ServerBrowser.getData();
        now.mockReturnValue(1_000_000 + 15_001);
        await ServerBrowser.getData();

        expect(listCalls()).toBe(2);
    });
});

describe("the list on screen", () => {
    it("shows the servers busiest first, with player counts", async () => {
        stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser } = await load("moomodding");

        ServerBrowser.start();
        await vi.waitFor(() => expect(options()).toHaveLength(3));

        expect(byId("server-browser-page").style.display).toBe("flex");
        expect(byId("main-menu").style.display).toBe("none");
        // jsdom keeps innerText as a plain property, so read it back the way it was written.
        expect(options().map(o => o.querySelector<HTMLElement>(".server-browser-option-label-holder div")!.innerText)).toEqual(["Miami 1", "Frankfurt 1", "Singapore 1"]);
        const count = options()[0].querySelector(".server-browser-option-player-count")!;
        expect(count.querySelector("span")!.innerText).toBe("9");
        expect(count.textContent).toContain("/30");
        expect(byId("server-browser-loading-text").style.display).toBe("none");
        expect(byId("connection-server-btn").classList.contains("disabled")).toBe(true);
    });

    it("preselects the server named in ?server=", async () => {
        stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser } = await load("moomodding", "?server=3:1");

        ServerBrowser.start();
        await vi.waitFor(() => expect(ServerBrowser.selectedOption?.key).toBe("3:1"));

        expect(options()[2].classList.contains("active")).toBe(true);
        expect(byId("connection-server-btn").classList.contains("disabled")).toBe(false);
    });

    it("selects on the first click and joins on the second", async () => {
        stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser, connect } = await load("moomodding");
        ServerBrowser.start();
        await vi.waitFor(() => expect(options()).toHaveLength(3));

        options()[1].click();
        expect(ServerBrowser.selectedOption?.key).toBe("1:1");
        expect(connect).not.toHaveBeenCalled();

        options()[0].click(); // switching moves the highlight
        expect(options()[1].classList.contains("active")).toBe(false);
        expect(options()[0].classList.contains("active")).toBe(true);

        options()[0].click();
        expect(connect).toHaveBeenCalledTimes(1);
        expect(ServerBrowser.selectedOption?.key).toBe("2:1");
    });

    it("joins the selected server with the Connect button", async () => {
        stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser, connect } = await load("moomodding");
        ServerBrowser.start();
        await vi.waitFor(() => expect(options()).toHaveLength(3));

        options()[2].click();
        byId("connection-server-btn").click();

        expect(connect).toHaveBeenCalledTimes(1);
        expect(ServerBrowser.selectedOption?.key).toBe("3:1");
    });

    it("refresh fetches a new list and replaces the old one", async () => {
        const { listCalls } = stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser } = await load("moomodding");
        ServerBrowser.start();
        await vi.waitFor(() => expect(options()).toHaveLength(3));
        options()[0].click();

        stubFetch({ list: [MOOMODDING_LIST[0]] });
        byId("refresh-server-browser-btn").click();
        await vi.waitFor(() => expect(options()).toHaveLength(1));

        expect(listCalls()).toBe(1); // the first stub's count; the refresh went to the new stub
        expect(ServerBrowser.selectedOption).toBeUndefined();
        expect(byId("refresh-server-browser-btn").classList.contains("disabled")).toBe(false);
    });

    it("cancel goes back to the main menu and forgets the selection", async () => {
        stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser } = await load("moomodding");
        ServerBrowser.start();
        await vi.waitFor(() => expect(options()).toHaveLength(3));
        options()[0].click();

        byId("cancel-server-browser-btn").click();

        expect(ServerBrowser.selectedOption).toBeUndefined();
        expect(ServerBrowser.selectionIndex).toBe(-1);
        expect(byId("main-menu").style.display).toBe("flex");
        expect(byId("server-browser-page").style.display).toBe("none");
    });

    it("shows a notice instead of a list when the request fails", async () => {
        stubFetch({ list: { error: true } });
        const { ServerBrowser } = await load("moomodding");

        ServerBrowser.start();
        await vi.waitFor(() => expect(document.getElementById("falcon-connection-notice")?.style.display).toBe("block"));

        expect(byId("falcon-connection-notice").innerText).toMatch(/^Server list failed: /);
        expect(options()).toHaveLength(0);
        expect(byId("server-browser-loading-text").style.display).toBe("none");
    });

    it("shows each server's ping, or ? when it doesn't answer", async () => {
        stubFetch({ list: MOOMODDING_LIST });
        const { ServerBrowser } = await load("moomodding");
        ServerBrowser.start();
        await vi.waitFor(() => expect(byId("server-ping-0").innerText).toMatch(/^\d+ ms$/));
        expect(byId("server-ping-0").style.color).not.toBe("");

        const pings = stubFetch({ list: MOOMODDING_LIST, pingFails: true });
        byId("refresh-server-browser-btn").click();
        await vi.waitFor(() => expect(byId("server-ping-0").innerText).toBe("? ms"));
        // Pings go to the game host's /ping, never a game connection.
        expect(pings.calls.filter(url => url.endsWith("/ping")).every(url => url.startsWith("https://"))).toBe(true);
    });
});

describe("quick-connect lookups", () => {
    it("getHighest picks the busiest server in a region", async () => {
        stubFetch({ list: [...MOOMODDING_LIST, { ...MOOMODDING_LIST[0], key: "1:2", name: "2", playerCount: 20 }] });
        const { ServerBrowser } = await load("moomodding");

        expect((await ServerBrowser.getHighest("1"))?.key).toBe("1:2");
        expect(await ServerBrowser.getHighest("9")).toBeNull();
    });

    it("find tells 'gone' (null) apart from 'couldn't fetch' (undefined)", async () => {
        stubFetch({ list: MOOMODDING_LIST });
        let { ServerBrowser } = await load("moomodding");
        expect((await ServerBrowser.find("2:1", "2"))?.host).toBe("s2.moomodding.io");
        expect(await ServerBrowser.find("7:1", "7")).toBeNull();

        stubFetch({ list: "broken" });
        ({ ServerBrowser } = await load("moomodding"));
        expect(await ServerBrowser.find("2:1", "2")).toBeUndefined();
        expect(await ServerBrowser.getHighest("2")).toBeUndefined();
    });

    it("remembers the last server per site and ignores the old saved format", async () => {
        const { ServerBrowser } = await load("moomodding");
        expect(ServerBrowser.getRecent()).toBeNull();

        ServerBrowser.saveRecent({ key: "2:1", region: "2", name: "1", label: "Miami 1", playerCount: 0, capacity: 30, host: "s2.moomodding.io" });
        expect(ServerBrowser.getRecent()).toEqual({ key: "2:1", region: "2" });

        const other = await load("moomoo-sandbox");
        expect(other.ServerBrowser.getRecent()).toBeNull();

        localStorage.setItem("falcon-recent-server", "abc:eu:0");
        expect(other.ServerBrowser.getRecent()).toBeNull();
    });
});

describe("pings in detail", () => {
    /** /ping answers after `delayFor(host, callNumber)` ms, or fails when that is null. */
    function stubPings(delayFor: (host: string, call: number) => number | null) {
        const perHost = new Map<string, number>();
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (!url.endsWith("/ping")) return new Response(JSON.stringify(MOOMODDING_LIST), { status: 200 });
            const host = new URL(url).hostname;
            const call = (perHost.get(host) ?? 0) + 1;
            perHost.set(host, call);
            const delay = delayFor(host, call);
            if (delay === null) throw new TypeError("Failed to fetch");
            await new Promise(resolve => setTimeout(resolve, delay));
            return new Response("", { status: 200 });
        }));
    }

    it("colours a ping green up to 80 ms, yellow up to 150 ms and red above", async () => {
        const delays: Record<string, number> = { "s1.moomodding.io": 5, "s2.moomodding.io": 110, "singaporemoomoddingserver.onrender.com": 220 };
        stubPings(host => delays[host] ?? 0);
        const { ServerBrowser } = await load("moomodding");
        ServerBrowser.start();
        // Busiest first: Miami (s2), Frankfurt (s1), Singapore.
        await vi.waitFor(() => expect(byId("server-ping-2").innerText).toMatch(/^\d+ ms$/), { timeout: 3_000 });

        expect(byId("server-ping-1").style.color).toBe("rgb(123, 216, 143)");
        expect(byId("server-ping-0").style.color).toBe("rgb(230, 200, 110)");
        expect(byId("server-ping-2").style.color).toBe("rgb(255, 107, 107)");
    });

    it("ignores the first request (DNS/TLS) and uses the faster of the next two, or the one that answered", async () => {
        // First request slow, then one of the two later ones fails: the other one is the ping.
        stubPings((_host, call) => call === 1 ? 300 : call === 2 ? null : 5);
        const { ServerBrowser } = await load("moomodding");
        ServerBrowser.start();
        await vi.waitFor(() => expect(byId("server-ping-0").innerText).toMatch(/^\d+ ms$/), { timeout: 3_000 });
        expect(parseInt(byId("server-ping-0").innerText)).toBeLessThan(80);
    });

    it("gives up on a host that doesn't answer within 3 s", async () => {
        const realSetTimeout = globalThis.setTimeout;
        // Fire the 3 s ping timeout at once instead of waiting for it.
        vi.spyOn(globalThis, "setTimeout").mockImplementation(((cb: () => void, ms?: number) =>
            realSetTimeout(cb, ms === 3_000 ? 0 : ms)) as typeof setTimeout);
        vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            if (!String(input).endsWith("/ping")) return Promise.resolve(new Response(JSON.stringify(MOOMODDING_LIST), { status: 200 }));
            // A host that never answers: only the abort ends the request.
            return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
        }));
        const { ServerBrowser } = await load("moomodding");
        ServerBrowser.start();
        await vi.waitFor(() => expect(byId("server-ping-0").innerText).toBe("? ms"));
    });

    it("doesn't let pings from a list that was refreshed away overwrite the new list's", async () => {
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            if (!String(input).endsWith("/ping")) return new Response(JSON.stringify(MOOMODDING_LIST), { status: 200 });
            await gate;
            return new Response("", { status: 200 });
        }));
        const { ServerBrowser } = await load("moomodding");
        ServerBrowser.start();
        await vi.waitFor(() => expect(options()).toHaveLength(3));

        stubFetch({ list: MOOMODDING_LIST, pingFails: true });
        byId("refresh-server-browser-btn").click();
        await vi.waitFor(() => expect(byId("server-ping-0").innerText).toBe("? ms"));

        release(); // the old list's pings answer now
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(byId("server-ping-0").innerText).toBe("? ms");
    });
});
