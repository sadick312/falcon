/**
 * Replay benchmark: feeds recorded games (.fpl files from !plog) through the real client offline and reports
 * time per tick step (ModManager.main), time per packet handler, optional allocations per source file, and a
 * fingerprint of every packet the mod tried to send, to prove an optimization didn't change behaviour.
 *
 * Run with `npm run bench`. Options (environment variables):
 *   BENCH_RECORDINGS  folder or single .fpl file (default mod-source/bench/recordings)
 *   BENCH_RUNS        timed runs per recording, after one warm-up run (default 5)
 *   BENCH_SETTINGS    JSON file with the menu settings to use (the "falcon-settings" localStorage value)
 *   BENCH_ALLOC=1     one extra run with V8's sampling heap profiler, for allocations per tick
 *   BENCH_CPU=1       one extra run with V8's CPU profiler, for self time per function
 *   BENCH_BASELINE=1  save this run as the baseline the next runs are compared against
 *
 * The replay itself (fake timers, seeded Math.random, packet fingerprint) lives in replay.ts.
 */
import fs from "fs";
import { Session } from "inspector/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { benchDir, Packet, readRecording, recordingsDir, replay as replayOnce } from "./replay";

const srcDir = path.join(benchDir, "..", "src");
const resultsDir = path.join(benchDir, "results");

const env = process.env;
const RUNS = Math.max(1, Number(env.BENCH_RUNS ?? 5));
const SETTINGS = env.BENCH_SETTINGS ? fs.readFileSync(env.BENCH_SETTINGS, "utf8") : null;

const replay = (packets: Packet[]) => replayOnce(packets, { settings: SETTINGS, profile: true });
type RunResult = Awaited<ReturnType<typeof replay>>;

/** The path relative to src, or "" for code outside it. Line numbers are of the transformed module, close to the source. */
function srcFile(rawUrl: string) {
    if (!rawUrl) return "";
    const url = decodeURIComponent(rawUrl.replace(/^file:\/\/\/?/, "")).replace(/\?.*$/, "");
    const file = path.relative(srcDir, url).replace(/\\/g, "/");
    return file.startsWith("..") || path.isAbsolute(file) ? "" : file;
}

const functionKey = (frame: CallFrame, file: string) => `${file}:${frame.lineNumber + 1} ${frame.functionName || "(anonymous)"}`;

interface CallFrame { url: string; functionName: string; lineNumber: number }
interface CpuProfile { nodes: { id: number; callFrame: CallFrame }[]; samples: number[]; timeDeltas: number[] }

/** Self time by function (src only) from V8's CPU profiler, over one replay. */
async function sampleCpu(packets: Packet[]) {
    const session = new Session();
    session.connect();
    await session.post("Profiler.enable");
    await session.post("Profiler.setSamplingInterval", { interval: 50 });
    await session.post("Profiler.start");

    const run = await replay(packets);
    const { profile } = await session.post("Profiler.stop") as { profile: CpuProfile };
    session.disconnect();

    const nodes = new Map(profile.nodes.map(n => [n.id, n]));
    const selfUs: Record<string, number> = {};
    for (let i = 0; i < profile.samples.length; i++) {
        const frame = nodes.get(profile.samples[i])!.callFrame;
        const file = srcFile(frame.url);
        if (!file) continue;
        const key = functionKey(frame, file);
        selfUs[key] = (selfUs[key] ?? 0) + (profile.timeDeltas[i] ?? 0);
    }
    return { ticks: run.ticks, selfUs };
}

