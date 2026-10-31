/**
 * Offline replay of recorded games (.fpl files from !plog) through the real client, shared by the replay benchmark
 * (replay.bench-run.ts) and the replay determinism test (mod-source/test/replay.test.ts). Must run inside Vitest
 * with jsdom: it uses vi to reset modules and fake timers.
 *
 * Time is replayed from the recording's timestamps with fake timers and Math.random is seeded, so every run of the
 * same code on the same recording sends the same packets. Rendering is not part of a replay.
 */
import { createHash, Hash } from "crypto";
import fs from "fs";
import path from "path";
import { performance as realPerformance } from "perf_hooks";
import { fileURLToPath } from "url";
import { Decoder } from "@msgpack/msgpack";
import { vi } from "vitest";
import type { ProfileSummary } from "@services/profiler/Profiler";

export const benchDir = path.dirname(fileURLToPath(import.meta.url));
export const recordingsDir = path.join(benchDir, "recordings");
const gamePage = fs.readFileSync(path.join(benchDir, "..", "..", "public", "index.html"), "utf8");

export interface Packet { time: number; type: string; data: unknown[] }

/** The PacketRecorder.compileBinaryLog layout: f64 time, i32 length, msgpack [type, data], i32 length + brain state. */
export function readRecording(file: string): Packet[] {
    const bytes = fs.readFileSync(file);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new Decoder();
    const packets: Packet[] = [];

    for (let offset = 0; offset + 12 <= bytes.length;) {
        const time = view.getFloat64(offset, true);
        const length = view.getInt32(offset + 8, true);
        offset += 12;
        const [type, data] = decoder.decode(bytes.subarray(offset, offset + length)) as [string, unknown[]];
        offset += length;
        offset += 4 + view.getInt32(offset, true);
        packets.push({ time, type, data: Array.isArray(data) ? data : [] });
    }

    // Like PacketReplayer.start: permanent packets (time 0) first, the rest relative to the first real packet.
    const start = packets.find(p => p.time > 0)?.time ?? 0;
    for (const p of packets) p.time = p.time === 0 ? 0 : p.time - start;
    return packets;
}

function seededRandom(seed: number) {
    return () => {
        seed = seed + 1831565813 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export interface ReplayOptions {
    /** The "falcon-settings" localStorage value (menu settings) to replay with. */
    settings?: string | null;
    /** Turn the profiler on and return its measurements. */
    profile?: boolean;
    /** Also hash every AngleFinder.compute result (each angle's position, grade and flags), not only sent packets. */
    traceAngles?: boolean;
}

export interface ReplayResult {
    profile: Record<string, ProfileSummary>;
    ticks: number;
    /** Hash of every packet the mod tried to send, with the tick it was sent in. */
    fingerprint: string;
    /** Hash of every AngleFinder.compute result, with traceAngles. */
    angleFingerprint?: string;
    angleComputes: number;
    sentPackets: number;
    errors: string[];
}

interface TracedAngle {
    x: number; y: number; angle: number; id: number; grade: number;
    priority: boolean; dontUse: boolean; spikeTick: boolean; appleInsta: boolean; preplace: boolean; overlap: boolean;
    alignment: number; breaking: boolean; predict: boolean; replace: boolean; predictBoost: number;
    spikePush: Set<number>; pitSpike: Set<number>; kill: Set<number>; reasons: string[];
}

function hashAngles(hash: Hash, buffer: TracedAngle[], count: number) {
    let text = `${count}|`;
    for (let i = 0; i < count; i++) {
        const a = buffer[i];
        text += `${a.x},${a.y},${a.angle},${a.id},${a.grade},${a.alignment},${a.predictBoost},`
            + `${+a.priority}${+a.dontUse}${+a.spikeTick}${+a.appleInsta}${+a.preplace}${+a.overlap}${+a.breaking}${+a.predict}${+a.replace},`
            + `${[...a.spikePush]}/${[...a.pitSpike]}/${[...a.kill]}/${a.reasons.join(";")};`;
    }
    hash.update(text);
}

/** One replay in a fresh copy of every module, so no state carries over between runs. */
export async function replay(packets: Packet[], options: ReplayOptions = {}): Promise<ReplayResult> {
    vi.resetModules();
    document.documentElement.innerHTML = gamePage;
    localStorage.clear();
    if (options.settings) localStorage.setItem("falcon-settings", options.settings);

    vi.useFakeTimers({ now: 0, toFake: ["performance", "Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame"] });
    vi.spyOn(Math, "random").mockImplementation(seededRandom(1));

    const errors: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((...args) => { errors.push(args.map(String).join(" ")); });
    vi.spyOn(console, "log").mockImplementation(() => { });

    try {
        const profiler = await import("@services/profiler/Profiler");
        if (options.profile) profiler.enableProfiler({ overlay: false, keepSamples: true, clock: () => realPerformance.now() });

        // Same load order as the bundle, so the Socket <-> SocketListener cycle resolves.
        await import("@core/socket/SocketListener");
        // Loader.main's setup minus rendering: the menu loads the saved settings the modules read every tick.
        const { default: Menu } = await import("@menu/Menu");
        await Menu.init();
        const { default: Client } = await import("@core/Client");
        Client.mode = "replay";
        await Client.connect();

        const angleHash = options.traceAngles ? createHash("sha256") : null;
        let angleComputes = 0;
        if (angleHash) {
            const { default: AngleFinder } = await import("@placing/AngleFinder");
            const compute = AngleFinder.compute;
            AngleFinder.compute = function (...args: Parameters<typeof compute>) {
                const count = compute.apply(this, args);
                angleComputes++;
                hashAngles(angleHash, AngleFinder.angleBuffer as unknown as TracedAngle[], count);
                return count;
            };
        }

        const socket = Client.socket as unknown as { handlers: Record<string, (...args: unknown[]) => void>; sendMsg: (...args: unknown[]) => void };
        const sent: unknown[] = [];
        let tick = 0;
        socket.sendMsg = (type, ...args) => { sent.push([tick, type, args]); };

        let now = 0;
        for (const packet of packets) {
            if (packet.time > now) {
                vi.advanceTimersByTime(packet.time - now);
                now = packet.time;
            }

            const handler = socket.handlers[packet.type];
            if (!handler) continue;

            const start = profiler.profileStart();
            try {
                handler(...packet.data);
            } catch (err) {
                errors.push(`packet '${packet.type}': ${err instanceof Error ? err.message : String(err)}`);
            }
            profiler.profileEnd(`packet.${packet.type}`, start);
            if (packet.type === "a") tick++;
        }

        return {
            profile: options.profile ? profiler.profileSummary() : {},
            ticks: tick,
            fingerprint: createHash("sha256").update(JSON.stringify(sent)).digest("hex").slice(0, 16),
            angleFingerprint: angleHash?.digest("hex").slice(0, 16),
            angleComputes,
            sentPackets: sent.length,
            errors
        };
    } finally {
        consoleError.mockRestore();
        vi.useRealTimers();
        vi.restoreAllMocks();
    }
}
