// A1: the vanilla 1.8.2 game must not keep its own connection or draw loop running underneath Falcon.
// The fakes follow what the real files do: hackfix.js stores each socket it creates in window.activeMooSocket,
// window.ws and document.ws, and the game's loop calls the global requestAnimFrame on every frame.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const slots: [object, string][] = [[window, "activeMooSocket"], [window, "ws"], [document, "ws"], [window, "requestAnimFrame"]];

function fakeSocket(readyState = 1) {
    return { readyState, close: vi.fn() };
}

async function loadGuard() {
    vi.resetModules();
    return import("@core/utils/VanillaGameGuard");
}

/** The game's draw loop, as in index-8f264913.js: `function as() { draw(); requestAnimFrame(as) }`. */
function startVanillaLoop() {
    const scheduled: (() => void)[] = [];
    (window as unknown as Record<string, unknown>).requestAnimFrame = (cb: () => void) => scheduled.push(cb);
    let frames = 0;
    const loop = () => {
        frames++;
        (window as unknown as { requestAnimFrame: (cb: () => void) => void }).requestAnimFrame(loop);
    };
    loop();
    const runFrame = () => scheduled.splice(0).forEach(cb => cb());
    return { runFrame, get frames() { return frames; } };
}

afterEach(() => {
    for (const [target, key] of slots) delete (target as Record<string, unknown>)[key];
});

