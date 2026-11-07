import Endpoints, { HANDSHAKE_TIMEOUT_MS } from "@constants/Endpoints";
import { socketHooks } from "@core/socket/socketHooks";
import { GAME_V182 } from "@constants/gameVersion";
import { deathText } from "@core/Client";
import GameEventTracker from "@core/mod/utils/GameEventTracker";
import CustomEncoder from "@core/socket/CustomEncoder";
import LegacyPacketAdapter from "@core/socket/LegacyPacketAdapter";
import PlayerUpdateEvent from "@core/socket/events/core/PlayerUpdateEvent";
import { MooMooProtocol } from "@core/utils/CaptchaManager";
import PacketBatcher from "@core/utils/PacketBatcher";
import PacketManager from "@core/utils/PacketManager";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import { Decoder } from "@msgpack/msgpack";
import PacketMap, { knownServerPackets, MOOMOO_CLIENT_TO_SERVER_MAP, MOOMOO_SERVER_TO_CLIENT_MAP, WireValue } from "@root/utils/socket/PacketMap";
import TaskScheduler from "@services/event-timer/TaskScheduler";
import { profileEnd, profileStart } from "@services/profiler/Profiler";
import PacketRecorder from "@services/packet-recorder/PacketRecorder";
import { showConnectionError } from "@ui/ConnectionError";
import { enterGameBtn } from "@ui/Hook";
import { gameUI, respawnPage } from "@ui/Loader";
import getElem from "@utils/dom/getElem";

type EventKey = keyof MOOMOO_SERVER_TO_CLIENT_MAP;
type EventCallback<K extends EventKey> = (...args: MOOMOO_SERVER_TO_CLIENT_MAP[K]) => void;

type SendMsgSignature = <K extends keyof MOOMOO_CLIENT_TO_SERVER_MAP>(
    type: K,
    ...args: MOOMOO_CLIENT_TO_SERVER_MAP[K]
) => void;

const disconnectedPage = getElem("disconnected-page");
const disconnectedReason = getElem("disconnected-reason");
export const respawnMainCard = getElem("respawn-page-main-card");

// msgpack's decode() builds a new Decoder per call; reuse one for every server message.
const decoder = new Decoder();

export type MixKeyFunc = (key: Uint8Array, offset: number) => Uint8Array;

/**
 * sandbox.moomodding.io's hackfix.js replaces window.WebSocket with a plain function that returns a native
 * socket. Extending that wrapper hands back an object without Socket's methods, so extend the native class,
 * which the wrapper still exposes as its prototype's constructor. Elsewhere this is just window.WebSocket.
 */
const NativeWebSocket = WebSocket.prototype.constructor as typeof WebSocket;

export default class Socket extends NativeWebSocket {
    private handlers: {
        [K in EventKey]?: EventCallback<K>
    } = {};

    private manager = new PacketManager();
    /** null on servers that use plain msgpack without mixKey encryption (moomodding.io v1.8.2). */
    private socketProtocol: MooMooProtocol | null;

    isPrivateServer = false;
    /** Send plain msgpack instead of signed, encrypted packets. */
    private plainPackets = false;
    /** Rewrites v1.8.2 packet layouts into the v1.9.0 ones the handlers expect. */
    private legacyAdapter = Endpoints.gameVersion === GAME_V182.version ? new LegacyPacketAdapter() : null;

    private hasOpened = false;
    /** Set when a newer connection replaces this one: its late messages, close event and queued sends are ignored. */
    private disposed = false;
    private handshakeDone = false;
    private errorShown = false;
    /** Reason from the server's DISCONNECT packet, shown when the socket closes. */
    private serverReason: string | null = null;
    private handshakeTimer: number | undefined;

    constructor(url: string, socketProtocol: MooMooProtocol | null) {
        super(url);

        this.socketProtocol = socketProtocol;
        this.binaryType = "arraybuffer";
        // Same rule as Endpoints.socketUrl (this used `url.includes("localhost")`, true for e.g. localhost.example.com).
        this.isPrivateServer = Endpoints.isLocalHost(new URL(url).host);
        this.plainPackets = this.isPrivateServer || socketProtocol === null;

        this.onopen = (ev) => this.onOpen(ev);
        this.onmessage = (ev) => this.onMessage(ev);
        this.onclose = (ev) => this.onClose(ev);
    }

