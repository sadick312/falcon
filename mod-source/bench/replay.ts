/**
 * Offline replay of recorded games (.fpl files from !plog) through the real client, shared by the replay benchmark
 * (replay.bench-run.ts) and the replay determinism test (mod-source/test/replay.test.ts). Must run inside Vitest
 * with jsdom: it uses vi to reset modules and fake timers.
 *
 * Time is replayed from the recording's timestamps with fake timers and Math.random is seeded, so every run of the
 * same code on the same recording sends the same packets. Rendering is not part of a replay.
 *
 * Two ways to load the mod: "modules" imports the source files through Vitest, which rewrites every imported name into
 * a property lookup on a module object (slower in hot loops than the real bundle, but profiles point at source lines);
 * "bundle" replays an esbuild bundle of bench-entry.ts (built by build-bundle.mjs) like the production one with
 * __DEV__ on, for timings.
 */
import { createHash, Hash } from "crypto";
import fs from "fs";
import path from "path";
import { performance as realPerformance } from "perf_hooks";
import { fileURLToPath, pathToFileURL } from "url";
import { Decoder } from "@msgpack/msgpack";
import { vi } from "vitest";
import type { ProfileSummary } from "@services/profiler/Profiler";

export const benchDir = path.dirname(fileURLToPath(import.meta.url));
export const recordingsDir = path.join(benchDir, "recordings");
export const bundlePath = path.join(benchDir, ".build", "bench-bundle.mjs");
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
    /** Also hash the whole game state after every server tick (players, objects, projectiles, animals, us, the brain). */
    traceState?: boolean;
    /** How to load the mod (see the top of this file). Default "modules". */
    mode?: "modules" | "bundle";
    /** Called after every server tick ("a" packet), with the loaded mod (used by the soak test to sample memory). */
    onTick?: (tick: number, mod: ModApi) => void;
}

export interface ModApi {
    profiler: typeof import("@services/profiler/Profiler");
    Menu: typeof import("@menu/Menu").default;
    Client: typeof import("@core/Client").default;
    AngleFinder: typeof import("@placing/AngleFinder").default;
    PlayerManager: typeof import("@core/logic/players/PlayerManager").default;
    ObjectManager: typeof import("@core/logic/ObjectManager").default;
    ProjectileManager: typeof import("@core/logic/ProjectileManager").default;
    ModManager: typeof import("@core/ModManager").default;
    AttackManager: typeof import("@core/mod/combat/core/AttackManager").default;
    CombatController: typeof import("@core/mod/combat/core/CombatController").default;
    ais: typeof import("@entities/Ai").ais;
    /** Only in "modules" mode (used by the hat report). */
    HatSystem?: typeof import("@core/mod/defense/defense-modules/HatSystem").default;
    DefenseSystem?: typeof import("@core/mod/defense/DefenseSystem").default;
}

async function loadMod(mode: "modules" | "bundle"): Promise<ModApi> {
    if (mode === "bundle") {
        // Built by build-bundle.mjs, the benchmark's globalSetup.
        if (!fs.existsSync(bundlePath)) throw new Error(`${bundlePath} is missing; run the benchmark with \`npm run bench\`.`);
        return await import(/* @vite-ignore */ pathToFileURL(bundlePath).href) as ModApi;
    }

    const profiler = await import("@services/profiler/Profiler");
    // Same load order as the bundle, so the Socket <-> SocketListener cycle resolves.
    await import("@core/socket/SocketListener");
    await import("@core/Connection");
    const { default: Menu } = await import("@menu/Menu");
    const { default: Client } = await import("@core/Client");
    const { default: AngleFinder } = await import("@placing/AngleFinder");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { default: ObjectManager } = await import("@core/logic/ObjectManager");
    const { default: ProjectileManager } = await import("@core/logic/ProjectileManager");
    const { default: ModManager } = await import("@core/ModManager");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
    const { ais } = await import("@entities/Ai");
    const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    return { profiler, Menu, Client, AngleFinder, PlayerManager, ObjectManager, ProjectileManager, ModManager, AttackManager, CombatController, ais, HatSystem, DefenseSystem };
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
    /** Hash of the game state after every server tick, with traceState. */
    stateFingerprint?: string;
    /** A readable summary of the state at the end, with traceState (shown when a fingerprint changes). */
    finalState?: StateSummary;
    errors: string[];
}

export interface StateSummary {
    players: number; objects: number; projectiles: number; animals: number;
    me: { sid: number; x: number; y: number; health: number; alive: boolean; weapon: number; hat: number; shame: number } | null;
}

