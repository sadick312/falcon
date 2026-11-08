// Micro-benchmark for the per-packet hot paths. Runs with `npm run bench` (or alone: `npm run bench -- packets`) and
// writes mod-source/bench/results/packets.json. The per-tick logic is measured by replay.bench-run.ts, which times
// every step of a real tick; this covers what runs once per sent or received packet.
//
// Each case runs a warm-up, then 5 timed rounds; the best round counts (the least disturbed by other work on the PC).
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { it } from "vitest";
import { benchDir } from "./replay";

interface Row { name: string; usPerCall: number; callsPerRound: number }

function time(name: string, calls: number, fn: () => void): Row {
    for (let i = 0; i < calls / 10; i++) fn();
    let best = Infinity;
    for (let round = 0; round < 5; round++) {
        const start = performance.now();
        for (let i = 0; i < calls; i++) fn();
        best = Math.min(best, performance.now() - start);
    }
    return { name, usPerCall: (best / calls) * 1000, callsPerRound: calls };
}

it("per-packet hot paths", async () => {
    localStorage.setItem("falcon-host-mode", "moomodding");
    await import("@core/socket/SocketListener");
    const { default: CustomEncoder } = await import("@core/socket/CustomEncoder");
    const { default: PacketManager, xorPacket } = await import("@core/utils/PacketManager");
    const { default: LegacyPacketAdapter } = await import("@core/socket/LegacyPacketAdapter");
    const { Decoder, encode } = await import("@msgpack/msgpack");
    const { default: PacketBatcher } = await import("@core/utils/PacketBatcher");

    const SALT = "00112233445566778899aabbccddeeff";
    const legacy = new PacketManager();
    legacy.initLegacy(12345, SALT);
    const manager = new PacketManager();

    const hit = CustomEncoder.encode("F", 4, [1, 0.5], 7).slice();
    const players: number[] = [];
    for (let p = 0; p < 10; p++) players.push(p, 1000 + p, 2000, 1.2, -1, 5, 2, 0, 0, 0, 0, 0, 0);
    const playerUpdate = encode(["a", [players]]).slice();
    const decoder = new Decoder();
    const adapter = new LegacyPacketAdapter();
    const bytes = new Uint8Array(64);
    let dir = 0;

    // PacketBatcher's own cost for one tick's batch: 20 packets queued, then ordered and handed on (to a socket that
    // does nothing, so only the batcher is timed). The batcher is driven directly: isPolling stays on so no
    // MessageChannel round trip is started, and flush() is private.
    type BatcherInternals = { isPolling: boolean; flush(): void; init(socket: unknown): void };
    const batcher = PacketBatcher as unknown as BatcherInternals;
    batcher.init({ processPacket() { }, readyState: 3 });
    batcher.isPolling = true;
    const tickBatch = () => {
        for (let i = 0; i < 19; i++) PacketBatcher.add("O", [i, 100]);
        PacketBatcher.add("a", [players, [], []]);
        batcher.flush();
    };

    const rows = [
        time("CustomEncoder.encode: move (fast path)", 200_000, () => { CustomEncoder.encode("9", "9", [1.5]); }),
        time("CustomEncoder.encode: hit + sequence (fast path)", 200_000, () => { CustomEncoder.encode("F", 4, [1, 0.5], 7); }),
        time("CustomEncoder.encode: chat (msgpack library)", 100_000, () => { CustomEncoder.encode("6", "6", ["hello there"]); }),
        time("PacketManager.getPacketSignature (HMAC-SHA256)", 20_000, () => { legacy.getPacketSignature(hit); }),
        time("xorPacket: v1.9.0 mask, 64 bytes", 200_000, () => { xorPacket(bytes, 99); }),
        time("PacketManager.manage: move de-dup", 200_000, () => { manager.manage("9", [dir++ & 1]); }),
        time("msgpack decode: 10-player update", 50_000, () => { decoder.decode(playerUpdate); }),
        time("LegacyPacketAdapter.adapt: 10-player update", 50_000, () => { adapter.adapt("a", [players]); }),
        time("PacketBatcher: queue + order + hand on a 20-packet tick", 50_000, tickBatch)
    ];

    fs.mkdirSync(path.join(benchDir, "results"), { recursive: true });
    fs.writeFileSync(path.join(benchDir, "results", "packets.json"), JSON.stringify({ date: new Date().toISOString(), rows }, null, 2));
    console.log(rows.map(r => `${r.name.padEnd(52)} ${r.usPerCall.toFixed(3).padStart(8)} us`).join("\n"));
}, 120_000);
