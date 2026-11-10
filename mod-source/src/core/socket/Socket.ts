import { deathText } from "@core/Client";
import GameEventTracker from "@core/mod/utils/GameEventTracker";
import CustomEncoder from "@core/socket/CustomEncoder";
import LegacyAdapter from "@core/socket/LegacyAdapter";
import Protocol from "@core/socket/Protocol";
import PlayerUpdateEvent from "@core/socket/events/core/PlayerUpdateEvent";
import SocketListener from "@core/socket/SocketListener";
import { MooMooProtocol } from "@core/utils/CaptchaManager";
import PacketBatcher from "@core/utils/PacketBatcher";
import PacketManager from "@core/utils/PacketManager";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import { decode } from "@msgpack/msgpack";
import PacketMap, { MOOMOO_CLIENT_TO_SERVER_MAP, MOOMOO_SERVER_TO_CLIENT_MAP } from "@root/utils/socket/PacketMap";
import TaskScheduler from "@services/event-timer/TaskScheduler";
import PacketRecorder from "@services/packet-recorder/PacketRecorder";
import { enterGameBtn } from "@ui/Hook";
import { gameUI, respawnPage } from "@ui/Loader";
import getElem from "@utils/dom/getElem";

type EventKey = keyof MOOMOO_SERVER_TO_CLIENT_MAP;
type EventCallback<K extends EventKey> = (...args: MOOMOO_SERVER_TO_CLIENT_MAP[K]) => void;

export type SendMsgSignature = <K extends keyof MOOMOO_CLIENT_TO_SERVER_MAP>(
    type: K,
    ...args: MOOMOO_CLIENT_TO_SERVER_MAP[K]
) => void;

const disconnectedPage = getElem("disconnected-page");
const disconnectedReason = getElem("disconnected-reason");
export const disconnectedPageElem = disconnectedPage;
export const respawnMainCard = getElem("respawn-page-main-card");

export type MixKeyFunc = (key: Uint8Array, offset: number) => Uint8Array;

// Some hosts (moomodding) replace window.WebSocket with a wrapper *function* that returns a plain
// socket. Extending that wrapper would lose all of Socket's methods, so extend the real class.
// The wrapper keeps the native prototype, so prototype-level hooks (e.g. account auth) still apply.
const NativeWebSocket = WebSocket.prototype.constructor as typeof WebSocket;

export default class Socket extends NativeWebSocket {
    private handlers: {
        [K in EventKey]?: EventCallback<K>
    } = {};

    private manager = new PacketManager();
    private socketProtocol?: MooMooProtocol;

    isPrivateServer = false;
    usePlainPackets = false;

    constructor(url: string, socketProtocol?: MooMooProtocol) {
        super(url);

        this.socketProtocol = socketProtocol;
        this.binaryType = "arraybuffer";
        // Marks Falcon's socket so the Quick Inject hook-mode guard never closes it.
        (this as any).__falcon = true;
        // Local dev server: no item limits, all upgrades allowed.
        this.isPrivateServer = url.includes("localhost");
        // Plain unencrypted msgpack: local dev servers and 1.8.2 hosts.
        this.usePlainPackets = this.isPrivateServer || Protocol.isLegacy;
        LegacyAdapter.reset();

        this.onopen = (ev) => this.onOpen(ev);
        this.onmessage = (ev) => this.onMessage(ev);
        this.onclose = (ev) => this.onClose(ev);
    }

    private onClose(ev: CloseEvent) {
        // Can't join on a closed socket; re-enabled when the next socket opens.
        enterGameBtn.classList.add("disabled");
        respawnPage.style.display = "flex";
        disconnectedPage.style.display = "flex";
        respawnMainCard.style.display = "none";
        deathText.style.display = "none";
        gameUI.style.display = "none";

        disconnectedReason.innerText = ev.reason || "No reason provided";
    }

