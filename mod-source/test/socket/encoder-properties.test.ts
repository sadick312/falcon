// Property-based tests (fast-check) for the outgoing packet pipeline: CustomEncoder's hand-written msgpack, the
// v1.9.0 mask and signature, the move de-dup and the chat filter. Each property runs on hundreds of random inputs;
// the example-based tests in packets.test.ts and legacy-cipher.test.ts stay as the readable cases.
import CustomEncoder from "@core/socket/CustomEncoder";
import { MooMooProtocol } from "@core/utils/CaptchaManager";
import PacketManager, { xorPacket } from "@core/utils/PacketManager";
import { decode, encode } from "@msgpack/msgpack";
import PacketMap, { clientToServerArr, WireValue } from "@root/utils/socket/PacketMap";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const C2S = PacketMap.CLIENT_TO_SERVER;
const protocol: MooMooProtocol = { BUILD_ID: "test", BUILD_SALT: 0x5eed, mixKey: (key) => key.slice() };
const RUNS = { numRuns: 300 };

/** A packet id as Socket sends it: the letter (plain servers) or a shuffled table index (cipher). */
const packetId = fc.oneof(fc.constantFrom(...clientToServerArr), fc.integer({ min: 0, max: 127 }));
const seq = fc.option(fc.integer({ min: 0, max: 2 ** 32 - 1 }), { nil: undefined });
/** Any finite double; the fast paths send angles as float32. */
const angle = fc.double({ noNaN: true, noDefaultInfinity: true });
/** Item, weapon, hat and accessory ids: all below 128 (see the last CustomEncoder test). */
const smallId = fc.integer({ min: 0, max: 127 });

/** Encodes one packet and decodes it with the reference msgpack library. */
function roundTrip(type: Parameters<typeof CustomEncoder.encode>[0], id: string | number, data: WireValue[], s?: number) {
    return decode(CustomEncoder.encode(type, id, data, s)) as unknown[];
}
const withSeq = (id: string | number, data: unknown[], s?: number) => (s === undefined ? [id, data] : [id, data, s]);

describe("CustomEncoder fast paths (properties)", () => {
    it("STORE decodes to [buy, id, isAccessory]", () => {
        fc.assert(fc.property(packetId, fc.boolean(), smallId, fc.boolean(), seq, (id, buy, item, acc, s) => {
            expect(roundTrip(C2S.STORE, id, [buy, item, acc], s)).toEqual(withSeq(id, [buy, item, acc], s));
        }), RUNS);
    });

    it("SELECT_TO_BUILD decodes to [id, isWeapon]", () => {
        fc.assert(fc.property(packetId, smallId, fc.boolean(), seq, (id, item, weapon, s) => {
            expect(roundTrip(C2S.SELECT_TO_BUILD, id, [item, weapon], s)).toEqual(withSeq(id, [item, weapon], s));
        }), RUNS);
    });

    it("SEND_HIT decodes to [0 or 1, the direction as float32]", () => {
        fc.assert(fc.property(packetId, fc.constantFrom(0, 1), angle, seq, (id, hit, dir, s) => {
            expect(roundTrip(C2S.SEND_HIT, id, [hit, dir], s)).toEqual(withSeq(id, [hit, Math.fround(dir)], s));
        }), RUNS);
    });

    it("SEND_AIM decodes to [the direction as float32]", () => {
        fc.assert(fc.property(packetId, angle, seq, (id, dir, s) => {
            expect(roundTrip(C2S.SEND_AIM, id, [dir], s)).toEqual(withSeq(id, [Math.fround(dir)], s));
        }), RUNS);
    });

    it("MOVE decodes to [direction as float32] or [null] for stop", () => {
        fc.assert(fc.property(packetId, fc.option(angle, { nil: null }), seq, (id, dir, s) => {
            const expected = dir === null ? null : Math.fround(dir);
            expect(roundTrip(C2S.MOVE, id, [dir], s)).toEqual(withSeq(id, [expected], s));
        }), RUNS);
    });

    it("pings decode to an empty data array", () => {
        fc.assert(fc.property(packetId, fc.constantFrom(C2S.PING_SOCKET, C2S.PING_MAP), seq, (id, type, s) => {
            expect(roundTrip(type, id, [], s)).toEqual(withSeq(id, [], s));
        }), RUNS);
    });
});

