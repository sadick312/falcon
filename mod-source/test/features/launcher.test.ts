// Features #77 Background worker (falcon-launcher/src/background.ts, manifest.json), #78 Page loader
// (gameLoader.ts, shared with Quick Inject) and #79 Content script (remove.js). The worker injects Falcon only into
// the two game pages' main frame, pinned to that page load; the content script removes the game's own scripts
// (but not Cloudflare Turnstile).
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareGamePage, startFalconClient } from "../../../falcon-launcher/src/gameLoader";

afterEach(() => {
    vi.restoreAllMocks();
    delete (window as { initFalconClient?: unknown }).initFalconClient;
});

describe("Page loader", () => {
    it("replaces the page, keeps the old HTML and adds the style (no Turnstile on moomodding.io)", async () => {
        document.body.innerHTML = "<p id='old'>game</p>";
        await prepareGamePage("<body><div id='falcon'></div></body>", "#falcon{color:red}", false);
        expect(document.getElementById("falcon")).not.toBeNull();
        expect(document.getElementById("old")).toBeNull();
        expect(window.oldHTML).toContain("game");
        expect([...document.querySelectorAll("style")].some(s => s.textContent?.includes("#falcon"))).toBe(true);
    });

    it("starts the client once, and reports a missing or failing bundle", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => { });
        const init = vi.fn();
        window.initFalconClient = init;
        startFalconClient();
        startFalconClient();
        expect(init).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalledWith("[Falcon] The bundle did not define initFalconClient.");

        window.initFalconClient = () => { throw new Error("boom"); };
        expect(() => startFalconClient()).not.toThrow();
    });
});

describe("Manifest", () => {
    it("only runs on the game sites, and the worker uses the same list", async () => {
        const fs = await import("fs");
        const path = await import("path");
        const root = path.join(import.meta.dirname, "../../../falcon-launcher");
        const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
        const sites = ["https://moomoo.io/*", "https://www.moomoo.io/*", "https://sandbox.moomoo.io/*", "https://sandbox.moomodding.io/*"];
        expect(manifest.host_permissions).toEqual(sites);
        expect(manifest.content_scripts[0].matches).toEqual(sites);
        const worker = fs.readFileSync(path.join(root, "src/background.ts"), "utf8");
        expect(worker).toContain(`["moomoo.io", "www.moomoo.io", "sandbox.moomoo.io", "sandbox.moomodding.io"]`);
    });
});

describe("Content script", () => {
    it("removes the game's scripts but keeps Cloudflare Turnstile (P29)", async () => {
        // @ts-expect-error remove.js is a plain JavaScript content script with no type declarations.
        await import("../../../falcon-launcher/src/remove.js");
        const add = (src: string) => {
            const script = document.createElement("script");
            script.src = src;
            document.head.appendChild(script);
            return script;
        };

        const game = add("https://sandbox.moomodding.io/1.8.2/assets/index-8f264913.js");
        const turnstile = add("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
        // MutationObserver callbacks run as a microtask after the change.
        await Promise.resolve();

        expect(game.isConnected).toBe(false);
        expect(turnstile.isConnected).toBe(true);
        turnstile.remove();
    });
});
