/**
 * Heal report: how often Auto Heal eats, and why, in each recording, with "Resync Predicted Speed" off and on.
 *
 * Per run it counts:
 *   ticks            server ticks replayed
 *   spike ticks      ticks where our prediction says we hit a spike (next_state.spikeDamages > 0)
 *   heals            ticks where Auto Heal ate, by reason (brainState.healingResponse)
 *   food sent        food placements sent in all
 *   fingerprint      hash of every packet sent (the "off" one must match the recorded replay fingerprint)
 *
 * Run: npx vitest run --config vitest.bench.config.mts mod-source/bench/heal-report.bench-run.ts
 *   HEAL_RECORDINGS  folder or single .fpl (default mod-source/bench/recordings)
 */
import fs from "fs";
import path from "path";
import { describe, it } from "vitest";
import { readRecording, recordingsDir, replay, type ModApi } from "./replay";

interface HealResult {
    ticks: number;
    spikeTicks: number;
    heals: Record<string, number>;
    foodSent: number;
    fingerprint: string;
}

async function run(file: string, resync: boolean): Promise<HealResult> {
    const r: HealResult = { ticks: 0, spikeTicks: 0, heals: {}, foodSent: 0, fingerprint: "" };
    let applied = false;

    const result = await replay(readRecording(file), {
        onTick: (_t: number, mod: ModApi) => {
            if (!applied) {
                applied = true;
                const items = (mod.Menu as unknown as { itemMap: Record<string, { status: unknown }> }).itemMap;
                const item = items["resyncPredictedSpeed"];
                if (item) item.status = resync;
            }
            r.ticks++;
            const me = mod.Client.player;
            if (!me) return;
            if (me.next_state.spikeDamages > 0) r.spikeTicks++;
            // healingResponse is set again every tick; healingUsed is not, so only count it on ticks that ate.
            const brain = (mod.ModManager as unknown as { brainState: { healingUsed: number; healingResponse: string } }).brainState;
            const why = brain.healingResponse;
            if (why && why.endsWith("heal") && !why.endsWith("no heal")) {
                r.foodSent += brain.healingUsed;
                r.heals[why] = (r.heals[why] ?? 0) + 1;
            }
        }
    });

    r.fingerprint = result.fingerprint;
    return r;
}

const source = process.env.HEAL_RECORDINGS ?? recordingsDir;
const files = fs.statSync(source).isDirectory()
    ? fs.readdirSync(source).filter(f => f.endsWith(".fpl")).map(f => path.join(source, f))
    : [source];

describe("heal report", () => {
    for (const file of files) {
        it(path.basename(file), async () => {
            for (const resync of [false, true]) {
                const r = await run(file, resync);
                const heals = Object.entries(r.heals).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
                process.stdout.write(
                    `${path.basename(file)} resync=${resync ? "on " : "off"}: ticks ${r.ticks}, spike ticks ${r.spikeTicks}, ` +
                    `heal ticks ${Object.values(r.heals).reduce((a, b) => a + b, 0)} (${heals}), food ${r.foodSent}, fp ${r.fingerprint.slice(0, 12)}\n`
                );
            }
        }, 600_000);
    }
});
