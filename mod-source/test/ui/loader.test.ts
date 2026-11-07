// A4: the page loader (ui/Loader.ts): what Loader.main builds (hotbar, skin picker) and what each main-menu
// button does (singleplayer, multiplayer, the two quick-connect buttons, packet replayer, Discord).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gamePage = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", "index.html"), "utf8");

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const SERVER = { key: "2:1", region: "2", name: "1", label: "Miami 1", playerCount: 4, capacity: 30, host: "s2.moomodding.io" };

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame"] });
    vi.spyOn(console, "info").mockImplementation(() => { });
    vi.spyOn(console, "warn").mockImplementation(() => { });
});

afterEach(() => {
    vi.useRealTimers();
});

/** Loads a fresh copy of the mod and runs Loader.main. `before` runs after loading, before main (e.g. saved settings). */
async function startLoader(before?: (mods: { ServerBrowser: typeof import("@ui/ServerBrowser").default }) => void) {
    vi.resetModules();
    // A fresh page: buttons hidden by an earlier test would otherwise stay hidden.
    document.documentElement.innerHTML = gamePage;
    localStorage.setItem("falcon-host-mode", "moomodding");
    await import("@core/socket/SocketListener");
    const { default: Loader } = await import("@ui/Loader");
    const { default: Client } = await import("@core/Client");
    const { default: ServerBrowser } = await import("@ui/ServerBrowser");
    const { default: items } = await import("@constants/items");
    const { default: RenderingConfig } = await import("@rendering/RenderingConfig");
    before?.({ ServerBrowser });

    const connect = vi.spyOn(Client, "connect").mockResolvedValue(undefined);
    await Loader.main();
    return { Loader, Client, ServerBrowser, items, RenderingConfig, connect };
}