    /**
     * Ends this connection for good before a new one starts: no disconnect screen, no more packets into the game
     * state, no sends (also none queued by the artificial ping setting).
     */
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.clearHandshakeTimer();
        if (this.readyState === WebSocket.CONNECTING || this.readyState === WebSocket.OPEN) this.close();
    }

    get isDisposed() {
        return this.disposed;
    }

    private clearHandshakeTimer() {
        if (this.handshakeTimer === undefined) return;
        clearTimeout(this.handshakeTimer);
        this.handshakeTimer = undefined;
    }

    private onClose(ev: CloseEvent) {
        this.clearHandshakeTimer();
        if (this.disposed) return;
        socketHooks.onClose();

        if (this.errorShown) return;
        const code = `code ${ev.code}`;
        // A reason the server sent in a DISCONNECT packet beats the close frame's (usually empty) one.
        const reason = this.serverReason ?? ev.reason;

        // The browser gives no detail for failed connections, only code 1006.
        if (!this.hasOpened) {
            showConnectionError("socket-open", `${code}${reason ? `, ${reason}` : ""}. The server refused or could not be reached (bad/expired ticket, wrong host, or build id mismatch).`);
        } else if (!this.handshakeDone) {
            showConnectionError("handshake", `${code}${reason ? `, ${reason}` : ""}. Closed before the server sent its init packet.`);
        } else {
            respawnPage.style.display = "flex";
            disconnectedPage.style.display = "flex";
            respawnMainCard.style.display = "none";
            deathText.style.display = "none";
            gameUI.style.display = "none";

            disconnectedReason.innerText = reason ? `${reason} (${code})` : `No reason provided (${code})`;
        }
    }

    private onOpen(_ev: Event) {
        if (this.disposed) return;
        this.hasOpened = true;

        // Local private servers use the plain encoder and may never send io-init, so don't police them.
        if (this.isPrivateServer) this.handshakeDone = true;

        if (!this.handshakeDone) this.handshakeTimer = window.setTimeout(() => {
            if (this.handshakeDone) return;
            this.errorShown = true;
            showConnectionError("handshake", `No init packet from the server within ${HANDSHAKE_TIMEOUT_MS / 1000}s.`);
            this.close();
        }, HANDSHAKE_TIMEOUT_MS);

        PacketRecorder.init();
        PacketBatcher.init(this);
        enterGameBtn.classList.remove("disabled");
        console.log(`Connected to '${this.url}'`);

        if (!this.isPrivateServer) {
            window.onbeforeunload = () => {
                return "Are you sure?";
            };
        }
    }

    /** One-way delay added by the "artificial ping" setting, or 0 when it is off. */
    private getArtificialDelay() {
        if (!Menu.getValue("artificialPing")) return 0;

        const parsedAmt = parseInt(Menu.getValue("artificialPingAmt"));
        return (isNaN(parsedAmt) ? 20 : parsedAmt) / 2;
    }

    processPacket(type: keyof MOOMOO_SERVER_TO_CLIENT_MAP, data: unknown) {
        const delay = this.getArtificialDelay();

        if (!delay) {
            this.dispatch(type, data);
            return;
        }

        TaskScheduler.setTimeout(() => {
            this.dispatch(type, data);
        }, delay);
    }

    private onMessage(ev: MessageEvent) {
        if (this.disposed) return;
        const bytes = new Uint8Array(ev.data);
        this.manager.maskIncoming(bytes);

        let parsed: WireValue[];
        const decodeStart = __DEV__ ? profileStart() : 0;
        try {
            parsed = decoder.decode(bytes) as WireValue[];
            if (__DEV__) profileEnd("decode", decodeStart);
        } catch (err) {
            console.warn("[Falcon] Dropped a server message that is not valid msgpack.", err);
            return;
        }

        if (!Array.isArray(parsed)) {
            console.warn("[Falcon] Dropped a server message that is not a [type, data] array.", parsed);
            return;
        }

        if (parsed[0] === "io-init") {
            const [id, seed, salt, mode] = parsed[1] as MOOMOO_SERVER_TO_CLIENT_MAP["io-init"];
            // Plain servers send io-init with only an id; there is no cipher table to set up.
            if (this.socketProtocol) {
                this.manager.init(id, seed, salt, this.socketProtocol);
            } else if (this.legacyAdapter && mode === GAME_V182.cipherMode && !this.isPrivateServer) {
                // v1.8.2 servers can turn on shuffled ids + signed packets; from here on, send them that way.
                this.manager.initLegacy(seed, salt);
                this.plainPackets = false;
            }
            this.handshakeDone = true;
            this.clearHandshakeTimer();
            return;
        }

        if (this.manager.tables && typeof parsed[0] === "number") {
            parsed[0] = this.manager.tables.s2c.decrypt[parsed[0]];
            if (parsed[0] === undefined) return;
        }

        if (!knownServerPackets.has(parsed[0])) {
            this.logUnknownPacket(parsed[0], parsed[1]);
            return;
        }

        if (parsed[0] === PacketMap.SERVER_TO_CLIENT.DISCONNECT) {
            // The server's reason for ending the connection; it closes right after. Handled here rather than
            // batched, so the reason is known when onclose shows the disconnected screen. The game closes too.
            const reason = Array.isArray(parsed[1]) ? parsed[1][0] : undefined;
            this.serverReason = typeof reason === "string" && reason ? reason : null;
            this.close();
            return;
        }

        if (this.legacyAdapter) parsed[1] = this.legacyAdapter.adapt(parsed[0], parsed[1]);

        if (PacketBatcher.UI_PACKETS.has(parsed[0])) {
            this.processPacket(parsed[0], parsed[1]);
            return;
        }

        if (parsed[0] === PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS) {
            PlayerUpdateEvent.lastReceive = performance.now();
        }

        // ADD_PROJECTILE's last value is the projectile's own sid, not the shooter's (it was read as the shooter here);
        // ProjectileManager.add works out who fired and reports it.
        if (parsed[0] === PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION && Array.isArray(parsed[1])) {
            GameEventTracker.updateTracker(parsed[1][0], parsed[0]);
        }

        PacketBatcher.add(parsed[0], parsed[1]);
    }

    private dispatch<K extends keyof MOOMOO_SERVER_TO_CLIENT_MAP>(
        type: K,
        data: unknown
    ) {
        if (this.disposed) return;
        socketHooks.onDispatch(type, data);

        const callback = this.handlers[type];
        if (!callback) return;

        // Some servers send packets with no data array (e.g. ["P"]); spread an empty list instead of throwing.
        const typedData = (Array.isArray(data) ? data : []) as MOOMOO_SERVER_TO_CLIENT_MAP[K];

        try {
            callback(...typedData);
        } catch (err) {
            console.error(`[Falcon] Handler for packet '${String(type)}' failed.`, err, data);
        }
    }

    private unknownPackets = new Map<string, number>();

    /** Logs the first time each unknown packet type arrives (with a sample), then every 100th. */
    private logUnknownPacket(type: unknown, data: unknown) {
        const key = String(type);
        const count = (this.unknownPackets.get(key) ?? 0) + 1;
        this.unknownPackets.set(key, count);

        if (count === 1 || count % 100 === 0) {
            console.info(`[Falcon] Ignoring unknown packet '${key}' (seen ${count}x).`, data);
        }
    }

    on<K extends EventKey>(event: K, callback: EventCallback<K>) {
        (this.handlers as Record<string, unknown>)[event] = callback;
    }

    private DATA_BUFFER: unknown[] = [null, null, null];

    private populateBuffer(arg1?: unknown, arg2?: unknown, arg3?: unknown) {
        // Write every slot so a skipped (undefined) argument can't leave the previous packet's value behind.
        const len = arg3 !== undefined ? 3 : arg2 !== undefined ? 2 : arg1 !== undefined ? 1 : 0;

        this.DATA_BUFFER.length = 3;
        this.DATA_BUFFER[0] = arg1;
        this.DATA_BUFFER[1] = arg2;
        this.DATA_BUFFER[2] = arg3;
        this.DATA_BUFFER.length = len;
        return len;
    }

    private sendActualMsg(type: keyof MOOMOO_CLIENT_TO_SERVER_MAP) {
        if (this.disposed) return;
        if (this.plainPackets) {
            const binary = CustomEncoder.encode(type, type, this.DATA_BUFFER);
            PacketTracker.add();
            this.send(binary);
            return;
        }

        this.sendEncrypted(type, this.DATA_BUFFER);
    }

    sendMsg: SendMsgSignature = (type: keyof MOOMOO_CLIENT_TO_SERVER_MAP, arg1?: unknown, arg2?: unknown, arg3?: unknown) => {
        this.populateBuffer(arg1, arg2, arg3);

        if (this.readyState !== WebSocket.OPEN) return;
        if (!this.manager.manage(type, this.DATA_BUFFER)) return;

        const delay = this.getArtificialDelay();

        if (!delay) {
            this.sendActualMsg(type);
            return;
        }

        arg1 = this.DATA_BUFFER[0];
        arg2 = this.DATA_BUFFER[1];
        arg3 = this.DATA_BUFFER[2];

        TaskScheduler.setTimeout(() => {
            this.populateBuffer(arg1, arg2, arg3);
            this.sendActualMsg(type);
        }, delay);
    }

    private binaryPacketBuffer = new Uint8Array(1024);

    private sendEncrypted(type: keyof MOOMOO_CLIENT_TO_SERVER_MAP, data: unknown[]) {
        const encryptPacketId = this.manager.tables?.c2s.encrypt[type];
        if (encryptPacketId === undefined) return;

        const currentSequence = ++this.manager.sequence;
        const packetData = CustomEncoder.encode(type, encryptPacketId, data, currentSequence);
        const binaryLength = PacketManager.PACKET_PADDING + packetData.length;
        if (binaryLength > this.binaryPacketBuffer.length) this.binaryPacketBuffer = new Uint8Array(binaryLength * 2);
        const bufferSlice = this.binaryPacketBuffer.subarray(0, binaryLength);
        const signatureBuff = this.manager.getPacketSignature(packetData);

        const signature = signatureBuff[0];
        const signatureUint = signatureBuff[1];

        bufferSlice.set(signature, 0);
        bufferSlice.set(packetData, PacketManager.PACKET_PADDING);
        this.manager.maskOutcoming(bufferSlice, signatureUint);

        this.send(bufferSlice);
        PacketTracker.add();
    }
}