// Behaviour check for refactors: replays the same seeded game (every major toggle on) on two copies of
// the script and compares every packet they send, byte for byte, plus key state after each tick.
// Usage: node compare.mjs <before.user.js> [after.user.js (default: ../robotics-kusoi.user.js)]
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[2] === "--child") {
    const { createRobotics, spawnWorld, serverTick } = await import("./harness.mjs");
    const toggles = ["autoPlace", "autoReplace", "autoPrePlace", "antiTrap", "safeAntiSpikeTick", "breakSpikeSwitch", "breakTrapSwitch", "safeWalk", "spikeTick",
        "predictTick", "placeVis", "anti1tick", "hammerBreakerOptimisation", "gradedAutoPlace", "knockbackHits", "knockbackInsta", "velocityHits", "projectileSync",
        "smartAntiInsta", "smartHats", "patternRec", "turretGearKB", "barbKB", "hudReloads", "hudThreat", "hudDanger", "hudPredict", "hudProjectiles", "autoTurret"];
    // Two configurations: the graded (Falcon) placer and modules, and the legacy placer path.
    const configs = [toggles, toggles.filter(t => t !== "gradedAutoPlace" && t !== "autoTurret")];
    const out = [];
    let failures = 0;
    for (const config of configs) {
        const env = await createRobotics({ storage: Object.fromEntries(config.map(t => [t, "true"])), seed: 7 });
        const ws = await env.connect();
        for (const seed of [12345, 999]) {
            const world = spawnWorld(env, { seed });
            for (let t = 0; t < 250; t++) {
                serverTick(env, world, t);
                for (let f = 0; f < 3; f++) { env.clock.t += 20; env.frame(); }
                const rb = env.rb;
                out.push("T" + t + " " + rb.fU.tick + " " + (rb.AQ && rb.AQ.sid) + " " + rb.sc.isTrue + " " + rb.Ad.length + " " + (rb.Ai && rb.Ai.damageThreat));
            }
            env.server("P", []);
            for (let t = 0; t < 10; t++) { env.advance(111); env.frame(); }
            env.server("C", [1]);
        }
        for (const d of ws.out) out.push(Buffer.from(d).toString("base64"));
        failures += env.failures().length;
    }
    process.stdout.write(JSON.stringify({ lines: out, failures }));
} else {
    const run = file => {
        const r = spawnSync(process.execPath, [path.join(HERE, "compare.mjs"), "--child"], { env: { ...process.env, ROBOTICS_SCRIPT: file }, encoding: "utf8", maxBuffer: 1 << 28 });
        if (r.status !== 0) throw new Error(r.stderr);
        return JSON.parse(r.stdout);
    };
    const a = run(path.resolve(process.argv[2]));
    const b = run(path.resolve(process.argv[3] || path.join(HERE, "..", "robotics-kusoi.user.js")));
    let diff = -1;
    for (let i = 0; i < Math.max(a.lines.length, b.lines.length); i++) if (a.lines[i] !== b.lines[i]) { diff = i; break; }
    if (diff < 0) console.log("identical: " + a.lines.length + " lines (ticks and packets), failures " + a.failures + " / " + b.failures);
    else { console.log("DIFFERENT at line " + diff + "\n  before: " + a.lines[diff] + "\n  after:  " + b.lines[diff]); process.exitCode = 1; }
}