/** Lets the async click handlers (await ServerBrowser.find / getHighest) finish. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe("Loader.main", () => {
    it("builds one hotbar slot per weapon and item, with counters on the buildable items", async () => {
        const { items } = await startLoader();

        const slots = byId("action-bar").querySelectorAll(".action-bar-item");
        expect(slots).toHaveLength(items.weapons.length + items.list.length);
        for (let id = 19; id <= 38; id++) {
            expect(byId(`item-count-${id}`).innerText).toBe("0");
        }
        expect(byId("item-count-18")).toBeNull();
    });

    it("shows one swatch per skin colour with the saved skin selected, and saves a new pick", async () => {
        localStorage.setItem("moo_skin", "3");
        const { Loader, RenderingConfig } = await startLoader();

        const swatches = () => [...byId("skin-selector").querySelectorAll<HTMLElement>(".skin-item")];
        expect(swatches()).toHaveLength(RenderingConfig.skinColors.length);
        expect(swatches().findIndex(s => s.classList.contains("active"))).toBe(3);

        swatches()[1].click();

        expect(Loader.skinColor).toBe(1);
        expect(localStorage.getItem("moo_skin")).toBe("1");
        expect(swatches().findIndex(s => s.classList.contains("active"))).toBe(1);
    });

    it("ignores a saved skin that isn't a number", async () => {
        localStorage.setItem("moo_skin", "pink");
        const { Loader } = await startLoader();
        expect(Loader.skinColor).toBe(0);
    });
});

describe("main menu buttons", () => {
    it("hides the quick-connect buttons until a server was joined on this site", async () => {
        await startLoader();
        expect(byId("recent-multiplayer-btn").style.display).toBe("none");
        expect(byId("largest-recent-multiplayer-btn").style.display).toBe("none");
    });

    it("shows them when a recent server is saved", async () => {
        localStorage.setItem("falcon-recent-server", JSON.stringify({ mode: "moomodding", key: "2:1", region: "2" }));
        await startLoader();
        expect(byId("recent-multiplayer-btn").style.display).not.toBe("none");
        expect(byId("largest-recent-multiplayer-btn").style.display).not.toBe("none");
    });

    it("Singleplayer connects straight away with the loading screen up", async () => {
        const { connect } = await startLoader();
        byId("singleplayer-btn").click();

        expect(connect).toHaveBeenCalledWith();
        expect(byId("loading-page").style.display).toBe("flex");
    });

    it("Multiplayer opens the server browser", async () => {
        const { ServerBrowser } = await startLoader();
        const start = vi.spyOn(ServerBrowser, "start").mockResolvedValue(undefined);

        byId("multiplayer-btn").click();
        expect(start).toHaveBeenCalledTimes(1);
    });

    describe("the recent-server button", () => {
        beforeEach(() => {
            localStorage.setItem("falcon-recent-server", JSON.stringify({ mode: "moomodding", key: "2:1", region: "2" }));
        });

        it("joins the saved server when it still exists", async () => {
            const { ServerBrowser, connect } = await startLoader();
            const find = vi.spyOn(ServerBrowser, "find").mockResolvedValue(SERVER);

            byId("recent-multiplayer-btn").click();
            await settle();

            expect(find).toHaveBeenCalledWith("2:1", "2");
            expect(connect).toHaveBeenCalledWith(SERVER);
        });

        it("hides itself when the server is gone", async () => {
            const { ServerBrowser, connect } = await startLoader();
            vi.spyOn(ServerBrowser, "find").mockResolvedValue(null);

            byId("recent-multiplayer-btn").click();
            await settle();

            expect(connect).not.toHaveBeenCalled();
            expect(byId("recent-multiplayer-btn").style.display).toBe("none");
            expect(byId("loading-page").style.display).toBe("none");
        });

        it("stays when the list couldn't be fetched, so you can try again", async () => {
            const { ServerBrowser, connect } = await startLoader();
            vi.spyOn(ServerBrowser, "find").mockResolvedValue(undefined);

            byId("recent-multiplayer-btn").click();
            await settle();

            expect(connect).not.toHaveBeenCalled();
            expect(byId("recent-multiplayer-btn").style.display).not.toBe("none");
            expect(byId("loading-page").style.display).toBe("none");
        });
    });

    describe("the busiest-server button", () => {
        beforeEach(() => {
            localStorage.setItem("falcon-recent-server", JSON.stringify({ mode: "moomodding", key: "1:1", region: "2" }));
        });

        it("joins the busiest server in the saved region", async () => {
            const { ServerBrowser, connect } = await startLoader();
            const highest = vi.spyOn(ServerBrowser, "getHighest").mockResolvedValue(SERVER);

            byId("largest-recent-multiplayer-btn").click();
            await settle();

            expect(highest).toHaveBeenCalledWith("2");
            expect(ServerBrowser.selectedOption).toBe(SERVER);
            expect(connect).toHaveBeenCalledWith(SERVER);
        });

        it("hides itself when the saved region has no server left", async () => {
            const { ServerBrowser, connect } = await startLoader();
            vi.spyOn(ServerBrowser, "getHighest").mockResolvedValue(null);

            byId("largest-recent-multiplayer-btn").click();
            await settle();

            expect(connect).not.toHaveBeenCalled();
            expect(byId("loading-page").style.display).toBe("none");
            expect(byId("largest-recent-multiplayer-btn").style.display).toBe("none");
        });

        it("stays when the list couldn't be fetched, so you can try again", async () => {
            const { ServerBrowser, connect } = await startLoader();
            vi.spyOn(ServerBrowser, "getHighest").mockResolvedValue(undefined);

            byId("largest-recent-multiplayer-btn").click();
            await settle();

            expect(connect).not.toHaveBeenCalled();
            expect(byId("loading-page").style.display).toBe("none");
            expect(byId("largest-recent-multiplayer-btn").style.display).not.toBe("none");
        });
    });

    it("Packet Replayer opens its page and Cancel goes back", async () => {
        await startLoader();

        byId("packet-replayer-btn").click();
        expect(byId("packet-replayer-options-page").style.display).toBe("flex");
        expect(byId("main-menu").style.display).toBe("none");

        byId("packet-replayer-cancel-btn").click();
        expect(byId("packet-replayer-options-page").style.display).toBe("none");
        expect(byId("main-menu").style.display).toBe("flex");
    });

    it("the replay file button opens the file picker", async () => {
        await startLoader();
        const pick = vi.spyOn(byId<HTMLInputElement>("packet-replayer-file-input"), "click").mockImplementation(() => { });
        byId("packet-replayer-file-btn").click();
        expect(pick).toHaveBeenCalledTimes(1);
    });

    it("closing the file picker without a file drops the loading screen", async () => {
        await startLoader();
        const input = byId<HTMLInputElement>("packet-replayer-file-input");
        Object.defineProperty(input, "files", { configurable: true, value: [] });

        input.onchange!(new Event("change"));
        expect(byId("loading-page").style.display).toBe("none");
    });

    it("says so when the chosen file isn't a packet log", async () => {
        await startLoader();
        const alert = vi.spyOn(window, "alert").mockImplementation(() => { });
        const input = byId<HTMLInputElement>("packet-replayer-file-input");
        Object.defineProperty(input, "files", { configurable: true, value: [new File([new Uint8Array([1, 2, 3])], "x.fpl")] });

        input.onchange!(new Event("change"));
        await vi.waitFor(() => expect(alert).toHaveBeenCalledTimes(1), { interval: 5 });

        expect(alert.mock.calls[0][0]).toMatch(/isn't a Falcon packet log/);
        expect(byId("loading-page").style.display).toBe("none");
    });

    it("Open Logs Folder says where the logs are instead of a loading screen that never ends", async () => {
        await startLoader();
        const alert = vi.spyOn(window, "alert").mockImplementation(() => { });
        byId("open-logs-folder-btn").click();

        expect(byId("loading-page").style.display).not.toBe("flex");
        expect(alert).toHaveBeenCalledTimes(1);
        expect(alert.mock.calls[0][0]).toMatch(/Downloads folder/);
    });

    it("Clear All Logs clears the in-memory packet log and says where saved logs are", async () => {
        await startLoader();
        const { default: PacketRecorder } = await import("@services/packet-recorder/PacketRecorder");
        const clear = vi.spyOn(PacketRecorder, "clearSession");
        const alert = vi.spyOn(window, "alert").mockImplementation(() => { });
        byId("clear-all-logs-btn").click();

        expect(byId("loading-page").style.display).not.toBe("flex");
        expect(clear).toHaveBeenCalledTimes(1);
        expect(alert.mock.calls[0][0]).toMatch(/Cleared the packet log/);
    });

    it("Discord opens the invite in a new tab", async () => {
        await startLoader();
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        byId("open-discord-btn").click();
        expect(open).toHaveBeenCalledWith("https://discord.gg/4KUJm7jNys", "_blank");
    });
});
