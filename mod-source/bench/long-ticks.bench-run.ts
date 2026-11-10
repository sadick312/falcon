/**
 * Long ticks (ping brief, Phase 6): which replay ticks take longest to handle, and whether they repeat or are
 * one-offs (the first ticks also pay for JIT compiling and first-time setup). A tick handled slowly delays every
 * packet Falcon sends in it.
 *
 * Run: npx vitest run --config vitest.bench.config.mts mod-source/bench/long-ticks.bench-run.ts
 *   BENCH_MODE  "bundle" (default, like production) or "modules"
 *   LONG_TICK_MS  what counts as long (default 2 ms; a 60 fps frame is 16.7 ms)
 */
import fs from "fs";
import path from "path";
import { performance as realPerformance } from "perf_hooks";
import { describe, it } from "vitest";
import { readRecording, recordingsDir, replay } from "./replay";

const MODE = process.env.BENCH_MODE === "modules" ? "modules" : "bundle";
const LONG = Number(process.env.LONG_TICK_MS ?? 2);
const files = fs.readdirSync(recordingsDir).filter(f => f.endsWith(".fpl")).sort();

describe("long ticks", () => {
    for (const file of files) {
        it(file, async () => {
            const packets = readRecording(path.join(recordingsDir, file));
            // Two runs: the second shows what is left once the code is compiled ("warm").
            for (const run of ["cold", "warm"]) {
                const times: number[] = [];
                let last = 0;
                await replay(packets, {
                    mode: MODE,
                    onTick: (tick: number) => {
                        const now = realPerformance.now();
                        // Time since the previous tick ended: this tick's packets and its ModManager.main.
                        if (tick > 1) times[tick] = now - last;
                        last = now;
                    }
                });
                const list = times.map((ms, tick) => ({ tick, ms })).filter(t => t.ms !== undefined);
                const sorted = [...list].sort((a, b) => b.ms - a.ms);
                const ms = list.map(t => t.ms).sort((a, b) => a - b);
                const pct = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] ?? 0;
                const long = list.filter(t => t.ms > LONG);
                console.log(`${file} ${run}: ${list.length} ticks, median ${pct(0.5).toFixed(2)} ms, p99 ${pct(0.99).toFixed(2)} ms, ` +
                    `${long.length} over ${LONG} ms, ${list.filter(t => t.ms > 16.7).length} over 16.7 ms | slowest: ` +
                    sorted.slice(0, 6).map(t => `#${t.tick} ${t.ms.toFixed(1)}`).join(", "));
            }
        });
    }
});
