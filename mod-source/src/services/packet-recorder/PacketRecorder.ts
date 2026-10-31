import Client from "@core/Client";
import { Encoder } from "@msgpack/msgpack";
import { PacketLog } from "@root/utils/socket/PacketLogging";
import PacketMap from "@root/utils/socket/PacketMap";

export default class PacketRecorder {
    private static readonly TOTAL_SLOTS = 15;
    static readonly PERMANENT_PACKETS = new Set<string>([
        PacketMap.SERVER_TO_CLIENT.ADD_PLAYER,
        PacketMap.SERVER_TO_CLIENT.SET_ALLIANCE_PLAYERS,
        PacketMap.SERVER_TO_CLIENT.SET_INIT_DATA,
        PacketMap.SERVER_TO_CLIENT.SET_PLAYER_TEAM,
        PacketMap.SERVER_TO_CLIENT.SET_UP_GAME
    ]);

    static readonly IGNORED_PACKETS = new Set<string>([
        PacketMap.SERVER_TO_CLIENT.UPDATE_STORE_ITEMS
    ]);

    /**
     * Keyed by packet type, or by player id for ADD_PLAYER logs. Ids are ~20-character socket ids, so they
     * can't clash with the one-letter packet types; one map keeps the export's insertion order.
     */
    private static permanentData = new Map<string, PacketLog>();
    private static encoder = new Encoder();
    private static timeSlots: PacketLog[][] = Array.from({ length: PacketRecorder.TOTAL_SLOTS }, () => []);

    private static slotIndex = 0;
    private static lastSlotTime = 0;
    private static isInitialized = false;

    static init() {
        if (this.isInitialized) return;

        this.isInitialized = true;
        this.lastSlotTime = performance.now();
        window.setInterval(() => this.advanceSlots(performance.now()), 1000);
    }

    private static advanceSlots(now: number) {
        const elapsed = Math.floor((now - this.lastSlotTime) / 1e3);
        if (elapsed <= 0) return;

        const slotsToClear = Math.min(elapsed, this.timeSlots.length);
        for (let i = 1; i <= slotsToClear; i++) {
            const index = (this.slotIndex + i) % this.timeSlots.length;
            this.updatePermanentData(this.timeSlots[index]);
            this.timeSlots[index].length = 0;
        }

        this.slotIndex = (this.slotIndex + elapsed) % this.timeSlots.length;
        this.lastSlotTime += elapsed * 1e3;
    }

    private static updatePermanentData(packetData: PacketLog[]) {
        for (let i = 0; i < packetData.length; i++) {
            const log = packetData[i];
            const packet = log.packetData!;

            if (packet.type === PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS) {
                // Logged after LegacyPacketAdapter, so always [positions (sid, x, y, dir) * n, attributes, hidden].
                const positions = (packet.data as unknown[])[0];
                if (!Array.isArray(positions)) continue;

                for (let j = 0; j + 3 < positions.length; j += 4) {
                    const playerId = this.sidToIdMap[positions[j] as number];
                    const logData = this.permanentData.get(playerId);
                    if (!logData || logData.packetData.type !== PacketMap.SERVER_TO_CLIENT.ADD_PLAYER) continue;

                    // Move the player's saved spawn (ADD_PLAYER [PlayerInitType, isYou]) to where they were last seen.
                    const init = logData.packetData.data[0];
                    init[3] = positions[j + 1];
                    init[4] = positions[j + 2];
                }
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.KILL_OBJECT) {
                // continue, not return: the rest of this second's packets still need their bookkeeping.
                const gameObjectsMap = this.permanentData.get(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT);
                if (!gameObjectsMap) continue;

                const packetData = gameObjectsMap.packetData!;
                if (packetData.type !== PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT) continue;

                const gameObjects = packetData.data[0];

                for (let i = 0; i < gameObjects.length; i += 8) {
                    if (gameObjects[i] === packet.data[0]) {
                        gameObjects.splice(i, 8);
                        break;
                    }
                }
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.KILL_OBJECTS) {
                const gameObjectsMap = this.permanentData.get(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT);
                if (!gameObjectsMap) continue;

                const packetData = gameObjectsMap.packetData!;
                if (packetData.type !== PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT) continue;

                const gameObjects = packetData.data[0];

                for (let i = 0; i < gameObjects.length; i += 8) {
                    if (gameObjects[i + 7] === packet.data[0]) {
                        gameObjects.splice(i, 8);
                        i -= 8;
                    }
                }
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.ADD_PLAYER) {
                // data[0] is the whole PlayerInitType array here, so this key never matches a player id
                // lookup (as with the old `player_${data[0]}` key); kept as is so exports don't change.
                this.permanentData.set(String(packet.data[0]), log);
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.REMOVE_PLAYER) {
                const playerId = packet.data[0];
                const playerSid = this.idToSidMap[playerId];

                this.permanentData.delete(playerId);
                delete this.idToSidMap[playerId];
                delete this.sidToIdMap[playerSid];
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT) {
                const gameObjectsMap = this.permanentData.get(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT);

                if (!gameObjectsMap) {
                    this.permanentData.set(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT, log);
                } else {
                    const packetData = gameObjectsMap.packetData!;

                    if (packetData.type == PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT) {
                        // A loop, not push(...list): spreading passes every number as an argument, which throws
                        // once a packet holds more than about a hundred thousand of them.
                        const saved = packetData.data[0];
                        const added = packet.data[0];
                        for (let j = 0; j < added.length; j++) saved.push(added[j]);
                    }
                }
            }
        }
    }

