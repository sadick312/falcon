// A2: Socket.ts paths the other socket tests don't reach: closing at each connection stage, the handshake timer,
// private servers, how a packet reaches its handler (odd data, a throwing handler), the artificial ping setting,
// the packets that skip the batch, and sending (not open, deduped, cipher-only ids, big packets, v1.9.0 protocol).
import { decode, encode } from "@msgpack/msgpack";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const original = globalThis.WebSocket;

class FakeNativeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    readyState = 1;
    binaryType = "blob";
    sent: Uint8Array[] = [];
    closeCalls = 0;
    constructor(public url: string) { }
    send(data: Uint8Array) { this.sent.push(data.slice()); }
    close() { this.closeCalls++; }
}

type Native = FakeNativeWebSocket;

beforeEach(() => {
    globalThis.WebSocket = FakeNativeWebSocket as unknown as typeof WebSocket;
    localStorage.setItem("falcon-host-mode", "moomodding");
    vi.resetModules();
    vi.spyOn(console, "log").mockImplementation(() => { });
    vi.spyOn(console, "error").mockImplementation(() => { });
    window.onbeforeunload = null;
});

afterEach(() => {
    globalThis.WebSocket = original;
    vi.useRealTimers();
});

async function connect(url = "wss://s1.moomodding.io/?token=x", protocol: unknown = null) {
    await import("@core/socket/SocketListener");
    const { default: Socket } = await import("@core/socket/Socket");
    const { default: PacketBatcher } = await import("@core/utils/PacketBatcher");
    const { default: Menu } = await import("@menu/Menu");
    const batched: [string, unknown][] = [];
    vi.spyOn(PacketBatcher, "add").mockImplementation((type, data) => { batched.push([type, data]); });

    const socket = new Socket(url, protocol as null);
    const native = socket as unknown as Native;
    const receive = (message: unknown) => socket.onmessage!({ data: encode(message).slice().buffer } as MessageEvent);
    const open = () => socket.onopen!(new Event("open"));
    const close = (code = 1006, reason = "") => socket.onclose!(new CloseEvent("close", { code, reason }));
    return { socket, native, batched, receive, open, close, Menu };
}

const reasonText = () => document.getElementById("disconnected-reason")!.innerText;
const display = (id: string) => document.getElementById(id)!.style.display;

describe("closing at each stage", () => {
    it("explains a close after opening but before the init packet", async () => {
        const { open, close } = await connect();
        open();
        close(1006, "nope");
        expect(reasonText()).toMatch(/^Server handshake failed: code 1006, nope\. Closed before the server sent its init packet/);
    });

    it("shows the disconnected screen with the close code once the game was running", async () => {
        const { open, receive, close } = await connect();
        open();
        receive(["io-init", ["id"]]);
        close(1006);

        expect(reasonText()).toBe("No reason provided (code 1006)");
        expect(display("disconnected-page")).toBe("flex");
        expect(display("game-ui")).toBe("none");
    });

    it("keeps the handshake-timeout message when the close event follows it", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const { native, open, close } = await connect();
        open();
        vi.advanceTimersByTime(10_000);
        const shown = reasonText();
        close(1006);

        expect(native.closeCalls).toBe(1);
        expect(shown).toMatch(/No init packet from the server within 10s/);
        expect(reasonText()).toBe(shown);
    });

    it("stops the handshake timer once the init packet arrives", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const { native, open, receive } = await connect();
        open();
        receive(["io-init", ["id"]]);
        vi.advanceTimersByTime(20_000);
        expect(native.closeCalls).toBe(0);
    });

    it("asks before leaving the page on a public server", async () => {
        const { open } = await connect();
        open();
        expect(window.onbeforeunload!(new Event("beforeunload") as BeforeUnloadEvent)).toBe("Are you sure?");
    });

    it("doesn't wait for an init packet or ask before leaving on a local dev server", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const { native, open } = await connect("ws://localhost:1234/?token=x");
        open();
        vi.advanceTimersByTime(20_000);

        expect(native.closeCalls).toBe(0);
        expect(window.onbeforeunload).toBeNull();
    });
});

