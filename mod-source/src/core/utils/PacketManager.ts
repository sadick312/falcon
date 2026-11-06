import items from "@constants/items";
import Client from "@core/Client";
import ChatCommands from "@core/utils/ChatCommands";
import { MooMooProtocol } from "@core/utils/CaptchaManager";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { GAME_V182 } from "@constants/gameVersion";
import PacketMap, { clientToServerArr, serverToClientArr, WireValue } from "@root/utils/socket/PacketMap";

const profanityList = [
    "cunt", "whore", "fuck", "shit", "faggot", "nigger", "mohmoh", "moh ",
    "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex",
    "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune",
    "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"
];

// Built once instead of a new RegExp per word on every chat message.
const profanityFilters = [...new Set(profanityList)].map(word => ({
    word,
    regex: new RegExp(word, "g"),
    replacement: word[0] + String.fromCharCode(0) + word.slice(1)
}));
const mohRegex = /m\s*o\s*h/gi;

function createPRNG(seed: number) {
    return function nextRandom() {
        seed |= 0;
        seed = seed + 1831565813 | 0;

        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t,
            ((t ^ t >>> 14) >>> 0) / 4294967296
    };
}

function createMasks(key: Uint8Array) {
    const data = new DataView(key.buffer);

    return {
        c2s: (data.getUint32(0, true) ^ 3266489909) >>> 0,
        s2c: (data.getUint32(4, true) ^ 668265263) >>> 0,
    };
}

function createCipherMap(charArray: string[], seed: number) {
    const length = charArray.length;
    const indices = charArray.map((_, index) => index);
    const nextRandom = createPRNG(seed >>> 0);

    for (let i = length - 1; i > 0; i--) {
        const randomIndex = Math.floor(nextRandom() * (i + 1));
        const temp = indices[i];

        indices[i] = indices[randomIndex];
        indices[randomIndex] = temp;
    }

    const encryptMap: Record<string, number> = {};
    const decryptMap: Record<number, string> = {};

    for (let i = 0; i < length; i++) {
        const char = charArray[i];
        const shuffledIndex = indices[i];

        encryptMap[char] = shuffledIndex;
        decryptMap[shuffledIndex] = char;
    }

    return {
        encrypt: encryptMap,
        decrypt: decryptMap
    };
}

function hexToBytes(hexString: string) {
    const buffer = new Uint8Array(hexString.length / 2);

    for (let i = 0; i < buffer.length; i++) {
        const index = i * 2;
        const slice = hexString.slice(index, index + 2);

        buffer[i] = parseInt(slice, 16);
    }

    return buffer;
}

interface ICipherMap {
    encrypt: Record<string, number>;
    decrypt: Record<number, string>;
}

interface IPacketCipherMap {
    c2s: ICipherMap;
    s2c: ICipherMap;
}

interface IPacketMaskMap {
    c2s: number;
    s2c: number;
}

export function xorPacket(data: Uint8Array, seed: number) {
    let state = seed >>> 0;
    if (state === 0) state = 1831565813;

    for (let offset = 0; offset < data.length; offset += 4) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;

        data[offset] ^= state & 0xff;
        if (offset + 1 < data.length) data[offset + 1] ^= (state >>> 8) & 0xff;
        if (offset + 2 < data.length) data[offset + 2] ^= (state >>> 16) & 0xff;
        if (offset + 3 < data.length) data[offset + 3] ^= state >>> 24;
    }
}

export default class PacketManager {
    sequence = 0;
    received = 0;

    tables?: IPacketCipherMap;
    salt?: Uint8Array;
    masks?: IPacketMaskMap;

    static readonly PACKET_PADDING = 6;
    private SIGNATURE_BUFFER = new Uint8Array(PacketManager.PACKET_PADDING);

    maskIncoming(bytes: Uint8Array) {
        // No masks before the handshake, on plain servers, or with v1.8.2's cipher (which only signs).
        if (!this.masks) return;

        const sequence = ++this.received;
        const seed = (this.masks.s2c ^ Math.imul(sequence, 2654435761)) >>> 0;
        xorPacket(bytes, seed);
    }

    maskOutcoming(bytes: Uint8Array, signatureUint: number) {
        if (!this.masks) return;
        const seed = (this.masks.c2s ^ signatureUint) >>> 0;
        xorPacket(bytes.subarray(PacketManager.PACKET_PADDING), seed);
    }

