// Replays the sample recordings in mod-source/bench/recordings and checks that the mod still makes exactly the same
// decisions: the same packets in the same ticks, the same AngleFinder results (every candidate angle's position,
// grade and flags), and the same game state after every tick (players, objects, projectiles, animals, our own flags
// and the brain state). Performance work must keep all three fingerprints. When a change is meant to alter behaviour, run
// with UPDATE_REPLAY_FINGERPRINTS=1 to record the new fingerprints and explain the difference in the commit.
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { readRecording, recordingsDir, replay, StateSummary } from "../bench/replay";

const fixturePath = path.join(import.meta.dirname, "fixtures", "replay-fingerprints.json");
const expected: Record<string, { packets: string; angles: string; state: string; sentPackets: number; angleComputes: number; finalState: StateSummary }> =
    fs.existsSync(fixturePath) ? JSON.parse(fs.readFileSync(fixturePath, "utf8")) : {};
const update = process.env.UPDATE_REPLAY_FINGERPRINTS === "1";

const recordings = fs.readdirSync(recordingsDir).filter(f => f.endsWith(".fpl")).sort();

describe("replaying the sample recordings", () => {
    for (const file of recordings) {
        const name = path.basename(file, ".fpl");

        it(`${name} sends the same packets, finds the same angles and ends each tick in the same state`, async () => {
            const result = await replay(readRecording(path.join(recordingsDir, file)), { traceAngles: true, traceState: true });
            const actual = {
                packets: result.fingerprint, angles: result.angleFingerprint!, state: result.stateFingerprint!,
                sentPackets: result.sentPackets, angleComputes: result.angleComputes, finalState: result.finalState!
            };

            if (update) {
                expected[name] = actual;
                fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
                fs.writeFileSync(fixturePath, JSON.stringify(expected, null, 4) + "\n");
                return;
            }

            expect(result.ticks).toBeGreaterThan(0);
            expect(actual).toEqual(expected[name]);
        }, 120_000);
    }

    it("is deterministic", async () => {
        const packets = readRecording(path.join(recordingsDir, "sample-synthetic.fpl"));
        const first = await replay(packets, { traceAngles: true, traceState: true });
        const second = await replay(packets, { traceAngles: true, traceState: true });
        expect(second.fingerprint).toBe(first.fingerprint);
        expect(second.angleFingerprint).toBe(first.angleFingerprint);
        expect(second.stateFingerprint).toBe(first.stateFingerprint);
    }, 120_000);
});