describe("from a packet to its handler", () => {
    it("spreads the data into the handler", async () => {
        const { socket } = await connect();
        const handler = vi.fn();
        socket.on("O", handler);

        socket.processPacket("O", [5, 80]);
        expect(handler).toHaveBeenCalledWith(5, 80);
    });

    it("calls the handler with no arguments when the data isn't a list (e.g. [\"P\"])", async () => {
        const { socket } = await connect();
        const handler = vi.fn();
        socket.on("P", handler);

        socket.processPacket("P", undefined);
        expect(handler).toHaveBeenCalledWith();
    });

    it("logs a handler that throws and keeps going", async () => {
        const { socket } = await connect();
        socket.on("O", () => { throw new Error("boom"); });
        const next = vi.fn();
        socket.on("Q", next);

        expect(() => socket.processPacket("O", [1, 2])).not.toThrow();
        socket.processPacket("Q", [3]);

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining("'O' failed"), expect.any(Error), [1, 2]);
        expect(next).toHaveBeenCalledWith(3);
    });

    it("ignores a packet nobody handles", async () => {
        const { socket } = await connect();
        expect(() => socket.processPacket("Y", [1, 2])).not.toThrow();
    });

    it("records each dispatched packet in the packet log, except store updates", async () => {
        vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
        const { socket, open } = await connect();
        const { default: PacketRecorder } = await import("@services/packet-recorder/PacketRecorder");
        const add = vi.spyOn(PacketRecorder, "add").mockImplementation(() => { });
        open(); // starts the recorder

        socket.processPacket("O", [5, 80]);
        socket.processPacket("5", [true, 7, 0]);

        expect(add).toHaveBeenCalledTimes(1);
        expect(add).toHaveBeenCalledWith("O", expect.objectContaining({ packetData: { type: "O", data: [5, 80] } }));
    });

    it("hands ping, minimap and leaderboard packets over at once instead of batching them", async () => {
        const { socket, receive, batched } = await connect();
        const handler = vi.fn();
        socket.on("7", handler);
        receive(["io-init", ["id"]]);

        receive(["7", [[1, 2]]]);

        expect(handler).toHaveBeenCalledWith([1, 2]);
        expect(batched).toEqual([]);
    });

    it("tells the game-event tracker who swung", async () => {
        const { receive } = await connect();
        const { default: GameEventTracker } = await import("@core/mod/utils/GameEventTracker");
        const track = vi.spyOn(GameEventTracker, "updateTracker");
        receive(["io-init", ["id"]]);

        receive(["K", [12, 1, 5]]);
        expect(track).toHaveBeenCalledWith(12, "K");
    });
});

describe("the artificial ping setting", () => {
    async function withPing(amount: string) {
        const ctx = await connect();
        ctx.Menu.init();
        ctx.Menu.itemMap.artificialPing.status = true;
        ctx.Menu.itemMap.artificialPingAmt.status = amount;
        const { default: TaskScheduler } = await import("@services/event-timer/TaskScheduler");
        const delayed: { cb: () => void; ms: number }[] = [];
        vi.spyOn(TaskScheduler, "setTimeout").mockImplementation((cb, ms) => { delayed.push({ cb, ms }); });
        return { ...ctx, delayed };
    }

    it("delays incoming packets by half the setting", async () => {
        const { socket, delayed } = await withPing("60");
        const handler = vi.fn();
        socket.on("O", handler);

        socket.processPacket("O", [1, 2]);
        expect(handler).not.toHaveBeenCalled();
        expect(delayed[0].ms).toBe(30);

        delayed[0].cb();
        expect(handler).toHaveBeenCalledWith(1, 2);
    });

    it("uses 20 ms when the amount isn't a number", async () => {
        const { socket, delayed } = await withPing("lots");
        socket.processPacket("O", [1, 2]);
        expect(delayed[0].ms).toBe(10);
    });

    it("delays sends and keeps each packet's own arguments", async () => {
        const { socket, native, receive, delayed } = await withPing("40");
        receive(["io-init", ["id"]]);

        socket.sendMsg("6", "first");
        socket.sendMsg("z", 3, false);
        expect(native.sent).toHaveLength(0);

        delayed.forEach(d => d.cb());
        expect(native.sent.map(bytes => decode(bytes))).toEqual([["6", ["first"]], ["z", [3, false]]]);
    });

    it("adds no delay at all when off, also after being on (nothing scheduled, sent and handled at once)", async () => {
        const ctx = await withPing("60");
        const { socket, native, receive, delayed, Menu } = ctx;
        receive(["io-init", ["id"]]);
        Menu.itemMap.artificialPing.status = false;

        const handler = vi.fn();
        socket.on("O", handler);
        socket.processPacket("O", [1, 2]);
        socket.sendMsg("6", "now");

        expect(handler).toHaveBeenCalledWith(1, 2);
        expect(native.sent.map(bytes => decode(bytes))).toEqual([["6", ["now"]]]);
        expect(delayed).toHaveLength(0);
    });
});

