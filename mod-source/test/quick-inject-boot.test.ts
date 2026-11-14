// Boot check of the built Quick Inject file (dist/falcon-quick-inject.js): run it in a fake page, offline, and check
// that it starts (no error, initFalconClient ran, Falcon's menu is on the page). Catches a bundle that only fails when
// it loads, such as an import cycle. Skipped until `npm run inject:build` has made the file.
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it, vi } from "vitest";

const injectFile = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/falcon-quick-inject.js");

describe("Quick Inject build", () => {
    it.skipIf(!existsSync(injectFile))("starts in a page without errors and shows Falcon's menu", async () => {
        // The bundle runs as an inline <script> in jsdom's own window, which doesn't see Node's globals: give it a
        // MessageChannel (every browser has one) and stub the network there, so nothing leaves the test.
        const page = (globalThis as unknown as { jsdom: { window: Record<string, unknown> } }).jsdom.window;
        const saved = { fetch: page.fetch, WebSocket: page.WebSocket, MessageChannel: page.MessageChannel, CanvasRenderingContext2D: page.CanvasRenderingContext2D };
        page.MessageChannel = MessageChannel;
        // setup.ts's stand-in for jsdom's missing canvas context class.
        page.CanvasRenderingContext2D = (globalThis as Record<string, unknown>).CanvasRenderingContext2D;
        page.fetch = () => new Promise(() => { });
        page.WebSocket = class { close() { } send() { } addEventListener() { } };
        // The page has its own console; Falcon's "[Falcon] ... failed" messages go there.
        const errors = vi.spyOn(page.console as Console, "error").mockImplementation(() => { });
        const pageErrors: unknown[] = [];
        const onError = (event: ErrorEvent) => pageErrors.push(event.error ?? event.message);
        window.addEventListener("error", onError);

        try {
            // Like pasting it into the page's console: run in the page's own window.
            (page.eval as (code: string) => void)(readFileSync(injectFile, "utf8"));
            await new Promise(r => setTimeout(r, 50));

            expect(pageErrors).toEqual([]);
            expect(errors.mock.calls.filter(c => String(c[0]).includes("[Falcon]"))).toEqual([]);
            expect(page.__falconLoaded).toBe(true);
            expect(document.getElementById("scriptMenu")).not.toBeNull();
        } finally {
            window.removeEventListener("error", onError);
            Object.assign(page, saved);
            vi.restoreAllMocks();
        }
    });
});
