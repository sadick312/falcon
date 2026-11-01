// Feature #48, Connection and client state (Client, CaptchaManager, ProtocolLoader, Endpoints): picks the site profile
// from the page's hostname (sandbox.moomodding.io → 1.8.2 with a fixed token and plain msgpack; sandbox.moomoo.io →
// captcha + join ticket + protocol module), builds the socket URL, and only accepts https overrides on the site's own
// domain. Local dev servers use ws:// and skip the captcha.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

describe("Connection", () => {
    it("treats only this machine as a local dev server", async () => {
        game = await startGame();
        const { default: Endpoints } = await import("@constants/Endpoints");
        expect(Endpoints.isLocalHost("localhost:1234")).toBe(true);
        expect(Endpoints.isLocalHost("127.0.0.1:8080")).toBe(true);
        expect(Endpoints.isLocalHost("localhost")).toBe(true);
        // Used to match anything containing "localhost", skipping TLS and the captcha.
        expect(Endpoints.isLocalHost("localhost.example.com")).toBe(false);
        expect(Endpoints.isLocalHost("s1.moomodding.io")).toBe(false);
    });

    it("uses ws:// only for local servers", async () => {
        game = await startGame();
        const { default: Endpoints } = await import("@constants/Endpoints");
        expect(Endpoints.socketUrl("localhost:1234").startsWith("ws://localhost:1234/?token=")).toBe(true);
        expect(Endpoints.socketUrl("s1.moomodding.io").startsWith("wss://s1.moomodding.io/?token=")).toBe(true);
        expect(Endpoints.socketUrl("localhost.example.com").startsWith("wss://")).toBe(true);
    });
});
