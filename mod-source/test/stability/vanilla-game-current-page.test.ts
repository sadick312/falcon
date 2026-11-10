// The site's current page (/assets/bundle.js, checked 10 Nov 2026) has no hackfix.js, so the vanilla game's socket
// is in no global slot. The guard closes it the first time it sends a game packet (its ping comes every 2.5 s).
// Own file: it replaces WebSocket.prototype.send with a stand-in for the browser's native send.
import { encode } from "@msgpack/msgpack";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const realSend = WebSocket.prototype.send;
/** Stands in for the browser's send, so the test sockets can be plain objects. */
const nativeSend = vi.fn();

beforeAll(() => {
    WebSocket.prototype.send = nativeSend as unknown as WebSocket["send"];
});

afterAll(() => {
    WebSocket.prototype.send = realSend;
});

function fakeSocket(readyState = 1) {
    return { readyState, close: vi.fn(function (this: { readyState: number }) { this.readyState = 2; }) };
}

/** What the vanilla client sends: msgpack-lite `[type, data]` (`io.send("ping")` → ["0", []]). */
const packet = (type: string, ...data: unknown[]) => encode([type, data]);

async function guarded(isOwnSocket?: (socket: unknown) => boolean) {
    vi.resetModules();
    vi.spyOn(console, "info").mockImplementation(() => { });
    const guard = await import("@core/utils/VanillaGameGuard");
    const result = guard.stopVanillaGame({ isOwnSocket });
    const send = (socket: object, data: unknown) => WebSocket.prototype.send.call(socket as WebSocket, data as ArrayBuffer);
    return { ...guard, result, send };
}

describe("the vanilla socket on the current page", () => {
    it("closes it on its first game packet and drops that packet", async () => {
        const vanilla = fakeSocket();
        const { result, send } = await guarded();
        nativeSend.mockClear();

        send(vanilla, packet("0"));

        expect(vanilla.close).toHaveBeenCalledWith(1000, expect.any(String));
        expect(nativeSend).not.toHaveBeenCalled();
        expect(result.closedSockets).toBe(1);

        // Anything else it tries afterwards is dropped too, without closing it again.
        send(vanilla, packet("9", 1.5));
        expect(vanilla.close).toHaveBeenCalledTimes(1);
        expect(nativeSend).not.toHaveBeenCalled();
    });

    it("lets Falcon's own socket send game packets", async () => {
        const own = fakeSocket();
        const { send } = await guarded(socket => socket === own);
        nativeSend.mockClear();

        send(own, packet("F", 1, 0.5));
        send(own, packet("0"));

        expect(own.close).not.toHaveBeenCalled();
        expect(nativeSend).toHaveBeenCalledTimes(2);
    });

    it("leaves other sockets on the page alone (no game packets)", async () => {
        const other = fakeSocket();
        const { send } = await guarded();
        nativeSend.mockClear();

        send(other, "hello");
        send(other, encode({ type: "chat", text: "hi" }));
        send(other, encode(["ping", []])); // a 4-letter type: not a game packet

        expect(other.close).not.toHaveBeenCalled();
        expect(nativeSend).toHaveBeenCalledTimes(3);
    });

    it("wraps send only once, and uses the newest guard's idea of Falcon's socket", async () => {
        const first = fakeSocket();
        const second = fakeSocket();
        await guarded(socket => socket === first);
        const wrapped = WebSocket.prototype.send;
        const { send } = await guarded(socket => socket === second);
        nativeSend.mockClear();

        expect(WebSocket.prototype.send).toBe(wrapped);
        send(second, packet("0"));
        send(first, packet("0"));

        expect(second.close).not.toHaveBeenCalled();
        expect(first.close).toHaveBeenCalledTimes(1);
        expect(nativeSend).toHaveBeenCalledTimes(1);
    });
});

describe("isGamePacket", () => {
    it("recognises [letter, data] for every packet the game sends, as ArrayBuffer or typed array", async () => {
        const { isGamePacket } = await guarded();
        const { GAME_V182 } = await import("@constants/gameVersion");
        for (const type of GAME_V182.clientToServer) {
            const bytes = packet(type);
            expect(isGamePacket(bytes)).toBe(true);
            expect(isGamePacket(bytes.slice().buffer)).toBe(true);
        }
    });

    it("rejects strings, short buffers, other shapes and unknown letters", async () => {
        const { isGamePacket } = await guarded();
        expect(isGamePacket("0")).toBe(false);
        expect(isGamePacket(new Uint8Array([0x92, 0xa1]))).toBe(false);
        expect(isGamePacket(encode(["0"]))).toBe(false);
        expect(isGamePacket(encode(["0", [], 1]))).toBe(false);
        expect(isGamePacket(encode(["W", []]))).toBe(false); // a 1.9.0-only letter the 1.8.2 game never sends
        expect(isGamePacket(new Blob(["x"]))).toBe(false);
    });
});
