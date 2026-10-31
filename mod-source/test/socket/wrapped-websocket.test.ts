// sandbox.moomodding.io's hackfix.js swaps window.WebSocket for a function that returns a native socket.
// Socket must still construct as a Socket, with its own methods, when loaded under that wrapper.
import { afterEach, describe, expect, it, vi } from "vitest";

const original = globalThis.WebSocket;

class FakeNativeWebSocket {
    static readonly OPEN = 1;
    readyState = 0;
    binaryType = "blob";
    constructor(public url: string) { }
    send() { }
    close() { }
}

/** Same shape as hackfix.js's MooWebSocket: returns a different object and shares the native prototype. */
function SiteWrapper(url: string) {
    return new FakeNativeWebSocket(`${url}#redirected`);
}
SiteWrapper.prototype = FakeNativeWebSocket.prototype;
SiteWrapper.OPEN = 1;

afterEach(() => {
    globalThis.WebSocket = original;
    vi.resetModules();
});

describe("Socket under moomodding.io's WebSocket wrapper", () => {
    it("extends the native class, not the wrapper", async () => {
        globalThis.WebSocket = SiteWrapper as unknown as typeof WebSocket;
        vi.resetModules();
        // Load order as in the bundle: the listener first, so Socket's import cycle resolves.
        await import("@core/socket/SocketListener");
        const { default: Socket } = await import("@core/socket/Socket");

        const socket = new Socket("ws://localhost:1234/", null);

        expect(socket).toBeInstanceOf(Socket);
        expect(typeof socket.on).toBe("function");
        expect(typeof socket.sendMsg).toBe("function");
        expect(socket.url).toBe("ws://localhost:1234/");
    });
});
