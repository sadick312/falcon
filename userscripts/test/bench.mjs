// Seeded offline benchmark, same setup as the browser replay bench: ~900 objects, 8 enemies,
// 1280x720, 300 measured ticks after 40 warm-up, 6 frames per tick. Tick = handling one players
// update ("a") packet; frame = one render (cF) against a no-op canvas, so frame time here is the
// script's own work only (no drawing). Usage: node --expose-gc bench.mjs [runs]
// ROBOTICS_SCRIPT=other.user.js benchmarks another copy.
import { performance as perf } from "perf_hooks";
import { createRobotics, spawnWorld, serverTick, encode } from "./harness.mjs";

const TOGGLES = ["autoPlace", "autoReplace", "autoPrePlace", "antiTrap", "safeAntiSpikeTick", "breakSpikeSwitch", "breakTrapSwitch", "safeWalk", "spikeTick",
    "predictTick", "placeVis", "anti1tick", "autoQonSync", "hammerBreakerOptimisation", "renderDir"];
const runs = Number(process.argv[2] || 5);
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

async function once(seed) {
    const env = await createRobotics({ storage: Object.fromEntries(TOGGLES.map(t => [t, "true"])) });
    await env.connect();
    const world = spawnWorld(env, { seed });
    const rb = env.rb;
    const ticks = [];
    const frames = [];
    for (let t = 0; t < 340; t++) {
        // serverTick minus the final "a", which is timed here.
        const { me, enemies, R } = world;
        me.x += (R() - 0.5) * 6; me.y += (R() - 0.5) * 6;
        const flat = [me.sid, me.x, me.y, 0, -1, 5, 2, null, 0, 6, 0, 0, 0];
        for (const e of enemies) { e.x += (R() - 0.5) * 20; e.y += (R() - 0.5) * 20; flat.push(e.sid, e.x, e.y, Math.atan2(me.y - e.y, me.x - e.x), -1, 5, 2, null, 0, 7, 0, 0, 0); }
        if (t % 3 === 0) { world.myHealth = Math.max(20, world.myHealth - 35); env.server("O", [me.sid, world.myHealth]); }
        else if (t % 3 === 2) { world.myHealth = 100; env.server("O", [me.sid, world.myHealth]); }
        if (t % 5 === 0) { const e = enemies[t % enemies.length]; env.server("X", [e.x, e.y, Math.atan2(me.y - e.y, me.x - e.x), 1000, 1.6, 0, 0, world.projSid++]); }
        env.clock.t += 111; env.runTimers();
        const msg = { data: encode("a", [flat]) };
        const t0 = perf.now();
        env.ws.emit("message", msg);
        const dt = perf.now() - t0;
        for (let f = 0; f < 6; f++) {
            env.clock.t += 18;
            const f0 = perf.now();
            rb.cF();
            if (t >= 40) frames.push(perf.now() - f0);
        }
        if (t >= 40) ticks.push(dt);
    }
    return { tick: [avg(ticks), pct(ticks, 0.95)], frame: [avg(frames), pct(frames, 0.95)], failures: env.failures().length };
}

const results = [];
for (let i = 0; i < runs; i++) {
    if (global.gc) global.gc();
    results.push(await once(12345));
}
const med = k => { const v = results.map(r => r[k]); return [pct(v.map(x => x[0]), 0.5), pct(v.map(x => x[1]), 0.5)]; };
const [ta, tp] = med("tick");
const [fa, fp] = med("frame");
console.log("script: " + (process.env.ROBOTICS_SCRIPT || "robotics-kusoi.user.js"));
console.log("runs " + runs + " (median)  tick avg " + ta.toFixed(3) + " ms / p95 " + tp.toFixed(3) + " ms   frame avg " + fa.toFixed(3) + " ms / p95 " + fp.toFixed(3) + " ms   handler failures " + results.map(r => r.failures).join(","));
