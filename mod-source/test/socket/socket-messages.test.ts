// Socket (core/socket/Socket.ts) on moomodding.io v1.8.2: what happens to each kind of server message, the handshake,
// the optional cipher, the server's disconnect reason, and the error screens for failed connections.
import { decode, encode } from "@msgpack/msgpack";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const original = globalThis.WebSocket;
const sent: Uint8Array[] = [];
let closed = 0;

class FakeNativeWebSocket {
    static readonly OPEN = 1;
    readyState = 1;
    binaryType = "blob";
    constructor(public url: string) { }
    send(data: Uint8Array) { sent.push(data.slice()); }
    close() { closed++; }
}

beforeEach(() => {
    sent.length = 0;
    closed = 0;
    globalThis.WebSocket = FakeNativeWebSocket as unknown as typeof WebSocket;
    // The test page is on localhost, where this picks the moomodding.io (v1.8.2) profile.
    localStorage.setItem("falcon-host-mode", "moomodding");
    vi.resetModules();
});

afterEach(() => {
    globalThis.WebSocket = original;
    vi.useRealTimers();
    vi.restoreAllMocks();
});

async function connect() {
    // Load order as in the bundle: the listener first, so Socket's import cycle resolves.
    await import("@core/socket/SocketListener");
    const { default: Socket } = await import("@core/socket/Socket");
    const { default: PacketBatcher } = await import("@core/utils/PacketBatcher");
    const batched: [string, unknown][] = [];
    vi.spyOn(PacketBatcher, "add").mockImplementation((type, data) => { batched.push([type, data]); });

    const socket = new Socket("wss://s1.moomodding.io/?token=x", null);
    // slice(): encode() returns a view into a larger pooled buffer, and a server message is exactly its own bytes.
    const receive = (message: unknown) => socket.onmessage!({ data: encode(message).slice().buffer } as MessageEvent);
    const receiveRaw = (bytes: Uint8Array) => socket.onmessage!({ data: bytes.slice().buffer } as MessageEvent);
    return { socket, batched, receive, receiveRaw };
}

const reasonText = () => document.getElementById("disconnected-reason")!.innerText;

describe("Socket messages (moomodding.io v1.8.2)", () => {
    it("drops data that isn't msgpack or isn't a [type, data] array, without throwing", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
        const { batched, receive, receiveRaw } = await connect();

        receiveRaw(new Uint8Array([0xc1])); // never valid in msgpack
        receive("just a string");
        expect(batched).toEqual([]);
        expect(warn).toHaveBeenCalledTimes(2);
    });

    it("converts 1.8.2 player updates and passes known packets to the batch", async () => {
        const { batched, receive } = await connect();
        receive(["io-init", ["id"]]);
        // One player: sid, x, y, dir (radians), then 9 attributes.
        receive(["a", [[5, 100, 200, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0]]]);
        receive(["O", [5, 80]]);

        expect(batched[0][0]).toBe("a");
        expect(batched[0][1]).toEqual([[5, 100, 200, 150], [5, 0, 0, 0, 0, 0, 0, 0, 0, 0], []]);
        expect(batched[1]).toEqual(["O", [5, 80]]);
    });

    it("logs an unknown packet the first time and doesn't batch it", async () => {
        const info = vi.spyOn(console, "info").mockImplementation(() => { });
        const { batched, receive } = await connect();
        receive(["auth_ok", [1]]);
        receive(["auth_ok", [2]]);
        expect(batched).toEqual([]);
        expect(info).toHaveBeenCalledTimes(1);
    });

    it("sends plain msgpack when io-init has no cipher mode", async () => {
        const { socket, receive } = await connect();
        receive(["io-init", ["id"]]);
        socket.sendMsg("6", "hi");
        expect(decode(sent[0])).toEqual(["6", ["hi"]]);
    });

    it("signs packets and shuffles ids after an io-init with cipher mode 1", async () => {
        const { socket, receive } = await connect();
        receive(["io-init", ["id", 12345, "00112233445566778899aabbccddeeff", 1]]);
        socket.sendMsg("6", "hi");

        const body = decode(sent[0].slice(6)) as [number, unknown[], number];
        expect(typeof body[0]).toBe("number");
        expect(body[1]).toEqual(["hi"]);
        expect(body[2]).toBe(1);
    });

    it("shows the server's disconnect reason when the connection closes", async () => {
        const { socket, receive } = await connect();
        socket.onopen!(new Event("open"));
        receive(["io-init", ["id"]]);
        receive(["B", ["Kicked for spam"]]);
        expect(closed).toBe(1);

        socket.onclose!({ code: 1000, reason: "" } as CloseEvent);
        expect(reasonText()).toBe("Kicked for spam (code 1000)");
    });

    it("offers a Reconnect button on the disconnected screen", async () => {
        const { socket, receive } = await connect();
        const { reconnect } = await import("@ui/ConnectionError");
        const run = vi.spyOn(reconnect, "run").mockImplementation(() => { });
        socket.onopen!(new Event("open"));
        receive(["io-init", ["id"]]);
        socket.onclose!({ code: 1006, reason: "" } as CloseEvent);

        const page = document.getElementById("disconnected-page")!;
        const button = document.getElementById("reconnect-btn")!;
        expect(page.style.display).toBe("flex");
        expect(page.contains(button)).toBe(true);
        button.click();
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("explains a connection that never opened", async () => {
        vi.spyOn(console, "error").mockImplementation(() => { });
        const { socket } = await connect();
        socket.onclose!({ code: 1006, reason: "" } as CloseEvent);
        expect(reasonText()).toContain("code 1006");
        expect(reasonText()).toContain("could not be reached");
    });

    it("gives up when the server sends no init packet within 10 s", async () => {
        vi.useFakeTimers();
        vi.spyOn(console, "error").mockImplementation(() => { });
        vi.spyOn(console, "log").mockImplementation(() => { });
        const { socket } = await connect();
        socket.onopen!(new Event("open"));

        vi.advanceTimersByTime(9_999);
        expect(closed).toBe(0);
        vi.advanceTimersByTime(1);
        expect(closed).toBe(1);
        expect(reasonText()).toContain("No init packet");
    });
});