    private initTable(seed: number, salt: number, c2sArr = clientToServerArr, s2cArr = serverToClientArr) {
        const c2sSeedBase = (seed ^ Math.imul(salt, 2654435761)) >>> 0;
        const s2cSeedBase = (c2sSeedBase ^ 2246822507) >>> 0;

        this.tables = {
            c2s: createCipherMap(c2sArr, c2sSeedBase),
            s2c: createCipherMap(s2cArr, s2cSeedBase),
        };
    }

    /**
     * v1.8.2's optional cipher (io-init mode 1): shuffled packet ids from its own packet lists, and each
     * outgoing packet signed with HMAC-SHA256 keyed by the raw salt bytes. Nothing is XOR-masked.
     */
    initLegacy(seed: number, salt: string) {
        this.sequence = 0;
        this.received = 0;

        this.initTable(seed >>> 0, GAME_V182.cipherTableSalt, [...GAME_V182.clientToServer], [...GAME_V182.serverToClient]);
        this.salt = hexToBytes(salt);
        this.masks = undefined;
    }

    init(_id: string, seed: number, salt: string, protocol: MooMooProtocol) {
        seed = seed >>> 0;
        const key = hexToBytes(salt);

        this.sequence = 0;
        this.received = 0;

        this.initTable(seed, protocol.BUILD_SALT);
        this.salt = protocol.mixKey(key, seed);
        this.masks = createMasks(this.salt);
    }

    private signatureDataView = new DataView(this.SIGNATURE_BUFFER.buffer);
    private packetSignBuffer: [Uint8Array, number] = [new Uint8Array(), 0];

    getPacketSignature(data: Uint8Array): [Uint8Array, number] {
        const hash = hmac(sha256, this.salt!, data);

        for (let i = 0; i < PacketManager.PACKET_PADDING; i++) {
            this.SIGNATURE_BUFFER[i] = hash[i];
        }

        this.packetSignBuffer[0] = this.SIGNATURE_BUFFER;
        this.packetSignBuffer[1] = this.signatureDataView.getUint32(0, true);
        return this.packetSignBuffer;
    }

    private data: Record<string, unknown> = {};
    private aimDirection: number = Infinity;

    /** Forget the last sent move/aim so the first ones after a (re)spawn are never dropped as duplicates. */
    private resetDedupe() {
        this.data = {};
        this.aimDirection = Infinity;
    }

    private filterChat(chatInput: string) {
        for (let i = 0; i < profanityFilters.length; i++) {
            const filter = profanityFilters[i];
            if (chatInput.indexOf(filter.word) > -1) chatInput = chatInput.replace(filter.regex, filter.replacement);
        }

        if (chatInput.replace(/ /g, "").includes("moh")) {
            chatInput = chatInput.replace(mohRegex, (match) => match[0] + "\0" + match.slice(1));
        }

        return chatInput;
    }

    manage(type: string, data: WireValue[]) {
        if (type === PacketMap.CLIENT_TO_SERVER.SEND_CHAT) {
            const chatInput = data[0];
            if (typeof chatInput !== "string") return true;

            // Local "!" commands (!help, !clear, !plog, ...) never reach the server.
            if (ChatCommands.run(chatInput)) return false;

            // Server commands (moomodding.io: /fight, /bot, /var, /clear, /help) must reach the server
            // exactly as typed, so skip the filter rewrites below.
            if (chatInput.startsWith("/")) return true;

            data[0] = this.filterChat(chatInput);
        } else if (type === PacketMap.CLIENT_TO_SERVER.JOIN_GAME) {
            this.resetDedupe();
        } else if (type === PacketMap.CLIENT_TO_SERVER.RESET_MOVEMENT_DIR) {
            this.data[PacketMap.CLIENT_TO_SERVER.MOVE] = Infinity;
        } else if (type === PacketMap.CLIENT_TO_SERVER.MOVE) {
            if (this.data[type] === data[0]) return false;
            this.data[type] = data[0];
        } else if (type === PacketMap.CLIENT_TO_SERVER.SEND_AIM) {
            if (this.aimDirection === data[0]) return false;
            this.aimDirection = data[0];
        } else if (type === PacketMap.CLIENT_TO_SERVER.SEND_HIT) {
            // A hit carries its own direction, so the next identical aim packet is redundant.
            if (typeof data[1] === "number") this.aimDirection = data[1];
        } else if (type === PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE) {
            const id = data[0];
            if (Client.upgradesObtained.has(id)) return false;
            Client.upgradesObtained.add(id);

            if (id < 16) {
                const wpn = items.weapons[id];
                const current = items.weapons[Client.weaponIndex];

                if (wpn && current && current.type === wpn.type && wpn.type <= 1) {
                    Client.weaponIndex = id;
                }
            }
        }

        return true;
    }
}
