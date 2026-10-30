import Client from "@core/Client";
import PlayerUpdateEvent from "@core/socket/events/core/PlayerUpdateEvent";
import Socket from "@core/socket/Socket";
import { IncomingServerPackets } from "@root/utils/socket/PacketLogging";
import PacketMap, { MOOMOO_SERVER_TO_CLIENT_MAP } from "@root/utils/socket/PacketMap";
import ScriptConfig from "@utils/config/ScriptConfig";

export default class PacketBatcher {
    private static buffer: IncomingServerPackets[] = [];
    private static lastPacketCollected = performance.now();
    private static channel = new MessageChannel();

    private static isPolling = false;
    static readonly BATCH_WINDOW = .5;

    static effectiveBatchWindow = .5; // relative to updatePlayers
    static realBatchWindow = .5; // relative to the actual last packet received

    static PACKET_SCORING = new Map<string, number>([
        [PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS, 0]
    ]);

    static UI_PACKETS = new Set([
        PacketMap.SERVER_TO_CLIENT.PING_RESPONSE, PacketMap.SERVER_TO_CLIENT.PING_MAP,
        PacketMap.SERVER_TO_CLIENT.UPDATE_MINIMAP, PacketMap.SERVER_TO_CLIENT.UPDATE_LEADERBOARD
    ]);

    /** Smoothed deviation of real UPDATE_PLAYERS arrivals from the server tick rate (ms). High on Wi-Fi. */
    static tickJitter = 0;
    private static lastRealTick = 0;
    private static readonly MIN_FAKE_MARGIN = 5;
    private static readonly MAX_FAKE_MARGIN = 40;

    private static watchdogTimer: number | null = null;
    private static socket: Socket;
    private static emptyPacketData = [[], [], []];

    static init(socket: Socket) {
        this.socket = socket;
        this.channel.port1.onmessage = () => this.poll();
    }

    private static trackTickJitter(now: number) {
        const interval = now - this.lastRealTick;
        this.lastRealTick = now;

        // Skip long gaps (tab in background, respawn) so they don't inflate the estimate.
        if (interval > 1e3) return;

        const deviation = Math.abs(interval - ScriptConfig.SERVER_UPDATE_SPEED);
        this.tickJitter += (deviation - this.tickJitter) / 8;
    }

    /**
     * How late a tick may be before a fake one is emitted. A fixed 5ms margin made jittery
     * connections run an extra fake tick and then the real one, so actions doubled and positions snapped back.
     */
    private static getFakeUpdateThreshold() {
        const margin = Math.min(this.MAX_FAKE_MARGIN, Math.max(this.MIN_FAKE_MARGIN, this.tickJitter * 2));
        return ScriptConfig.SERVER_UPDATE_SPEED + margin;
    }

    private static getPacketPriority(type: string) {
        return this.PACKET_SCORING.get(type) ?? 100;
    }

    private static flush() {
        const now = performance.now();
        if (!this.socket) return;

        let needFakeUpdate = true;
        this.buffer.sort((a, b) => this.getPacketPriority(b.type) - this.getPacketPriority(a.type));
        this.realBatchWindow = now - this.lastPacketCollected;

        for (let i = 0, len = this.buffer.length; i < len; i++) {
            const packet = this.buffer[i];

            try {
                if (packet.type === PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS) {
                    this.trackTickJitter(now);
                    this.effectiveBatchWindow = now - PlayerUpdateEvent.lastReceive;
                    PlayerUpdateEvent.lastReceive = now;
                    needFakeUpdate = false;
                }

                this.socket.processPacket(packet.type, packet.data);
            } catch (e) {
                console.error(e);
            }
        }

        this.buffer.length = 0;
        if (!needFakeUpdate) {
            this.armWatchdog();
        } else {
            this.checkAndEmitFakeUpdate(now);
        }
    }

    private static armWatchdog() {
        if (this.watchdogTimer !== null) {
            clearTimeout(this.watchdogTimer);
            this.watchdogTimer = null;
        }

        if (!Client.player) return;

        const interval = this.getFakeUpdateThreshold();
        this.watchdogTimer = setTimeout(() => {
            this.checkAndEmitFakeUpdate(performance.now());
        }, interval);
    }

    private static checkAndEmitFakeUpdate(now: number) {
        if (!Client.player || !this.socket) return;

        const timeSinceLast = now - PlayerUpdateEvent.lastReceive;
        const threshold = this.getFakeUpdateThreshold();

        if (timeSinceLast >= threshold) {
            PlayerUpdateEvent.lastReceive = now - 5;

            try {
                this.socket.processPacket(PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS, this.emptyPacketData);
            } catch (e) {
                console.error(e);
            }
        }

        this.armWatchdog();
    }

    static add<K extends keyof MOOMOO_SERVER_TO_CLIENT_MAP>(type: K, data: MOOMOO_SERVER_TO_CLIENT_MAP[K]) {
        // TypeScript cannot match a generic K to one member of the union, but { type: K, data: Map[K] } is one.
        this.buffer.push({ type, data } as IncomingServerPackets);
        this.lastPacketCollected = performance.now();

        if (!this.isPolling) {
            this.isPolling = true;
            this.channel.port2.postMessage(null);
        }
    }

    private static poll() {
        const dt = performance.now() - this.lastPacketCollected;

        if (dt >= this.BATCH_WINDOW) {
            this.flush();
            this.isPolling = false;
        } else {
            this.channel.port2.postMessage(null);
        }
    }
}