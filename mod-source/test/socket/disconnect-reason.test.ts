// v1.8.2 servers send DISCONNECT ("B", [reason]) and then close. The reason must reach the disconnected screen.
import { encode } from "@msgpack/msgpack";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const original = globalThis.WebSocket;

/** Stands in for the browser's WebSocket; Socket extends it. */
class FakeNativeWebSocket {
    static readonly OPEN = 1;
    readyState = 1;
    binaryType = "blob";
    closed = false;
    constructor(public url: string) { }
    send() { }
    close() { this.closed = true; }
}

type TestSocket = InstanceType<typeof import("@core/socket/Socket").default> & {
    onopen: (ev: Event) => void;
    onmessage: (ev: MessageEvent) => void;
    onclose: (ev: CloseEvent) => void;
    closed: boolean;
};

let socket: TestSocket;

const receive = (packet: unknown[]) => socket.onmessage({ data: encode(packet).slice().buffer } as MessageEvent);
const reasonText = () => document.getElementById("disconnected-reason")!.innerText;

beforeEach(async () => {
    globalThis.WebSocket = FakeNativeWebSocket as unknown as typeof WebSocket;
    vi.resetModules();
    vi.spyOn(console, "log").mockImplementation(() => { });
    vi.spyOn(console, "error").mockImplementation(() => { });

    await import("@core/socket/SocketListener");
    const { default: Socket } = await import("@core/socket/Socket");
    socket = new Socket("wss://s1.moomodding.io/?token=test", null) as TestSocket;
    socket.onopen(new Event("open"));
});

afterEach(() => {
    globalThis.WebSocket = original;
});

describe("DISCONNECT (B)", () => {
    it("closes the socket and shows the server's reason", () => {
        receive(["io-init", ["socket-id"]]);
        receive(["B", ["You were kicked"]]);
        expect(socket.closed).toBe(true);

        socket.onclose({ code: 1005, reason: "" } as CloseEvent);
        expect(reasonText()).toBe("You were kicked (code 1005)");
    });

    it("shows the reason on the error screen when it comes before the init packet", () => {
        receive(["B", ["Invalid Connection"]]);
        socket.onclose({ code: 1005, reason: "" } as CloseEvent);
        expect(reasonText()).toContain("Invalid Connection");
    });

    it("falls back to the generic text when the reason is empty or not text", () => {
        receive(["io-init", ["socket-id"]]);
        receive(["B", [42]]);
        socket.onclose({ code: 1006, reason: "" } as CloseEvent);
        expect(reasonText()).toBe("No reason provided (code 1006)");
    });
});