describe("TaskScheduler (runs the artificial ping's delays)", () => {
    it("runs a task after its delay, not before, within a few ms", async () => {
        vi.useRealTimers();
        vi.resetModules();
        const { default: TaskScheduler } = await import("@services/event-timer/TaskScheduler");
        TaskScheduler.init();

        const start = performance.now();
        const ranAt = await new Promise<number>(resolve => TaskScheduler.setTimeout(() => resolve(performance.now()), 30));
        const waited = ranAt - start;

        expect(waited).toBeGreaterThanOrEqual(29.5);
        expect(waited).toBeLessThan(50);
    });

    it("keeps going after a task throws", async () => {
        vi.useRealTimers();
        vi.resetModules();
        const { default: TaskScheduler } = await import("@services/event-timer/TaskScheduler");
        TaskScheduler.init();
        vi.spyOn(console, "error").mockImplementation(() => { });

        TaskScheduler.setTimeout(() => { throw new Error("boom"); }, 5);
        const ran = await new Promise<boolean>(resolve => TaskScheduler.setTimeout(() => resolve(true), 15));
        expect(ran).toBe(true);
    });
});

describe("sending", () => {
    it("sends nothing while the socket isn't open", async () => {
        const { socket, native } = await connect();
        native.readyState = 0;
        socket.sendMsg("6", "hi");
        expect(native.sent).toHaveLength(0);
    });

    it("drops a repeated move direction", async () => {
        const { socket, native, receive } = await connect();
        receive(["io-init", ["id"]]);
        socket.sendMsg("9", 1.5);
        socket.sendMsg("9", 1.5);
        socket.sendMsg("9", null);
        expect(native.sent.map(bytes => decode(bytes))).toEqual([["9", [1.5]], ["9", [null]]]);
    });

    it("drops numeric packet ids the 1.8.2 cipher table doesn't have", async () => {
        const { receive, batched } = await connect();
        receive(["io-init", ["id", 12345, "00112233445566778899aabbccddeeff", 1]]);
        receive([200, [1]]);
        expect(batched).toEqual([]);
    });

    it("never sends packets 1.8.2 doesn't have once the cipher is on", async () => {
        const { socket, native, receive } = await connect();
        receive(["io-init", ["id", 12345, "00112233445566778899aabbccddeeff", 1]]);

        (socket.sendMsg as (type: string, ...args: unknown[]) => void)("T", 0, 0);
        (socket.sendMsg as (type: string, ...args: unknown[]) => void)("V");
        expect(native.sent).toHaveLength(0);

        socket.sendMsg("0");
        expect(native.sent).toHaveLength(1);
    });

    it("signs a chat message bigger than the send buffer", async () => {
        const { socket, native, receive } = await connect();
        receive(["io-init", ["id", 12345, "00112233445566778899aabbccddeeff", 1]]);
        const long = "x".repeat(1500);

        socket.sendMsg("6", long);

        const packet = native.sent[0];
        expect(packet.length).toBeGreaterThan(1024);
        const [, args, seq] = decode(packet.subarray(6)) as [number, string[], number];
        expect(args[0]).toBe(long);
        expect(seq).toBe(1);
    });

    it("sets up v1.9.0's protocol module from io-init on sandbox.moomoo.io", async () => {
        localStorage.setItem("falcon-host-mode", "moomoo-sandbox");
        vi.resetModules();
        const mixKey = vi.fn((key: Uint8Array) => new Uint8Array([...key, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 8));
        const { socket, native, receive } = await connect("wss://abc.eu.moomoo.io/?token=tk", { BUILD_ID: "b", BUILD_SALT: 7, mixKey });

        receive(["io-init", ["id", 99, "0011223344556677", 0]]);
        socket.sendMsg("0");

        expect(mixKey).toHaveBeenCalledTimes(1);
        // Signed (6 bytes) and masked: not a plain msgpack ["0", []].
        expect(native.sent[0].length).toBeGreaterThan(6);
        expect(() => decode(native.sent[0])).toThrow();
    });
});
