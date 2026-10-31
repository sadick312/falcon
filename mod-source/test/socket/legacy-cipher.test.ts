// v1.8.2's optional cipher (io-init mode 1), checked against a copy of the game client's own code
// (sandbox.moomodding.io/1.8.2/assets/index-*.js: Co, Oi, Po and Eo, with readable names).
import CustomEncoder from "@core/socket/CustomEncoder";
import PacketManager from "@core/utils/PacketManager";
import { decode, encode } from "@msgpack/msgpack";
import PacketMap from "@root/utils/socket/PacketMap";
import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

const SALT = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const SEED = 3141592653;

// ---- The 1.8.2 client's code ----
const gameC2S = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
const gameS2C = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

function gameRandom(e: number) {
    return function () {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- the game client's code, kept as written
        e |= 0, e = e + 1831565813 | 0;
        let t = Math.imul(e ^ e >>> 15, 1 | e);
        return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function gameShuffle(names: string[], seed: number) {
    const order = names.map((_, i) => i);
    const next = gameRandom(seed >>> 0);
    for (let d = names.length - 1; d > 0; d--) {
        const l = Math.floor(next() * (d + 1));
        [order[d], order[l]] = [order[l], order[d]];
    }
    const enc: Record<string, number> = {};
    const dec: Record<number, string> = {};
    names.forEach((name, i) => { enc[name] = order[i]; dec[order[i]] = name; });
    return { enc, dec };
}

function gameTables(seed: number) {
    const t = (seed ^ Math.imul(1, 2654435761)) >>> 0;
    return { c2s: gameShuffle(gameC2S, t), s2c: gameShuffle(gameS2C, (t ^ 2246822507) >>> 0) };
}

/** Eo: the first 6 bytes of HMAC-SHA256(salt bytes, packet). Node's crypto stands in for the game's own SHA-256. */
const gameSignature = (salt: string, body: Uint8Array) => [...createHmac("sha256", Buffer.from(salt, "hex")).update(body).digest().subarray(0, 6)];
// ---- end of game code ----

function legacyManager() {
    const manager = new PacketManager();
    manager.initLegacy(SEED, SALT);
    return manager;
}

describe("PacketManager v1.8.2 cipher", () => {
    it("builds the same packet-id tables as the 1.8.2 client", () => {
        const { tables } = legacyManager();
        const game = gameTables(SEED);

        expect(tables!.c2s.encrypt).toEqual(game.c2s.enc);
        expect(tables!.s2c.decrypt).toEqual(game.s2c.dec);
    });

    it("sends [id, args, seq] behind a 6-byte signature, unmasked, like the 1.8.2 client", () => {
        const client = legacyManager();
        const game = gameTables(SEED);
        const type = PacketMap.CLIENT_TO_SERVER.SEND_CHAT;
        const seq = ++client.sequence;

        // Same steps as Socket.sendEncrypted.
        const packetData = CustomEncoder.encode(type, client.tables!.c2s.encrypt[type], ["gg"], seq);
        const [signature, signatureUint] = client.getPacketSignature(packetData);
        const wire = new Uint8Array(PacketManager.PACKET_PADDING + packetData.length);
        wire.set(signature, 0);
        wire.set(packetData, PacketManager.PACKET_PADDING);
        client.maskOutcoming(wire, signatureUint);

        // What the 1.8.2 client would have sent for the same packet.
        const gameBody = encode([game.c2s.enc[type], ["gg"], 1]);
        expect([...wire.subarray(PacketManager.PACKET_PADDING)]).toEqual([...gameBody]);
        expect([...wire.subarray(0, PacketManager.PACKET_PADDING)]).toEqual(gameSignature(SALT, gameBody));
    });

    it("leaves server packets unmasked and decodes their shuffled ids", () => {
        const client = legacyManager();
        const game = gameTables(SEED);
        const bytes = encode([game.s2c.enc[PacketMap.SERVER_TO_CLIENT.UPDATE_HEALTH], [7, 80]]);
        const before = bytes.slice();

        client.maskIncoming(bytes);
        expect(bytes).toEqual(before);

        const [id, data] = decode(bytes) as [number, unknown[]];
        expect(client.tables!.s2c.decrypt[id]).toBe(PacketMap.SERVER_TO_CLIENT.UPDATE_HEALTH);
        expect(data).toEqual([7, 80]);
    });
});