interface TracedAngle {
    x: number; y: number; angle: number; id: number; grade: number;
    priority: boolean; dontUse: boolean; spikeTick: boolean; appleInsta: boolean; preplace: boolean; overlap: boolean;
    alignment: number; breaking: boolean; predict: boolean; replace: boolean; predictBoost: number;
    spikePush: Set<number>; pitSpike: Set<number>; kill: Set<number>; reasons: string[];
}

/**
 * The game state after one tick as text, in a fixed order: every known player (position, health, gear, team, shame,
 * trap), every object (sid, position, health), projectile and animal, our own flags, and the brain state the mod
 * acted on. Rounding isn't needed: replays are deterministic (fake timers, seeded Math.random).
 */
function snapshotState(mod: ModApi, tick: number) {
    const { Client, PlayerManager, ObjectManager, ProjectileManager, ModManager, ais } = mod;
    const parts: string[] = [`t${tick}`];

    const players = [...PlayerManager.players.handler.all].sort((a, b) => a.sid - b.sid);
    for (const p of players) {
        parts.push(`p${p.sid}:${p.real_position.x},${p.real_position.y},${p.health},${p.weaponIndex},${p.weaponVariant},`
            + `${p.skinIndex},${p.tailIndex},${p.team},${p.shameCount},${+p.visible},${p.trap?.sid ?? -1}`);
    }

    for (const o of ObjectManager.allObjects) parts.push(`o${o.sid}:${o.x},${o.y},${o.health},${+o.active}`);
    for (const pr of ProjectileManager.projectiles.all) parts.push(`j${pr.sid}:${pr.x},${pr.y},${+pr.active}`);
    for (const a of ais.all) parts.push(`a${a.sid}:${a.real_position.x},${a.real_position.y},${a.health},${+a.visible}`);

    parts.push(`me:${Client.mySID},${+Client.isAlive},${Client.weaponIndex},${Client.lastAteTick}`);
    parts.push(`brain:${JSON.stringify(ModManager.brainState)}`);
    return parts.join("|") + "\n";
}

export function summarizeState(mod: ModApi): StateSummary {
    const { Client, PlayerManager, ObjectManager, ProjectileManager, ais } = mod;
    const me = Client.player;
    return {
        players: PlayerManager.players.handler.all.length,
        objects: ObjectManager.allObjects.length,
        projectiles: ProjectileManager.projectiles.all.length,
        animals: ais.all.length,
        me: me ? {
            sid: me.sid, x: me.real_position.x, y: me.real_position.y, health: me.health, alive: Client.isAlive,
            weapon: me.weaponIndex, hat: me.skinIndex, shame: me.shameCount
        } : null
    };
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
        const mod = await loadMod(options.mode ?? "modules");
        const { profiler, Menu, Client, AngleFinder } = mod;
        const stateHash = options.traceState ? createHash("sha256") : null;
        if (options.profile) profiler.enableProfiler({ overlay: false, keepSamples: true, clock: () => realPerformance.now() });

        // Loader.main's setup minus rendering: the menu loads the saved settings the modules read every tick.
        await Menu.init();
        Client.mode = "replay";
        await Client.connect();

        const angleHash = options.traceAngles ? createHash("sha256") : null;
        let angleComputes = 0;
        if (angleHash) {
            const compute = AngleFinder.compute;
            AngleFinder.compute = function (...args: Parameters<typeof compute>) {
                const count = compute.apply(this, args);
                angleComputes++;
                hashAngles(angleHash, AngleFinder.angleBuffer as unknown as TracedAngle[], count);
                return count;
            };
        }

        const socket = Client.socket as unknown as { handlers: Record<string, (...args: unknown[]) => void>; sendMsg: (...args: unknown[]) => void };
        // Hashed as they are sent (the same bytes as JSON.stringify of the whole list) instead of kept, so a long
        // replay (the soak test) doesn't hold every packet in memory.
        const sentHash = createHash("sha256");
        let sentPackets = 0;
        let tick = 0;
        socket.sendMsg = (type, ...args) => { sentHash.update((sentPackets++ ? "," : "[") + JSON.stringify([tick, type, args])); };

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
            if (packet.type === "a") {
                tick++;
                if (stateHash) stateHash.update(snapshotState(mod, tick));
                options.onTick?.(tick, mod);
            }
        }

        return {
            profile: options.profile ? profiler.profileSummary() : {},
            ticks: tick,
            fingerprint: sentHash.update(sentPackets ? "]" : "[]").digest("hex").slice(0, 16),
            angleFingerprint: angleHash?.digest("hex").slice(0, 16),
            angleComputes,
            sentPackets,
            stateFingerprint: stateHash?.digest("hex").slice(0, 16),
            finalState: stateHash ? summarizeState(mod) : undefined,
            errors
        };
    } finally {
        consoleError.mockRestore();
        vi.useRealTimers();
        vi.restoreAllMocks();
    }
}