/** Allocated bytes by source file and by function (relative to src), from V8's sampling heap profiler, garbage included. */
async function sampleAllocations(packets: Packet[]) {
    const session = new Session();
    session.connect();
    await session.post("HeapProfiler.enable");
    await session.post("HeapProfiler.startSampling", {
        samplingInterval: 256,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true
    } as never);

    const run = await replay(packets);
    const { profile } = await session.post("HeapProfiler.stopSampling") as { profile: { head: HeapNode } };
    session.disconnect();

    const byFile: Record<string, number> = {};
    const byFunction: Record<string, number> = {};
    const walk = (node: HeapNode) => {
        const file = srcFile(node.callFrame.url);
        if (node.selfSize && file) {
            byFile[file] = (byFile[file] ?? 0) + node.selfSize;
            const key = functionKey(node.callFrame, file);
            byFunction[key] = (byFunction[key] ?? 0) + node.selfSize;
        }
        for (const child of node.children) walk(child);
    };
    walk(profile.head);
    return { ticks: run.ticks, byFile, byFunction };
}

interface HeapNode { callFrame: CallFrame; selfSize: number; children: HeapNode[] }

const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
};
const fmt = (n: number | undefined, digits = 3) => n === undefined ? "-" : n.toFixed(digits);

interface Row { name: string; calls: number; avgMs: number; p95Ms: number; worstMs: number; msPerTick: number; /** The fastest run, less affected by other load on the machine than the median. */ minMsPerTick: number }

function summarize(runs: RunResult[]): Row[] {
    const names = Object.keys(runs[0].profile);
    const ticks = runs[0].ticks || 1;

    return names.map(name => {
        const per = runs.map(r => r.profile[name]).filter(Boolean);
        return {
            name,
            calls: per[0].calls,
            avgMs: median(per.map(p => p.avgMs)),
            p95Ms: median(per.map(p => p.p95Ms ?? 0)),
            worstMs: Math.max(...per.map(p => p.worstMs)),
            msPerTick: median(per.map(p => p.totalMs)) / ticks,
            minMsPerTick: Math.min(...per.map(p => p.totalMs)) / ticks
        };
    }).sort((a, b) => b.msPerTick - a.msPerTick);
}

function printTable(title: string, rows: Row[], baseline?: Row[]) {
    const base = new Map(baseline?.map(r => [r.name, r]));
    const width = Math.max(...rows.map(r => r.name.length), 4);
    const lines = [title, `${"name".padEnd(width)}  ${"calls".padStart(6)}  ${"avg ms".padStart(8)}  ${"p95 ms".padStart(8)}  ${"worst ms".padStart(8)}  ${"ms/tick".padStart(8)}${baseline ? "  vs baseline" : ""}`];

    for (const r of rows) {
        const b = base.get(r.name);
        const delta = b && b.msPerTick > 0 ? `  ${((r.msPerTick / b.msPerTick - 1) * 100).toFixed(0).padStart(5)}%` : "";
        lines.push(`${r.name.padEnd(width)}  ${String(r.calls).padStart(6)}  ${fmt(r.avgMs).padStart(8)}  ${fmt(r.p95Ms).padStart(8)}  ${fmt(r.worstMs).padStart(8)}  ${fmt(r.msPerTick, 4).padStart(8)}${delta}`);
    }

    console.log(lines.join("\n"));
}

function findRecordings() {
    const target = env.BENCH_RECORDINGS ?? recordingsDir;
    if (!fs.existsSync(target)) return [];
    if (fs.statSync(target).isFile()) return [target];
    return fs.readdirSync(target).filter(f => f.endsWith(".fpl")).map(f => path.join(target, f));
}

const recordings = findRecordings();