describe("CustomEncoder generic path (properties)", () => {
    // Any value msgpack can carry. -0 becomes 0 (msgpack has no separate -0 integer, and toEqual tells them apart).
    const value: fc.Arbitrary<WireValue> = fc.letrec<{ v: WireValue }>((tie) => ({
        v: fc.oneof(
            { depthSize: "small" },
            fc.integer({ min: -(2 ** 31), max: 2 ** 32 }),
            fc.double({ noNaN: true, noDefaultInfinity: true }).map((n) => (Object.is(n, -0) ? 0 : n)),
            fc.string({ unit: "binary" }),
            fc.boolean(),
            fc.constant(null),
            fc.array(tie("v"), { maxLength: 4 }),
            fc.dictionary(fc.string({ maxLength: 6 }).filter((k) => k !== "__proto__"), tie("v"), { maxKeys: 4 })
        ) as fc.Arbitrary<WireValue>
    })).v;

    it("matches the msgpack library byte for byte, for any data (chat, join, clan packets...)", () => {
        const types = [C2S.SEND_CHAT, C2S.JOIN_GAME, C2S.SEND_UPGRADE, C2S.JOIN_CLAN, C2S.CREATE_CLAN];
        fc.assert(fc.property(fc.constantFrom(...types), packetId, fc.array(value, { maxLength: 4 }), seq, (type, id, data, s) => {
            const ours = CustomEncoder.encode(type, id, data, s);
            expect([...ours]).toEqual([...encode(withSeq(id, data, s))]);
            expect(decode(ours)).toEqual(withSeq(id, data, s));
        }), RUNS);
    });

    it("sends unicode chat unchanged", () => {
        fc.assert(fc.property(fc.string({ unit: "grapheme", maxLength: 30 }), (msg) => {
            expect(decode(CustomEncoder.encode(C2S.SEND_CHAT, C2S.SEND_CHAT, [msg]))).toEqual([C2S.SEND_CHAT, [msg]]);
        }), RUNS);
    });

    it("keeps every real game id below 128, which the fast paths write as a single byte", async () => {
        // STORE and SELECT_TO_BUILD write the id as a raw byte (msgpack positive fixint, 0-127). A larger id would
        // decode as a different value, so this guards the assumption the fast path makes.
        const { default: items } = await import("@constants/items");
        const { hats, accessories } = await import("@constants/store");
        const ids = [...items.weapons.map((w) => w.id), ...items.list.map((i) => i.id ?? 0), ...hats.map((h) => h.id), ...accessories.map((a) => a.id)];
        expect(Math.max(...ids)).toBeLessThan(128);
        expect(Math.min(...ids)).toBeGreaterThanOrEqual(0);
    });
});

describe("PacketManager (properties)", () => {
    const SALT = "00112233445566778899aabbccddeeff";

    it("xorPacket undoes itself for any bytes and seed", () => {
        fc.assert(fc.property(fc.uint8Array({ maxLength: 300 }), fc.integer({ min: 0, max: 2 ** 32 - 1 }), (bytes, seed) => {
            const copy = bytes.slice();
            xorPacket(copy, seed);
            xorPacket(copy, seed);
            expect(copy).toEqual(bytes);
        }), RUNS);
    });

    it("v1.9.0: every signed, masked packet verifies and decodes on the server side", () => {
        fc.assert(fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), fc.string({ maxLength: 40 }), (seed, msg) => {
            const client = new PacketManager();
            client.init("id", seed, SALT, protocol);
            const type = C2S.SEND_CHAT;
            const id = client.tables!.c2s.encrypt[type]!;
            const s = ++client.sequence;

            // Same steps as Socket.sendEncrypted.
            const packetData = CustomEncoder.encode(type, id, [msg], s);
            const [signature, signatureUint] = client.getPacketSignature(packetData);
            const wire = new Uint8Array(PacketManager.PACKET_PADDING + packetData.length);
            wire.set(signature, 0);
            wire.set(packetData, PacketManager.PACKET_PADDING);
            client.maskOutcoming(wire, signatureUint);

            const body = wire.slice(PacketManager.PACKET_PADDING);
            xorPacket(body, (client.masks!.c2s ^ new DataView(wire.buffer).getUint32(0, true)) >>> 0);
            expect(decode(body)).toEqual([id, [msg], s]);
            expect([...client.getPacketSignature(body)[0]]).toEqual([...wire.subarray(0, PacketManager.PACKET_PADDING)]);
        }), { numRuns: 100 });
    });

    it("signs the same bytes with the same 6-byte signature", () => {
        fc.assert(fc.property(fc.uint8Array({ minLength: 1, maxLength: 64 }), (bytes) => {
            const manager = new PacketManager();
            manager.initLegacy(12345, SALT);
            const a = [...manager.getPacketSignature(bytes)[0]];
            const b = [...manager.getPacketSignature(bytes)[0]];
            expect(a).toHaveLength(PacketManager.PACKET_PADDING);
            expect(b).toEqual(a);
        }), RUNS);
    });

    it("sends a move only when it differs from the previous one", () => {
        const dir = fc.constantFrom<number | null>(null, 0, 1.5, -2);
        fc.assert(fc.property(fc.array(dir, { maxLength: 30 }), (dirs) => {
            const m = new PacketManager();
            const sent = dirs.map((d) => m.manage(C2S.MOVE, [d]));
            const expected = dirs.map((d, i) => i === 0 || d !== dirs[i - 1]);
            expect(sent).toEqual(expected);
        }), RUNS);
    });

    it("only inserts invisible markers into chat, and leaves / commands as they are", () => {
        const words = fc.constantFrom("fuck", "shit", "moh", "m o h", "dick", "hello", "gg", "nice", " ");
        const chat = fc.array(words, { minLength: 1, maxLength: 8 }).map((w) => w.join(" "));
        fc.assert(fc.property(chat, fc.boolean(), (msg, asCommand) => {
            const original = asCommand ? `/${msg}` : msg;
            const data = [original];
            expect(new PacketManager().manage(C2S.SEND_CHAT, data)).toBe(true);
            if (asCommand) expect(data[0]).toBe(original);
            else expect((data[0] as string).replaceAll("\0", "")).toBe(original);
        }), RUNS);
    });
});
