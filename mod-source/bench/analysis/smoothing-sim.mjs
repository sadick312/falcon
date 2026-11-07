// Group C1 analysis: how CameraManager.lerpEntities' slide time (170 ms) and extrapolation cap (x1.7) behave on a
// steady connection, jittery Wi-Fi, a lag spike, and a player stopping or turning. Run: node mod-source/bench/analysis/smoothing-sim.mjs
// The formula mirrors CameraManager.lerpEntities; change the variants table to try others. Drawing only: no decision reads it.
// Simulates CameraManager.lerpEntities for one player moving right at a steady speed, with server updates every
// 111 ms of game time arriving with different network timings. Measures:
//  - lag: average distance the drawn position is behind the true position at the moment shown (units)
//  - back: total distance the drawn player moved backwards (rubber-banding), per 10 s
//  - maxBack: the biggest single backwards slide
//  - spdVar: frame-to-frame speed variation (stdev / mean), 0 = perfectly even motion
const TICK = 111;
const SPEED = 0.2; // units per ms (about 22 per tick)
const FRAME = 1000 / 60;
const DURATION = 10_000;

function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }

/** Arrival time of each server tick's update. */
function arrivals(kind) {
    const r = rng(7);
    const out = [];
    for (let i = 1; i * TICK < DURATION; i++) {
        const sent = i * TICK;
        let delay = 40;
        if (kind === "jitter") delay = 40 + (r() - 0.5) * 80; // ±40 ms
        if (kind === "spike" && i >= 40 && i < 43) delay = 40 + (43 - i) * TICK; // 3 updates stuck, then a burst
        // "stop": the player stops at tick 40, during a 2-tick lag spike; "stopJitter": stops at tick 40 on jittery Wi-Fi;
        // "turn": walks back from tick 40.
        let x = sent * SPEED;
        if (kind.startsWith("stop") && i >= 40) x = 40 * TICK * SPEED;
        if (kind === "turn" && i >= 40) x = (80 * TICK - sent) * SPEED;
        if (kind === "stop" && i >= 40 && i < 42) delay = 40 + (42 - i) * TICK;
        if (kind === "stopJitter") delay = 40 + (r() - 0.5) * 80;
        out.push({ arrive: sent + delay, x });
    }
    return out.sort((a, b) => a.arrive - b.arrive);
}

function run(kind, variant) {
    const ups = arrivals(kind);
    const e = { real: 0, lastRender: 0, render: 0, last: 0, dt: 0, still: false, avgInterval: TICK, lastArrive: 0 };
    let u = 0, lagSum = 0, n = 0, back = 0, maxBack = 0, prev = 0;
    const speeds = [];
    for (let t = 0; t < DURATION; t += FRAME) {
        while (u < ups.length && ups[u].arrive <= t) {
            const up = ups[u++];
            const interval = up.arrive - e.lastArrive;
            if (e.lastArrive && interval < 1000) e.avgInterval += (Math.max(interval, 30) - e.avgInterval) / 8;
            e.lastArrive = up.arrive;
            e.still = e.real === up.x;
            e.lastRender = e.render;
            e.real = up.x;
            e.dt = 0;
        }
        e.dt += FRAME;
        const k = variant(e);
        e.render = e.lastRender + (e.real - e.lastRender) * k;
        const serverT = t - 40; // what the server had 40 ms ago (the normal network delay)
        let truePos = serverT * SPEED;
        if (kind.startsWith("stop") && serverT >= 40 * TICK) truePos = 40 * TICK * SPEED;
        if (kind === "turn" && serverT >= 40 * TICK) truePos = (80 * TICK - serverT) * SPEED;
        lagSum += Math.abs(truePos - e.render); n++;
        const step = e.render - prev;
        const forward = kind === "turn" && t - 40 >= 40 * TICK + 300 ? -step : step; // after the turn, "back" means east again
        if (forward < 0 && !(kind === "turn" && Math.abs(t - 40 - 40 * TICK) < 300)) { back -= forward; maxBack = Math.max(maxBack, -forward); }
        if (t > 500) speeds.push(step);
        prev = e.render;
    }
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const sd = Math.sqrt(speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length);
    return { lag: lagSum / n, back, maxBack, spdVar: Math.abs(sd / mean) };
}

const variants = {
    "now: 170 ms, x1.7": e => Math.min(e.still ? 1 : 1.7, e.dt / 170),
    "170 ms, x1.2": e => Math.min(e.still ? 1 : 1.2, e.dt / 170),
    "170 ms, x1.0": e => Math.min(1, e.dt / 170),
    "measured interval +20%, x1.7": e => Math.min(e.still ? 1 : 1.7, e.dt / (e.avgInterval * 1.2)),
    "measured interval +20%, x1.2": e => Math.min(e.still ? 1 : 1.2, e.dt / (e.avgInterval * 1.2)),
    "measured interval +35%, x1.2": e => Math.min(e.still ? 1 : 1.2, e.dt / (e.avgInterval * 1.35)),
    "measured interval +50%, x1.2": e => Math.min(e.still ? 1 : 1.2, e.dt / (e.avgInterval * 1.5))
};

for (const kind of ["steady", "jitter", "spike", "stop", "stopJitter", "turn"]) {
    console.log(`\n== ${kind}`);
    console.log("variant".padEnd(34), "lag", "  back", " maxBack", " spdVar");
    for (const [name, v] of Object.entries(variants)) {
        const r = run(kind, v);
        console.log(name.padEnd(34), r.lag.toFixed(1).padStart(5), r.back.toFixed(1).padStart(6), r.maxBack.toFixed(2).padStart(7), r.spdVar.toFixed(3).padStart(7));
    }
}
