// Encoding and decoding of game packets, both directions, the way Socket.ts sends and receives them.
import CustomEncoder from "@core/socket/CustomEncoder";
import LegacyPacketAdapter from "@core/socket/LegacyPacketAdapter";
import { MooMooProtocol } from "@core/utils/CaptchaManager";
import PacketManager, { xorPacket } from "@core/utils/PacketManager";
import { decode, encode } from "@msgpack/msgpack";
import PacketMap from "@root/utils/socket/PacketMap";
import { describe, expect, it } from "vitest";

const C2S = PacketMap.CLIENT_TO_SERVER;
const S2C = PacketMap.SERVER_TO_CLIENT;

/** Stand-in for the game's protocol module: mixKey normally comes from the site's obfuscated code. */
const protocol: MooMooProtocol = { BUILD_ID: "test", BUILD_SALT: 0x5eed, mixKey: (key) => key.slice() };
const SALT = "00112233445566778899aabbccddeeff";

function initManager(seed = 123456) {
    const manager = new PacketManager();
    manager.init("id", seed, SALT, protocol);
    return manager;
}

describe("CustomEncoder", () => {
    // The hand-written fast paths must produce what msgpack would decode to the same values.
    const f32 = (n: number) => Math.fround(n);

    it.each([
        [C2S.STORE, [1, 7, 0], [true, 7, false]],
        [C2S.SELECT_TO_BUILD, [12, 1], [12, true]],
        [C2S.SEND_HIT, [1, 1.25], [1, 1.25]],
        [C2S.SEND_AIM, [-2.5], [-2.5]],
        [C2S.MOVE, [0.75], [0.75]],
        [C2S.MOVE, [null], [null]],
        [C2S.PING_SOCKET, [], []],
        [C2S.PING_MAP, [], []]
    ] as const)("fast path %s %j decodes back", (type, data, expected) => {
        const plain = decode(CustomEncoder.encode(type, type, [...data])) as unknown[];
        expect(plain).toEqual([type, expected]);

        const encrypted = decode(CustomEncoder.encode(type, 9, [...data], 4242)) as unknown[];
        expect(encrypted).toEqual([9, expected, 4242]);
    });

    it("sends float angles as float32", () => {
        const [, data] = decode(CustomEncoder.encode(C2S.SEND_AIM, C2S.SEND_AIM, [Math.PI])) as [string, number[]];
        expect(data[0]).toBe(f32(Math.PI));
    });

    it("falls back to msgpack for other packets", () => {
        const join = [{ name: "falcon", moofoll: "1", skin: 3 }];
        expect(decode(CustomEncoder.encode(C2S.JOIN_GAME, C2S.JOIN_GAME, join))).toEqual([C2S.JOIN_GAME, join]);
        expect(decode(CustomEncoder.encode(C2S.SEND_CHAT, 17, ["hello"], 8))).toEqual([17, ["hello"], 8]);
    });

    it("returns bytes that stay valid after the next encode", () => {
        // Socket keeps fast-path output only until it sends it; the msgpack path must return its own copy.
        const first = CustomEncoder.encode(C2S.SEND_CHAT, C2S.SEND_CHAT, ["first"]);
        const copy = first.slice();
        CustomEncoder.encode(C2S.SEND_CHAT, C2S.SEND_CHAT, ["second, longer"]);
        expect(first).toEqual(copy);
    });
});

describe("PacketManager cipher", () => {
    it("builds packet-id tables that are each other's inverse", () => {
        const { tables } = initManager();
        for (const [name, id] of Object.entries(tables!.c2s.encrypt)) expect(tables!.c2s.decrypt[id]).toBe(name);
        for (const [name, id] of Object.entries(tables!.s2c.encrypt)) expect(tables!.s2c.decrypt[id]).toBe(name);
        expect(Object.keys(tables!.s2c.encrypt)).not.toContain(S2C.IO_INIT);
    });

    it("gives different seeds different tables", () => {
        expect(initManager(1).tables!.s2c.encrypt).not.toEqual(initManager(2).tables!.s2c.encrypt);
    });

    it("unmasks and decrypts a stream of server packets in order", () => {
        const client = initManager();
        const server = initManager();
        const sent: [string, unknown[]][] = [
            [S2C.SET_UP_GAME, [7]],
            [S2C.UPDATE_PLAYERS, [[7, 100, 200, 314], [], []]],
            [S2C.RECEIVE_CHAT, [7, "hi :smile:"]],
            [S2C.UPDATE_HEALTH, [7, 80]]
        ];

        sent.forEach(([type, data], i) => {
            // Server side: encrypted id, msgpack, then XOR with this packet's sequence-based mask.
            const bytes = encode([server.tables!.s2c.encrypt[type], data]);
            xorPacket(bytes, (server.masks!.s2c ^ Math.imul(i + 1, 2654435761)) >>> 0);

            // Client side, as Socket.onMessage does it.
            client.maskIncoming(bytes);
            const parsed = decode(bytes) as [number | string, unknown[]];
            expect(client.tables!.s2c.decrypt[parsed[0] as number]).toBe(type);
            expect(parsed[1]).toEqual(data);
        });
    });

    it("signs and masks outgoing packets so the server can verify and read them", () => {
        const client = initManager();
        const type = C2S.SEND_CHAT;
        const id = client.tables!.c2s.encrypt[type];
        const seq = ++client.sequence;

        // Same steps as Socket.sendEncrypted.
        const packetData = CustomEncoder.encode(type, id, ["gg"], seq);
        const [signature, signatureUint] = client.getPacketSignature(packetData);
        const wire = new Uint8Array(PacketManager.PACKET_PADDING + packetData.length);
        wire.set(signature, 0);
        wire.set(packetData, PacketManager.PACKET_PADDING);
        client.maskOutcoming(wire, signatureUint);

        // Server side: read the signature, unmask the body, check the signature matches the body.
        const body = wire.slice(PacketManager.PACKET_PADDING);
        const sigUint = new DataView(wire.buffer).getUint32(0, true);
        xorPacket(body, (client.masks!.c2s ^ sigUint) >>> 0);
        expect(decode(body)).toEqual([id, ["gg"], seq]);
        expect([...client.getPacketSignature(body)[0]]).toEqual([...wire.subarray(0, PacketManager.PACKET_PADDING)]);
    });

    it("leaves bytes alone before the handshake (plain servers)", () => {
        const manager = new PacketManager();
        const bytes = encode([S2C.SET_UP_GAME, [1]]);
        const before = bytes.slice();
        manager.maskIncoming(bytes);
        expect(bytes).toEqual(before);
    });

    it("xorPacket undoes itself", () => {
        const bytes = Uint8Array.from({ length: 37 }, (_, i) => i * 7);
        const before = bytes.slice();
        xorPacket(bytes, 99);
        expect(bytes).not.toEqual(before);
        xorPacket(bytes, 99);
        expect(bytes).toEqual(before);
    });
});

