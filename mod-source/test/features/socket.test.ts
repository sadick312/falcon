// Feature #49, Socket (Socket, CustomEncoder, FakeSocket, PacketManager): decodes server messages (msgpack, optional
// cipher), converts 1.8.2 layouts, batches them per tick, and sends ours (hand-encoded for the common packets, signed
// when the server asks for it). Encoding, the cipher and the outgoing filter are covered in test/socket/; this covers
// the local-server rule and malformed packets.
import { encode } from "@msgpack/msgpack";
import { afterEach, describe, expect, it, vi } from "vitest";

const original = globalThis.WebSocket;

class FakeNativeWebSocket {
    static readonly OPEN = 1;
    readyState = 0;
    binaryType = "blob";
    onmessage: ((ev: { data: ArrayBuffer }) => void) | null = null;
    constructor(public url: string) { }
    send() { }
    close() { }
}

afterEach(() => {
    globalThis.WebSocket = original;
    vi.resetModules();
});

async function socketFor(url: string) {
    globalThis.WebSocket = FakeNativeWebSocket as unknown as typeof WebSocket;
    vi.resetModules();
    await import("@core/socket/SocketListener");
    const { default: Socket } = await import("@core/socket/Socket");
    return new Socket(url, null);
}

describe("Socket", () => {
    it("treats only a server on this machine as private (plain packets, no limits)", async () => {
        expect((await socketFor("ws://localhost:1234/?token=x")).isPrivateServer).toBe(true);
        expect((await socketFor("ws://127.0.0.1:8080/")).isPrivateServer).toBe(true);
        // Used to be true for any URL containing "localhost".
        expect((await socketFor("wss://localhost.example.com/?token=x")).isPrivateServer).toBe(false);
        expect((await socketFor("wss://s1.moomodding.io/?token=x")).isPrivateServer).toBe(false);
    });

    it("drops a gather-animation packet without data instead of throwing", async () => {
        const socket = await socketFor("wss://s1.moomodding.io/?token=x");
        const bytes = encode(["K"]);
        const message = { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
        expect(() => (socket as unknown as FakeNativeWebSocket).onmessage!(message)).not.toThrow();
    });
});
