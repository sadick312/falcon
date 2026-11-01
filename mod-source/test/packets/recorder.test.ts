// Packet logs: what PacketRecorder exports (!plog, save on death) must read back in the replayer.
import type PacketReplayerType from "@core/PacketReplayer";
import type PacketRecorderType from "@services/packet-recorder/PacketRecorder";
import { PacketLog } from "@root/utils/socket/PacketLogging";
import PacketMap from "@root/utils/socket/PacketMap";
import { beforeEach, describe, expect, it, vi } from "vitest";

const S2C = PacketMap.SERVER_TO_CLIENT;

// Both are static singletons; each test gets fresh copies so recorded packets don't carry over.
let PacketRecorder: typeof PacketRecorderType;
let PacketReplayer: typeof PacketReplayerType;

/** The replayer's parser is private; this is the same call its file loader makes. */
function readLog(bytes: Uint8Array): PacketLog[] {
    const replayer = PacketReplayer as unknown as { decompileBinaryFormat(b: ArrayBuffer): void; allData: PacketLog[] };
    replayer.decompileBinaryFormat(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    return [...replayer.allData];
}

let now = 0;
const log = (type: string, data: unknown, brainState?: unknown) =>
    PacketRecorder.add(type, { timestamp: now, brainState, packetData: { type, data } } as PacketLog);

beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    now = 1000;

    vi.resetModules();
    PacketRecorder = (await import("@services/packet-recorder/PacketRecorder")).default;
    PacketReplayer = (await import("@core/PacketReplayer")).default;
    PacketRecorder.init();
});

describe("PacketRecorder -> PacketReplayer", () => {
    it("writes a log the replayer reads back with the same packets, times and brain states", () => {
        log(S2C.SET_UP_GAME, [7]);
        now += 100;
        log(S2C.UPDATE_HEALTH, [7, 80]);
        now += 100;
        log(S2C.UPDATE_PLAYERS, [[7, 1, 2, 3], [], []], { tick: 12, mode: "none" });

        const packets = readLog(PacketRecorder.compileBinaryLog()!);
        const byType = Object.fromEntries(packets.map((p) => [p.packetData.type, p]));

        expect(byType[S2C.UPDATE_HEALTH].packetData.data).toEqual([7, 80]);
        expect(byType[S2C.UPDATE_PLAYERS].brainState).toEqual({ tick: 12, mode: "none" });
        expect(byType[S2C.UPDATE_HEALTH].brainState).toBeNull();
        // In time order; permanent packets are moved up to the first recorded time.
        const times = packets.map((p) => p.timestamp);
        expect(times).toEqual([...times].sort((a, b) => a - b));
    });

    it("leaves out ignored packets", () => {
        log(S2C.UPDATE_STORE_ITEMS, [0, 1, 0]);
        log(S2C.UPDATE_HEALTH, [1, 50]);
        const types = readLog(PacketRecorder.compileBinaryLog()!).map((p) => p.packetData.type);
        expect(types).not.toContain(S2C.UPDATE_STORE_ITEMS);
        expect(PacketRecorder.shouldRecord(S2C.UPDATE_STORE_ITEMS)).toBe(false);
    });

    it("drops packets older than the 15 second window but keeps the permanent ones", () => {
        log(S2C.SET_INIT_DATA, [{ teams: [] }]);
        log(S2C.UPDATE_HEALTH, [1, 10]);
        now += 20_000;
        log(S2C.UPDATE_HEALTH, [1, 20]);

        const packets = readLog(PacketRecorder.compileBinaryLog()!);
        const health = packets.filter((p) => p.packetData.type === S2C.UPDATE_HEALTH).map((p) => p.packetData.data);
        expect(health).toEqual([[1, 20]]);
        expect(packets.some((p) => p.packetData.type === S2C.SET_INIT_DATA)).toBe(true);
    });

    // [id, sid, name, x, y, dir, health, maxHealth, scale, skinColor]
    const addPlayer = (id: string, sid: number) => log(S2C.ADD_PLAYER, [[id, sid, "p", 100, 100, 0, 100, 100, 35, 0], false]);
    const savedSpawns = (packets: PacketLog[]) => packets
        .filter((p) => p.packetData.type === S2C.ADD_PLAYER)
        .map((p) => (p.packetData.data as [unknown[]])[0]);

    it("moves a player's saved spawn to where they were last seen once older packets age out", () => {
        addPlayer("enemy", 7);
        now += 100;
        log(S2C.UPDATE_PLAYERS, [[7, 500, 600, 0], [], []]);
        now += 20_000;
        log(S2C.UPDATE_HEALTH, [7, 90]);

        const [spawn] = savedSpawns(readLog(PacketRecorder.compileBinaryLog()!));
        expect(spawn.slice(0, 5)).toEqual(["enemy", 7, "p", 500, 600]);
    });

    it("keeps one saved spawn per player across respawns", () => {
        // A respawn used to be saved under the whole spawn array as its key, so each one added another entry.
        addPlayer("enemy", 7);
        now += 100;
        addPlayer("enemy", 7);
        now += 20_000;
        log(S2C.UPDATE_HEALTH, [7, 90]);
        now += 100;
        addPlayer("enemy", 7);
        now += 20_000;
        log(S2C.UPDATE_HEALTH, [7, 90]);

        expect(savedSpawns(readLog(PacketRecorder.compileBinaryLog()!)).map(s => s[0])).toEqual(["enemy"]);
    });

    it("forgets a respawned player who then left", () => {
        addPlayer("enemy", 7);
        now += 100;
        addPlayer("enemy", 7);
        now += 20_000;
        log(S2C.REMOVE_PLAYER, ["enemy"]);
        now += 20_000;
        log(S2C.UPDATE_HEALTH, [1, 90]);

        expect(savedSpawns(readLog(PacketRecorder.compileBinaryLog()!))).toEqual([]);
    });

    it("still forgets a player who left when an object kill came first in the same second", () => {
        addPlayer("enemy", 7);
        now += 100;
        // No LOAD_GAME_OBJECT was recorded, so there is no saved object list for this kill to edit.
        log(S2C.KILL_OBJECT, [123]);
        log(S2C.REMOVE_PLAYER, ["enemy"]);
        now += 20_000;
        log(S2C.UPDATE_HEALTH, [1, 90]);

        expect(savedSpawns(readLog(PacketRecorder.compileBinaryLog()!))).toEqual([]);
    });
});

describe("PacketReplayer log parser", () => {
    it("reads old recordings' 5-value \"Z\" as a placement marker and keeps the game's 1-value \"Z\"", () => {
        // Before the rename, PlacementSystem logged its markers as "Z" with x, y, angle, item, placement type.
        log("Z", [100, 200, 1.5, 6, 0]);
        now += 100;
        log(S2C.SERVER_RESTARTING, [65]);

        const packets = readLog(PacketRecorder.compileBinaryLog()!).map(entry => entry.packetData);
        expect(packets[0]).toEqual({ type: PacketMap.CUSTOM_PACKETS.SERVER_TO_CLIENT.ADD_PLACEMENT_MARKER, data: [100, 200, 1.5, 6, 0] });
        expect(packets[1]).toEqual({ type: S2C.SERVER_RESTARTING, data: [65] });
    });

    it("stops at a truncated log instead of throwing", () => {
        log(S2C.UPDATE_HEALTH, [1, 50]);
        log(S2C.UPDATE_HEALTH, [2, 60]);
        const bytes = PacketRecorder.compileBinaryLog()!;
        for (const cut of [1, 7, 13, bytes.length - 1]) {
            expect(() => readLog(bytes.subarray(0, cut))).not.toThrow();
        }
    });
});