describe("replay benchmark", () => {
    it.skipIf(recordings.length > 0)("needs a recording", () => {
        console.log("No .fpl recordings found. Run `node mod-source/bench/make-sample-recording.mjs` or add !plog exports to mod-source/bench/recordings.");
    });

    for (const file of recordings) {
        const name = path.basename(file, ".fpl");

        it(name, async () => {
            const packets = readRecording(file);
            await replay(packets); // warm-up: JIT and module loading

            const runs: RunResult[] = [];
            for (let i = 0; i < RUNS; i++) runs.push(await replay(packets));

            const fingerprints = new Set(runs.map(r => r.fingerprint));
            const rows = summarize(runs);
            const steps = rows.filter(r => r.name.startsWith("tick"));
            const handlers = rows.filter(r => r.name.startsWith("packet."));
            const functions = rows.filter(r => r.name.startsWith("fn."));

            const baselinePath = path.join(resultsDir, `${name}.baseline.json`);
            const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : null;

            console.log(`\n=== ${name}: ${packets.length} packets, ${runs[0].ticks} ticks, ${RUNS} runs`);
            printTable("-- per tick step (ModManager.main)", steps, baseline?.rows);
            printTable("-- per packet handler (packet.a includes the tick)", handlers, baseline?.rows);
            printTable("-- functions inside the tick steps (fn.*, overlapping the rows above)", functions, baseline?.rows);

            let allocations: { file: string; bytesPerTick: number }[] | undefined;
            let allocationsByFunction: { fn: string; bytesPerTick: number }[] | undefined;
            if (env.BENCH_ALLOC === "1") {
                const sample = await sampleAllocations(packets);
                allocations = Object.entries(sample.byFile)
                    .map(([file, bytes]) => ({ file, bytesPerTick: bytes / (sample.ticks || 1) }))
                    .sort((a, b) => b.bytesPerTick - a.bytesPerTick);
                allocationsByFunction = Object.entries(sample.byFunction)
                    .map(([fn, bytes]) => ({ fn, bytesPerTick: bytes / (sample.ticks || 1) }))
                    .sort((a, b) => b.bytesPerTick - a.bytesPerTick)
                    .slice(0, 40);
                const total = allocations.reduce((sum, a) => sum + a.bytesPerTick, 0);
                console.log(`-- allocations (sampled): ${(total / 1024).toFixed(1)} KB per tick in src/\n`
                    + allocations.slice(0, 15).map(a => `${(a.bytesPerTick / 1024).toFixed(2).padStart(8)} KB  ${a.file}`).join("\n"));
            }

            let cpu: { fn: string; usPerTick: number }[] | undefined;
            if (env.BENCH_CPU === "1") {
                const sample = await sampleCpu(packets);
                cpu = Object.entries(sample.selfUs)
                    .map(([fn, us]) => ({ fn, usPerTick: us / (sample.ticks || 1) }))
                    .sort((a, b) => b.usPerTick - a.usPerTick)
                    .slice(0, 40);
                console.log("-- self time per tick (sampled)\n" + cpu.slice(0, 20).map(c => `${c.usPerTick.toFixed(1).padStart(8)} us  ${c.fn}`).join("\n"));
            }

            const fingerprint = [...fingerprints][0];
            console.log(`-- sent packets: ${runs[0].sentPackets}, fingerprint ${fingerprint}`
                + (fingerprints.size > 1 ? `  (NOT deterministic: ${fingerprints.size} different results)` : "")
                + (baseline ? (baseline.fingerprint === fingerprint ? "  (same as baseline)" : `  (DIFFERS from baseline ${baseline.fingerprint})`) : ""));
            if (runs[0].errors.length) console.log(`-- ${runs[0].errors.length} errors, first: ${runs[0].errors[0]}`);

            const result = { name, date: new Date().toISOString(), ticks: runs[0].ticks, runs: RUNS, fingerprint, sentPackets: runs[0].sentPackets, rows, allocations, allocationsByFunction, cpu, errors: runs[0].errors.slice(0, 20) };
            fs.mkdirSync(resultsDir, { recursive: true });
            fs.writeFileSync(path.join(resultsDir, `${name}.json`), JSON.stringify(result, null, 2));
            if (env.BENCH_BASELINE === "1") fs.writeFileSync(baselinePath, JSON.stringify(result, null, 2));

            expect(runs[0].ticks).toBeGreaterThan(0);
        });
    }
});