describe("stopVanillaGame", () => {
    it("closes the game's socket wherever hackfix.js stored it", async () => {
        const vanilla = fakeSocket();
        const win = window as unknown as Record<string, unknown>;
        win.activeMooSocket = vanilla;
        win.ws = vanilla;
        (document as unknown as Record<string, unknown>).ws = vanilla;

        const { stopVanillaGame } = await loadGuard();
        const result = stopVanillaGame();

        expect(vanilla.close).toHaveBeenCalledTimes(1);
        expect(vanilla.close).toHaveBeenCalledWith(1000, expect.any(String));
        expect(result.closedSockets).toBe(1);
    });

    it("also closes a socket that is still connecting", async () => {
        const connecting = fakeSocket(0);
        (window as unknown as Record<string, unknown>).activeMooSocket = connecting;

        const { stopVanillaGame } = await loadGuard();
        stopVanillaGame();

        expect(connecting.close).toHaveBeenCalledTimes(1);
    });

    it("closes a socket the game opens after Falcon started", async () => {
        const { stopVanillaGame } = await loadGuard();
        stopVanillaGame();

        // hackfix.js's MooWebSocket wrapper doing `window.activeMooSocket = realSocket; document.ws = ...; window.ws = ...`
        const late = fakeSocket(0);
        const win = window as unknown as Record<string, unknown>;
        win.activeMooSocket = late;
        (document as unknown as Record<string, unknown>).ws = late;
        win.ws = late;

        expect(late.close).toHaveBeenCalledTimes(1);
        expect(win.activeMooSocket).toBe(late);
    });

    it("leaves Falcon's own socket and already closed sockets alone", async () => {
        const own = fakeSocket();
        const closedOne = fakeSocket(3);
        const win = window as unknown as Record<string, unknown>;
        win.activeMooSocket = own;
        win.ws = closedOne;

        const { stopVanillaGame } = await loadGuard();
        const result = stopVanillaGame({ isOwnSocket: socket => socket === own });

        expect(own.close).not.toHaveBeenCalled();
        expect(closedOne.close).not.toHaveBeenCalled();
        expect(result.closedSockets).toBe(0);
    });

    it("ignores values that aren't sockets", async () => {
        const win = window as unknown as Record<string, unknown>;
        win.ws = "not a socket";

        const { stopVanillaGame } = await loadGuard();
        expect(() => stopVanillaGame()).not.toThrow();
        win.activeMooSocket = { readyState: 1 };
        expect(win.ws).toBe("not a socket");
    });

    it("ends the game's draw loop after its current frame", async () => {
        const loop = startVanillaLoop();
        loop.runFrame();
        expect(loop.frames).toBe(2);

        const { stopVanillaGame } = await loadGuard();
        const result = stopVanillaGame();
        loop.runFrame(); // the frame scheduled before the guard still runs, but schedules nothing
        loop.runFrame();
        loop.runFrame();

        expect(result.stoppedDrawLoop).toBe(true);
        expect(loop.frames).toBe(3);
    });

    it("keeps the loop stopped if the game assigns requestAnimFrame later", async () => {
        const { stopVanillaGame } = await loadGuard();
        const result = stopVanillaGame();
        expect(result.stoppedDrawLoop).toBe(false);

        const loop = startVanillaLoop(); // the game's module running after Falcon
        loop.runFrame();
        loop.runFrame();

        expect(loop.frames).toBe(1);
    });

    it("doesn't touch window.requestAnimationFrame, which Falcon's renderer uses", async () => {
        const before = window.requestAnimationFrame;
        const { stopVanillaGame } = await loadGuard();
        stopVanillaGame();
        expect(window.requestAnimationFrame).toBe(before);
    });

    it("lets F12 and Ctrl+Shift+I reach the browser instead of the game's blocker", async () => {
        // The game's anti-debug listener (index-8f264913.js `ms()`): cancels these keys on window.
        const gameBlocker = vi.fn((e: KeyboardEvent) => e.preventDefault());
        window.addEventListener("keydown", gameBlocker);
        const { stopVanillaGame } = await loadGuard();
        stopVanillaGame();

        const f12 = new KeyboardEvent("keydown", { keyCode: 123, bubbles: true, cancelable: true });
        document.body.dispatchEvent(f12);
        const inspect = new KeyboardEvent("keydown", { keyCode: 73, ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
        document.body.dispatchEvent(inspect);
        const walk = new KeyboardEvent("keydown", { keyCode: 87, bubbles: true, cancelable: true });
        document.body.dispatchEvent(walk);

        expect(f12.defaultPrevented).toBe(false);
        expect(inspect.defaultPrevented).toBe(false);
        // Ordinary keys still reach every listener.
        expect(gameBlocker).toHaveBeenCalledTimes(1);
        expect(gameBlocker.mock.calls[0][0]).toBe(walk);
        window.removeEventListener("keydown", gameBlocker);
    });

    it("is safe to call twice", async () => {
        const vanilla = fakeSocket();
        (window as unknown as Record<string, unknown>).activeMooSocket = vanilla;
        const { stopVanillaGame } = await loadGuard();

        const first = stopVanillaGame();
        const second = stopVanillaGame();

        expect(second).toBe(first);
        expect(vanilla.close).toHaveBeenCalledTimes(1);
    });
});

describe("Loader.main", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame"] });
        vi.spyOn(console, "info").mockImplementation(() => { });
        vi.spyOn(console, "warn").mockImplementation(() => { });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function startLoader(mode: string) {
        vi.resetModules();
        localStorage.setItem("falcon-host-mode", mode);
        const { default: Loader } = await import("@ui/Loader");
        await Loader.main();
    }

    it("stops the vanilla game before Falcon starts on sandbox.moomodding.io", async () => {
        const vanilla = fakeSocket();
        (window as unknown as Record<string, unknown>).activeMooSocket = vanilla;
        const loop = startVanillaLoop();

        await startLoader("moomodding");
        loop.runFrame();
        loop.runFrame();

        expect(vanilla.close).toHaveBeenCalledTimes(1);
        expect(loop.frames).toBe(2);
    });

    it("leaves pages alone on sandbox.moomoo.io, where the extension removes the game's scripts", async () => {
        const other = fakeSocket();
        (window as unknown as Record<string, unknown>).activeMooSocket = other;

        await startLoader("moomoo-sandbox");

        expect(other.close).not.toHaveBeenCalled();
    });
});
