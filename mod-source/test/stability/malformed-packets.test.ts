// A malformed packet may fail on its own (Socket.dispatch catches and logs it), but must not leave state
// behind that breaks the packets after it.
import { describe, expect, it, vi } from "vitest";

type Handlers = Record<string, (...args: unknown[]) => void>;

/** Fresh client in replay mode with us (sid 1) and one enemy (sid 2) spawned. */
async function spawnedClient(): Promise<Handlers> {
    vi.resetModules();
    vi.spyOn(console, "log").mockImplementation(() => { });

    await import("@core/socket/SocketListener");
    const { default: items } = await import("@constants/items");
    const actionBar = document.getElementById("action-bar")!;
    actionBar.innerHTML = "";
    for (let i = 0; i < items.weapons.length + items.list.length; i++) {
        const item = document.createElement("div");
        item.id = `action-bar-item-${i}`;
        if (i >= 19 && i <= 38) {
            const count = document.createElement("div");
            count.id = `item-count-${i}`;
            item.appendChild(count);
        }
        actionBar.appendChild(item);
    }

    const { default: Menu } = await import("@menu/Menu");
    await Menu.init();
    const { default: Client } = await import("@core/Client");
    Client.mode = "replay";
    await Client.connect();

    const handlers = (Client.socket as unknown as { handlers: Handlers }).handlers;
    handlers.C(1);
    handlers.D(["me", 1, "me", 100, 100, 0, 100, 100, 35, 0], true);
    handlers.D(["enemy", 2, "enemy", 200, 100, 0, 100, 100, 35, 0], false);
    return handlers;
}

const tick = (handlers: Handlers) => handlers.a(
    [1, 100, 100, 0, 2, 200, 100, 0],
    [1, -1, 5, 0, null, 0, 0, 0, 0, 0, 2, -1, 5, 0, null, 0, 7, 0, 0, 0],
    []
);

describe("malformed packets", () => {
    it.each([
        ["no data", []],
        ["a number", [999]],
        ["a string", ["x"]]
    ])("SET_ALLIANCE_PLAYERS with %s doesn't break later ticks", async (_label, args) => {
        const handlers = await spawnedClient();
        tick(handlers);

        handlers["4"](...args);

        expect(() => { tick(handlers); tick(handlers); }).not.toThrow();
    });
});

describe("death and respawn", () => {
    it("runs nothing while dead, then works again after respawning", async () => {
        const handlers = await spawnedClient();
        const { default: Client } = await import("@core/Client");
        const { default: ModManager } = await import("@core/ModManager");
        tick(handlers);
        expect(Client.isAlive).toBe(true);

        handlers.P();
        expect(Client.isAlive).toBe(false);

        // A tick that arrives after our death (e.g. in the same batch) must not run the mod brain.
        const brainBefore = ModManager.brainState;
        expect(() => tick(handlers)).not.toThrow();
        expect(ModManager.brainState).toBe(brainBefore);

        handlers.D(["me", 1, "me", 300, 300, 0, 100, 100, 35, 0], true);
        expect(Client.isAlive).toBe(true);
        expect(() => { tick(handlers); tick(handlers); }).not.toThrow();
        expect(ModManager.brainState).not.toBe(brainBefore);
    });
});

describe("packets before we spawn", () => {
    it("handles world packets that arrive before our ADD_PLAYER", async () => {
        vi.resetModules();
        vi.spyOn(console, "log").mockImplementation(() => { });
        await import("@core/socket/SocketListener");
        const { default: Menu } = await import("@menu/Menu");
        await Menu.init();
        const { default: Client } = await import("@core/Client");
        Client.mode = "replay";
        await Client.connect();
        const handlers = (Client.socket as unknown as { handlers: Handlers }).handlers;

        handlers.C(1);
        expect(() => {
            handlers.D(["enemy", 2, "enemy", 200, 100, 0, 100, 100, 35, 0], false);
            handlers.a([2, 200, 100, 0], [2, -1, 5, 0, null, 0, 0, 0, 0, 0], []);
            handlers.O(2, 80);
            handlers.K(2, 0, 0);
            handlers.X(200, 100, 0, 500, 1.6, 0, 1, 5);
            handlers["8"](200, 100, 20, 0);
            handlers.Q(12345);
        }).not.toThrow();
    });
});
