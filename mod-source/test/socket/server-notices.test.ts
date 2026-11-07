// Server packets that only show something to the player: the restart countdown ("Z" in v1.8.2).
import { beforeEach, describe, expect, it, vi } from "vitest";

type Handlers = Record<string, (...args: unknown[]) => void>;

let handlers: Handlers;
let Client: typeof import("@core/Client").default;

// Loads the menu and client afresh for each test, which can pass the 10 s default hook limit when the whole suite runs at once.
beforeEach(async () => {
    vi.resetModules();
    document.getElementById("falcon-restart-notice")?.remove();
    vi.spyOn(console, "log").mockImplementation(() => { });

    await import("@core/socket/SocketListener");
    const { default: Menu } = await import("@menu/Menu");
    await Menu.init();
    Client = (await import("@core/Client")).default;
    Client.mode = "replay";
    await import("@core/Connection");
    await Client.connect();
    handlers = (Client.socket as unknown as { handlers: Handlers }).handlers;
}, 30_000);

describe("server restart countdown (Z)", () => {
    it("shows the time left as m:ss and updates it", () => {
        handlers.Z(125);
        const banner = document.getElementById("falcon-restart-notice")!;
        expect(banner.innerText).toBe("Server restarting in 2:05");

        handlers.Z(9);
        expect(banner.innerText).toBe("Server restarting in 0:09");
    });

    it("ignores negative or missing values, like the game", () => {
        handlers.Z(-1);
        handlers.Z(undefined);
        expect(document.getElementById("falcon-restart-notice")).toBeNull();
    });

    it("no longer adds a placement marker", () => {
        const before = Client.markers.length;
        handlers.Z(30);
        expect(Client.markers.length).toBe(before);
    });
});
