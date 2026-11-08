/**
 * Soak test: plays about 10 minutes of game through the mod in one session and samples memory every game minute
 * (after a forced garbage collection), to catch anything that keeps growing. Off by default because it takes a few
 * minutes; run with `BENCH_SOAK=1 npm run bench -- soak`. Writes mod-source/bench/results/soak.json.
 *
 *  - steady: the synthetic fight (fixed players and buildings) looped to 10 minutes.
 *  - churn: the busy real recording 5 times in a row, so players and buildings keep coming and going.
 *
 * Each copy after the first leaves out the start-of-game packets (time 0) and continues the clock.
 *
 * It also writes a heap snapshot after minute 2 and one at the end (results/soak-<name>-start/end.heapsnapshot;
 * Chrome DevTools > Memory > Load opens them, and its "Comparison" view shows what was added), and lists the object
 * types whose count grew between the two.
 */
import fs from "fs";
import path from "path";
import { setFlagsFromString, writeHeapSnapshot } from "v8";
import { runInNewContext } from "vm";
import { describe, expect, it, vi } from "vitest";
import { benchDir, Packet, readRecording, recordingsDir, replay, summarizeState } from "./replay";

setFlagsFromString("--expose-gc");
const gc = runInNewContext("gc") as () => void;

const TICKS_PER_MINUTE = Math.round(60_000 / 111);
const resultsDir = path.join(benchDir, "results");

/** Live objects per constructor name in a .heapsnapshot file (the snapshot's own node list, nothing sampled). */
function countByName(file: string) {
    const { snapshot, nodes, strings } = JSON.parse(fs.readFileSync(file, "utf8")) as {
        snapshot: { meta: { node_fields: string[]; node_types: [string[]] } }; nodes: number[]; strings: string[];
    };
    const fields = snapshot.meta.node_fields;
    const width = fields.length;
    const typeAt = fields.indexOf("type");
    const nameAt = fields.indexOf("name");
    const objectType = snapshot.meta.node_types[0].indexOf("object");
    const counts = new Map<string, number>();
    for (let i = 0; i < nodes.length; i += width) {
        if (nodes[i + typeAt] !== objectType) continue;
        const name = strings[nodes[i + nameAt]!]!;
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
}

function snapshot(file: string) {
    gc();
    fs.mkdirSync(resultsDir, { recursive: true });
    writeHeapSnapshot(file);
}

function loop(packets: Packet[], copies: number): Packet[] {
    const length = Math.max(...packets.map(p => p.time)) + 111;
    const out: Packet[] = [];
    for (let c = 0; c < copies; c++) {
        for (const p of packets) {
            if (p.time === 0 && c > 0) continue;
            out.push({ ...p, time: p.time === 0 ? 0 : p.time + c * length });
        }
    }
    return out;
}

interface Sample { minute: number; heapMB: number; players: number; objects: number; projectiles: number; animals: number; texts: number }

describe.skipIf(process.env.BENCH_SOAK !== "1")("soak", () => {
    const cases = [
        { name: "steady", file: "sample-synthetic.fpl", copies: 40 },
        { name: "churn", file: "sample-busy.fpl", copies: 5 }
    ];
    const results: Record<string, unknown> = {};

    for (const { name, file, copies } of cases) {
        it(name, async () => {
            const packets = loop(readRecording(path.join(recordingsDir, file)), copies);
            const samples: Sample[] = [];
            const sample = (minute: number, mod?: Parameters<NonNullable<Parameters<typeof replay>[1]>["onTick"] & {}>[1]) => {
                // The replay's spies (Math.random, console) remember every call; that is the harness, not the mod.
                vi.mocked(Math.random).mockClear();
                vi.mocked(console.log).mockClear();
                vi.mocked(console.error).mockClear();
                gc();
                const state = mod ? summarizeState(mod) : { players: 0, objects: 0, projectiles: 0, animals: 0 };
                samples.push({
                    minute, heapMB: +(process.memoryUsage().heapUsed / 1048576).toFixed(2),
                    players: state.players, objects: state.objects, projectiles: state.projectiles, animals: state.animals, texts: 0
                });
            };

            const startFile = path.join(resultsDir, `soak-${name}-start.heapsnapshot`);
            const endFile = path.join(resultsDir, `soak-${name}-end.heapsnapshot`);
            const lastTick = TICKS_PER_MINUTE * 9;
            const result = await replay(packets, {
                mode: (process.env.BENCH_MODE as "modules" | "bundle" | undefined) ?? "bundle",
                onTick: (tick, mod) => {
                    if (tick % TICKS_PER_MINUTE === 0) sample(tick / TICKS_PER_MINUTE, mod);
                    // Both while the mod is loaded and mid-game, after the minute's spies are cleared.
                    if (tick === TICKS_PER_MINUTE * 2) snapshot(startFile);
                    if (tick === lastTick) snapshot(endFile);
                }
            });

            const before = countByName(startFile);
            const after = countByName(endFile);
            const grown = [...after].map(([type, count]) => ({ type, before: before.get(type) ?? 0, after: count }))
                .filter(g => g.after > g.before).sort((a, b) => (b.after - b.before) - (a.after - a.before)).slice(0, 10);

            const first = samples[1] ?? samples[0]!;
            const last = samples[samples.length - 1]!;
            results[name] = { ticks: result.ticks, minutes: +(result.ticks / TICKS_PER_MINUTE).toFixed(1), errors: result.errors.length, growthMBFromMinute2: +(last.heapMB - first.heapMB).toFixed(2), grownObjectTypes: grown, samples };
            fs.mkdirSync(path.join(benchDir, "results"), { recursive: true });
            fs.writeFileSync(path.join(benchDir, "results", "soak.json"), JSON.stringify(results, null, 2));
            expect(result.ticks).toBeGreaterThan(TICKS_PER_MINUTE * 9);
        });
    }
});