describe("PacketManager.manage (outgoing filter)", () => {
    it("drops repeated move and aim packets, and forgets them on join", () => {
        const m = new PacketManager();
        expect(m.manage(C2S.MOVE, [1])).toBe(true);
        expect(m.manage(C2S.MOVE, [1])).toBe(false);
        expect(m.manage(C2S.MOVE, [2])).toBe(true);
        expect(m.manage(C2S.SEND_AIM, [0.5])).toBe(true);
        expect(m.manage(C2S.SEND_AIM, [0.5])).toBe(false);
        // A hit carries its direction, so the same aim right after it is redundant.
        m.manage(C2S.SEND_HIT, [1, 0.9]);
        expect(m.manage(C2S.SEND_AIM, [0.9])).toBe(false);
        m.manage(C2S.JOIN_GAME, [{ name: "a", moofoll: "1", skin: 0 }]);
        expect(m.manage(C2S.MOVE, [2])).toBe(true);
        expect(m.manage(C2S.SEND_AIM, [0.9])).toBe(true);
    });

    it("lets a move through after the movement reset", () => {
        const m = new PacketManager();
        m.manage(C2S.MOVE, [1]);
        m.manage(C2S.RESET_MOVEMENT_DIR, []);
        expect(m.manage(C2S.MOVE, [1])).toBe(true);
    });

    it("rewrites filtered words in chat but sends / commands unchanged", () => {
        const m = new PacketManager();
        const chat = ["what the fuck"];
        expect(m.manage(C2S.SEND_CHAT, chat)).toBe(true);
        expect(chat[0]).toBe("what the f\0uck");

        const command = ["/bot fuck"];
        m.manage(C2S.SEND_CHAT, command);
        expect(command[0]).toBe("/bot fuck");
    });
});

describe("LegacyPacketAdapter (v1.8.2 -> v1.9.0 layout)", () => {
    const attrs = (n: number) => Array.from({ length: 9 }, (_, i) => n + i);
    const player = (sid: number, x: number, y: number, dir: number, a: number[]) => [sid, x, y, dir, ...a];

    it("splits players into positions and changed attributes, and lists who left view", () => {
        const adapter = new LegacyPacketAdapter();
        const first = adapter.adapt(S2C.UPDATE_PLAYERS, [[...player(1, 10, 20, 0.5, attrs(0)), ...player(2, 30, 40, 1, attrs(10))]]);
        expect(first).toEqual([[1, 10, 20, 50, 2, 30, 40, 100], [1, ...attrs(0), 2, ...attrs(10)], []]);

        // Same attributes again: only positions; player 2 gone: listed as hidden.
        const second = adapter.adapt(S2C.UPDATE_PLAYERS, [player(1, 11, 21, 0.5, attrs(0))]);
        expect(second).toEqual([[1, 11, 21, 50], [], [2]]);

        // A respawned player gets its full attribute entry again.
        adapter.adapt(S2C.ADD_PLAYER, [["id", 1, "name"], false]);
        const third = adapter.adapt(S2C.UPDATE_PLAYERS, [player(1, 11, 21, 0.5, attrs(0))]);
        expect(third![1]).toEqual([1, ...attrs(0)]);
    });

    it("converts ais and passes other packets through", () => {
        const adapter = new LegacyPacketAdapter();
        expect(adapter.adapt(S2C.LOAD_AI, [[5, 2, 100, 200, 0.5, 40, 3]])).toEqual([[5, 2, 100, 200, 50, 40, 3, 0], []]);
        expect(adapter.adapt(S2C.LOAD_AI, [[]])).toEqual([[], [5]]);
        const chat = [1, "hi"];
        expect(adapter.adapt(S2C.RECEIVE_CHAT, chat)).toBe(chat);
    });

    it("treats a missing or malformed data array as empty", () => {
        const adapter = new LegacyPacketAdapter();
        expect(adapter.adapt(S2C.UPDATE_PLAYERS, undefined)).toEqual([[], [], []]);
        expect(adapter.adapt(S2C.UPDATE_PLAYERS, ["not an array"])).toEqual([[], [], []]);
    });
});
