/**
 * Angle Finder calls per tick, by who they are for (Part 3B): us, or an enemy at what distance from us. Sizes the
 * "only predict enemies that can matter" redesign: calls for enemies far away whose spots can't reach anything
 * near us could be skipped.
 *
 * Run: npx vitest run --config vitest.bench.config.mts mod-source/bench/angle-finder-calls.bench-run.ts
 */
import fs from "fs";
import path from "path";
import { describe, it } from "vitest";
import { readRecording, recordingsDir, replay, type ModApi } from "./replay";

const BANDS = [300, 500, 700, 1000, Infinity];
const files = fs.readdirSync(recordingsDir).filter(f => f.endsWith(".fpl")).sort();

describe("Angle Finder calls", () => {
    for (const file of files) {
        it(file, async () => {
            let wrapped = false;
            let ticks = 0;
            let ours = 0;
            const byBand = BANDS.map(() => 0);
            // Upper bound for reusing a call's result from the previous tick: same player, same position, same options.
            let samePlace = 0;
            let total = 0;
            const lastCall = new Map<string, string>();
            const seenThisTick = new Map<string, string>();
            await replay(readRecording(path.join(recordingsDir, file)), {
                onTick: (_tick: number, mod: ModApi) => {
                    ticks++;
                    for (const [k, v] of seenThisTick) lastCall.set(k, v);
                    seenThisTick.clear();
                    if (wrapped) return;
                    wrapped = true;
                    const { AngleFinder, Client } = mod;
                    const original = AngleFinder.compute.bind(AngleFinder);
                    AngleFinder.compute = ((player: { sid: number; real_position: { x: number; y: number } }, options: unknown) => {
                        const me = Client.player;
                        const key = `${player.sid}|${JSON.stringify(options)}`;
                        const where = `${player.real_position.x},${player.real_position.y}`;
                        total++;
                        if (lastCall.get(key) === where) samePlace++;
                        seenThisTick.set(key, where);
                        if (!me || player.sid === Client.mySID) ours++;
                        else {
                            const d = Math.hypot(player.real_position.x - me.real_position.x, player.real_position.y - me.real_position.y);
                            const band = BANDS.findIndex(b => d <= b);
                            byBand[band] = (byBand[band] ?? 0) + 1;
                        }
                        return original(player as never, options as never);
                    }) as typeof AngleFinder.compute;
                }
            });
            const per = (n: number) => (n / ticks).toFixed(2);
            const enemyTotal = byBand.reduce((s, n) => s + n, 0);
            console.log(`${file}: ${ticks} ticks, ${per(ours + enemyTotal)} calls/tick | ours ${per(ours)} | enemies ` +
                BANDS.map((b, i) => `${i ? `${BANDS[i - 1]}-` : "<="}${b === Infinity ? "+" : b}: ${per(byBand[i] ?? 0)}`).join(", ") +
                ` | same player, options and position as last tick: ${(100 * samePlace / (total || 1)).toFixed(1)}%`);
        });
    }
});