    private static idToSidMap: Record<string, number> = {};
    private static sidToIdMap: Record<number, string> = {};

    /** False when add() would drop the packet, so callers can skip building the log object. */
    static shouldRecord(packetId: string) {
        return this.isInitialized && !this.IGNORED_PACKETS.has(packetId);
    }

    static add(packetId: string, log: PacketLog) {
        if (!this.shouldRecord(packetId)) return;
        this.advanceSlots(log.timestamp);

        if (!this.PERMANENT_PACKETS.has(packetId)) {
            this.timeSlots[this.slotIndex].push(log);
            return;
        }

        if (!log.packetData) throw new Error("");
        const { type, data } = log.packetData;

        if (type === PacketMap.SERVER_TO_CLIENT.ADD_PLAYER) {
            const playerId = data[0][0];
            const playerSid = data[0][1];

            this.idToSidMap[playerId] = playerSid;
            this.sidToIdMap[playerSid] = playerId;

            if (playerSid === Client.mySID) {
                log.timestamp = performance.now() - 15e3;
            }

            if (this.permanentData.has(playerId)) {
                this.timeSlots[this.slotIndex].push(log);
                return;
            }

            this.permanentData.set(playerId, log);
        } else if (type === PacketMap.SERVER_TO_CLIENT.SET_UP_GAME) {
            this.permanentData.set(PacketMap.SERVER_TO_CLIENT.SET_UP_GAME, log);
        } else if (type === PacketMap.SERVER_TO_CLIENT.SET_INIT_DATA) {
            this.permanentData.set(PacketMap.SERVER_TO_CLIENT.SET_INIT_DATA, log);
        } else if (type === PacketMap.SERVER_TO_CLIENT.SET_ALLIANCE_PLAYERS) {
            this.permanentData.set(PacketMap.SERVER_TO_CLIENT.SET_ALLIANCE_PLAYERS, log);
        } else if (type === PacketMap.SERVER_TO_CLIENT.SET_PLAYER_TEAM) {
            this.permanentData.set(PacketMap.SERVER_TO_CLIENT.SET_PLAYER_TEAM, log);
        }
    }

    static compileBinaryLog(): Uint8Array<ArrayBuffer> | null {
        this.advanceSlots(performance.now());

        const historicalPackets = [
            ...this.timeSlots.slice(this.slotIndex + 1),
            ...this.timeSlots.slice(0, this.slotIndex + 1)
        ].flat();

        if (historicalPackets.length === 0) return null;

        const baseTimestamp = historicalPackets[0].timestamp;
        const permanentPackets = Array.from(this.permanentData.values());

        for (let i = 0; i < permanentPackets.length; i++) {
            if (permanentPackets[i].timestamp < baseTimestamp)
                permanentPackets[i].timestamp = baseTimestamp;
        }

        const allPackets = [...permanentPackets, ...historicalPackets].sort((a, b) => a.timestamp - b.timestamp);

        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        for (let i = 0, len = allPackets.length; i < len; i++) {
            const packet = allPackets[i];

            const timestampBuf = new Uint8Array(8);
            new DataView(timestampBuf.buffer).setFloat64(0, packet.timestamp, true);
            chunks.push(timestampBuf);
            totalLength += 8;

            const packetBuffer = this.encoder.encode([packet.packetData.type, packet.packetData.data]);
            const packetLengthBuf = new Uint8Array(4);
            new DataView(packetLengthBuf.buffer).setInt32(0, packetBuffer.length, true);

            chunks.push(packetLengthBuf, packetBuffer);
            totalLength += 4 + packetBuffer.length;

            if (packet.brainState) {
                const brainBuffer = this.encoder.encode(packet.brainState);

                const brainLengthBuf = new Uint8Array(4);
                new DataView(brainLengthBuf.buffer).setInt32(0, brainBuffer.length, true);

                chunks.push(brainLengthBuf, brainBuffer);
                totalLength += 4 + brainBuffer.length;
            } else {
                const zeroLengthBuf = new Uint8Array(4);
                new DataView(zeroLengthBuf.buffer).setInt32(0, 0, true);

                chunks.push(zeroLengthBuf);
                totalLength += 4;
            }
        }

        const resultBuffer = new Uint8Array(totalLength);

        let offset = 0;
        for (const chunk of chunks) {
            resultBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        return resultBuffer;
    }
}