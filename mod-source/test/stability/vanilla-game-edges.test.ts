// A1, edge cases of the vanilla-game guard: a socket whose close() throws, slots someone locked with a
// non-configurable property, and the rest of the DevTools shortcuts. In their own file because the locked
// properties can't be removed from this file's window again.
import { describe, expect, it, vi } from "vitest";

function fakeSocket(readyState = 1) {
    return { readyState, close: vi.fn() };
}

async function loadGuard() {
    vi.resetModules();
    return import("@core/utils/VanillaGameGuard");
}

const win = window as unknown as Record<string, unknown>;

describe("stopVanillaGame, edge cases", () => {
    it("keeps going when the game's socket throws on close, and still guards the slots", async () => {
        const broken = { readyState: 1, close: vi.fn(() => { throw new Error("already closing"); }) };
        win.activeMooSocket = broken;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => { });

        const { stopVanillaGame } = await loadGuard();
        const result = stopVanillaGame();

        expect(result.closedSockets).toBe(0);
        expect(warn).toHaveBeenCalledTimes(1);
        const late = fakeSocket(0);
        win.ws = late;
        expect(late.close).toHaveBeenCalledTimes(1);

        delete win.activeMooSocket;
        delete win.ws;
        delete (document as unknown as Record<string, unknown>).ws;
        delete win.requestAnimFrame;
        warn.mockRestore();
    });

    it("lets Ctrl+Shift+J, Ctrl+Shift+C and Ctrl+U through, but not lookalikes such as Ctrl+Shift+U", async () => {
        const gameBlocker = vi.fn((e: KeyboardEvent) => e.preventDefault());
        window.addEventListener("keydown", gameBlocker);
        const { stopVanillaGame } = await loadGuard();
        stopVanillaGame();

        const press = (keyCode: number, ctrlKey: boolean, shiftKey: boolean) => {
            const event = new KeyboardEvent("keydown", { keyCode, ctrlKey, shiftKey, bubbles: true, cancelable: true });
            document.body.dispatchEvent(event);
            return event;
        };
        const jsConsole = press(74, true, true);
        const pick = press(67, true, true);
        const source = press(85, true, false);
        const lookalike = press(85, true, true);
        const copy = press(67, true, false);

        expect([jsConsole, pick, source].map(e => e.defaultPrevented)).toEqual([false, false, false]);
        expect(gameBlocker.mock.calls.map(([e]) => e)).toEqual([lookalike, copy]);
        window.removeEventListener("keydown", gameBlocker);
        delete win.requestAnimFrame;
    });

    it("still closes the socket in a slot someone locked, and stops a loop scheduler it can't redefine", async () => {
        const locked = fakeSocket();
        Object.defineProperty(window, "activeMooSocket", { value: locked, configurable: false, writable: false });
        const scheduled: (() => void)[] = [];
        // Writable but not configurable: the guard falls back to assigning its no-op scheduler.
        Object.defineProperty(window, "requestAnimFrame", {
            value: (cb: () => void) => scheduled.push(cb), configurable: false, writable: true, enumerable: true
        });

        const { stopVanillaGame } = await loadGuard();
        const result = stopVanillaGame();

        expect(locked.close).toHaveBeenCalledTimes(1);
        expect(result.closedSockets).toBe(1);
        expect(result.stoppedDrawLoop).toBe(true);
        (win.requestAnimFrame as (cb: () => void) => void)(() => { });
        expect(scheduled).toHaveLength(0);
    });
});