    private onOpen(_ev: Event) {
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

    processPacket(type: any, data: any[]) {
        const artificialPing = Menu.getValue("artificialPing");
        const parsedAmt = parseInt(Menu.getValue("artificialPingAmt"));
        const artificialPingAmt = isNaN(parsedAmt) ? 20 : parsedAmt;

        if (!artificialPing) {
            this.dispatch(type, data);
            return;
        }

        TaskScheduler.setTimeout(() => {
            this.dispatch(type, data);
        }, artificialPingAmt / 2);
    }

    private onMessage(ev: MessageEvent) {
        const bytes = new Uint8Array(ev.data);
        this.manager.maskIncoming(bytes);

        const parsed = decode(bytes) as any[];

        if (parsed[0] === "io-init") {
            // 1.8.2 only sends [socketId]; encryption setup only exists on 1.9.x.
            if (this.usePlainPackets || !this.socketProtocol) return;

            const [id, seed, salt] = parsed[1] as MOOMOO_SERVER_TO_CLIENT_MAP["io-init"];
            this.manager.init(id, seed, salt, this.socketProtocol);
            return;
        }

        if (Protocol.isLegacy) {
            // Reshape 1.8.2 layouts into the ones Falcon's handlers expect.
            if (parsed[0] === PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS) parsed[1] = LegacyAdapter.players(parsed[1][0]);
            else if (parsed[0] === PacketMap.SERVER_TO_CLIENT.LOAD_AI) parsed[1] = LegacyAdapter.ais(parsed[1][0]);
        }

        if (this.manager.tables && typeof parsed[0] === "number") {
            parsed[0] = this.manager.tables.s2c.decrypt[parsed[0]];
            if (parsed[0] === undefined) return;
        }

        if (PacketBatcher.UI_PACKETS.has(parsed[0])) {
            this.processPacket(parsed[0], parsed[1]);
            return;
        }

        if (parsed[0] === PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS) {
            PlayerUpdateEvent.lastReceive = PlayerUpdateEvent.lastRealReceive = performance.now();
        }

        if (GameEventTracker.TRACKABLE_PACKETS.has(parsed[0])) {
            const data = parsed[1];
            const sid = parsed[0] === PacketMap.SERVER_TO_CLIENT.ADD_PROJECTILE ? data[7] : data[0];
            GameEventTracker.updateTracker(sid, parsed[0]);
        }

        PacketBatcher.add(parsed[0], parsed[1]);
    }

    private dispatch<K extends keyof MOOMOO_SERVER_TO_CLIENT_MAP>(
        type: K,
        data: unknown
    ) {
        SocketListener.logPacket(type, data as any[]);

        const callback = this.handlers[type];
        if (!callback) return;

        const typedData = data as MOOMOO_SERVER_TO_CLIENT_MAP[K];
        callback(...typedData);
    }

    on<K extends EventKey>(event: K, callback: EventCallback<K>) {
        (this.handlers as any)[event] = callback;
    }

    private DATA_BUFFER: any[] = [null, null, null];

    private populateBuffer(arg1?: any, arg2?: any, arg3?: any) {
        let len = 0;

        if (arg1 !== undefined) { this.DATA_BUFFER[0] = arg1; len = 1; }
        if (arg2 !== undefined) { this.DATA_BUFFER[1] = arg2; len = 2; }
        if (arg3 !== undefined) { this.DATA_BUFFER[2] = arg3; len = 3; }

        this.DATA_BUFFER.length = len;
        return len;
    }

    private sendActualMsg(type: any) {
        if (this.usePlainPackets) {
            const binary = CustomEncoder.encode(type, type, this.DATA_BUFFER);
            PacketTracker.add();
            this.send(binary);
            return;
        }

        this.sendEncrypted(type, this.DATA_BUFFER);
    }

    sendMsg: SendMsgSignature = (type: any, arg1?: any, arg2?: any, arg3?: any) => {
        this.populateBuffer(arg1, arg2, arg3);

        if (this.readyState !== WebSocket.OPEN) return;
        if (!this.manager.manage(type, this.DATA_BUFFER)) return;

        const artificialPing = Menu.getValue("artificialPing");
        const parsedAmt = parseInt(Menu.getValue("artificialPingAmt"));
        const artificialPingAmt = isNaN(parsedAmt) ? 20 : parsedAmt;

        if (!artificialPing) {
            this.sendActualMsg(type);
            return;
        }

        arg1 = this.DATA_BUFFER[0];
        arg2 = this.DATA_BUFFER[1];
        arg3 = this.DATA_BUFFER[2];

        TaskScheduler.setTimeout(() => {
            this.populateBuffer(arg1, arg2, arg3);
            this.sendActualMsg(type);
        }, artificialPingAmt / 2);
    }

    private binaryPacketBuffer = new Uint8Array(1024);

    private sendEncrypted(type: any, data: any[]) {
        const encryptPacketId = this.manager.tables?.c2s.encrypt[type];
        if (encryptPacketId === undefined) return;

        const currentSequence = ++this.manager.sequence;
        const packetData = CustomEncoder.encode(type, encryptPacketId, data, currentSequence);
        const binaryLength = PacketManager.PACKET_PADDING + packetData.length;
        const bufferSlice = this.binaryPacketBuffer.subarray(0, binaryLength);
        const signatureBuff = this.manager.getPacketSignature(packetData as any);

        const signature = signatureBuff[0];
        const signatureUint = signatureBuff[1];

        bufferSlice.set(signature, 0);
        bufferSlice.set(packetData, PacketManager.PACKET_PADDING);
        this.manager.maskOutcoming(bufferSlice, signatureUint);

        this.send(bufferSlice);
        PacketTracker.add();
    }
}