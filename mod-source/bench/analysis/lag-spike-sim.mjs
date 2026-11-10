// Part 3 B3 analysis: our own player and the camera during lag spikes (N server updates stuck, then all arriving at
// once), for CameraManager.lerpEntities' extrapolation cap. Run: node mod-source/bench/analysis/lag-spike-sim.mjs
// Same formulas as CameraManager.lerpEntities: the player slides from where it was drawn to its newest position over
// 170 ms, carrying on up to cap x that step while no update arrives; the camera closes 1% of its gap per ms.
// Drawing only: no decision reads it. Moving right at 0.2 units/ms (22 per tick, 3.3 per frame). Measures, around the
// spike only:
//  - ahead: how far the drawn player got past the true position (overshoot), units
//  - freeze: longest time the drawn player stood still, ms
//  - jump: biggest single-frame move (catching up), units
//  - camLag: biggest distance between the camera and the drawn player, units
const TICK = 111, SPEED = 0.2, FRAME = 1000 / 60, DURATION = 8000, SPIKE_AT = 30;

/** Position the server had at time `t` (ms): moving right, or walking back from tick `turnAt`. */
function serverX(t, turnAt) {
    return (turnAt && t >= turnAt * TICK ? 2 * turnAt * TICK - t : t) * SPEED;
}

function arrivals(stuck, turnAt) {
    const out = [];
    for (let i = 1; i * TICK < DURATION; i++) {
        const sent = i * TICK;
        const delay = stuck && i >= SPIKE_AT && i < SPIKE_AT + stuck ? 40 + (SPIKE_AT + stuck - i) * TICK : 40;
        out.push({ arrive: sent + delay, x: serverX(sent, turnAt) });
    }
    return out.sort((a, b) => a.arrive - b.arrive);
}

function run(stuck, turnAt, cap) {
    const ups = arrivals(stuck, turnAt);
    const e = { real: 0, lastRender: 0, render: 0, dt: 0, still: false };
    let cam = 0, u = 0, prev = 0, ahead = 0, freeze = 0, maxFreeze = 0, jump = 0, camLag = 0;
    for (let t = 0; t < DURATION; t += FRAME) {
        while (u < ups.length && ups[u].arrive <= t) {
            const up = ups[u++];
            e.still = e.real === up.x;
            e.lastRender = e.render;
            e.real = up.x;
            e.dt = 0;
        }
        e.dt += FRAME;
        e.render = e.lastRender + (e.real - e.lastRender) * Math.min(e.still ? 1 : cap, e.dt / 170);
        const gap = e.render - cam;
        cam += Math.sign(gap) * Math.min(Math.abs(gap) * 0.01 * FRAME, Math.abs(gap));

        const aroundSpike = t >= SPIKE_AT * TICK - 400 && t <= (SPIKE_AT + stuck + 4) * TICK;
        if (aroundSpike) {
            const truePos = serverX(t - 40, turnAt); // what the server had 40 ms ago (the normal network delay)
            ahead = Math.max(ahead, e.render - truePos);
            const step = e.render - prev;
            if (Math.abs(step) < 1e-9) maxFreeze = Math.max(maxFreeze, freeze += FRAME);
            else freeze = 0;
            jump = Math.max(jump, Math.abs(step));
            camLag = Math.max(camLag, Math.abs(e.render - cam));
        }
        prev = e.render;
    }
    return { ahead, maxFreeze, jump, camLag };
}

const caps = { "now: x1.7": 1.7, "x1.3": 1.3, "x1.0": 1.0, "x2.5": 2.5 };
const cases = [
    ["3 updates stuck", 3, 0],
    ["6 updates stuck", 6, 0],
    ["3 stuck, turns back at the 1st", 3, SPIKE_AT],
    ["6 stuck, turns back at the 2nd", 6, SPIKE_AT + 1],
    ["no spike, turns back", 0, SPIKE_AT + 1]
];

for (const [label, stuck, turnAt] of cases) {
    console.log(`\n== ${label}`);
    console.log("cap".padEnd(12), "ahead", "freeze ms", "jump", "camLag");
    for (const [name, cap] of Object.entries(caps)) {
        const r = run(stuck, turnAt, cap);
        console.log(name.padEnd(12), r.ahead.toFixed(1).padStart(5), r.maxFreeze.toFixed(0).padStart(9), r.jump.toFixed(2).padStart(5), r.camLag.toFixed(1).padStart(6));
    }
}
