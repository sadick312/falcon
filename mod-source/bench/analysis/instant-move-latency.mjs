// Part 1 / 1E analysis: how much sooner a movement key takes effect with "Send Movement Instantly".
// Run: node mod-source/bench/analysis/instant-move-latency.mjs
//
// Model (1.8.2): the server runs a tick every 1000/9 ms and moves each player in the direction of the last MOVE packet
// it received before that tick. The client sees tick k one network trip (ping / 2) after the server ran it.
//  - Off (default): a key press only sets the direction; MOVE goes out when the client handles the next tick it receives.
//  - On: MOVE goes out at the key press.
// Measured, over many key presses at random moments: the time from the key press to the server tick that first
// applies it, and in how many server ticks the player keeps walking the old way after the press.
const TICK = 1000 / 9;
const PRESSES = 200_000;
const PINGS = [20, 50, 80, 110, 150, 200];
const JITTER = 10; // ± ms on each one-way trip

function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }

function simulate(ping, instant) {
    const r = rng(42);
    const oneWay = () => ping / 2 + (r() - 0.5) * 2 * JITTER;
    let totalDelay = 0;
    let totalStaleTicks = 0;

    for (let i = 0; i < PRESSES; i++) {
        const press = 1000 + r() * TICK * 50; // client time = server time; any moment
        let send = press;
        if (!instant) {
            // The next tick the client receives after the press: server tick k arrives at k * TICK + one-way trip.
            let k = Math.floor((press - ping / 2) / TICK);
            while (k * TICK + ping / 2 < press) k++;
            send = k * TICK + oneWay();
            if (send < press) send = press; // that tick's packets arrived just before the press: next handling is now
        }
        const arrival = send + oneWay();
        const appliedTick = Math.ceil(arrival / TICK); // the first server tick after it arrived
        totalDelay += appliedTick * TICK - press;
        // Server ticks that still moved the old way after the press (the press can't affect a tick before it).
        totalStaleTicks += appliedTick - Math.ceil(press / TICK);
    }

    return { delay: totalDelay / PRESSES, stale: totalStaleTicks / PRESSES };
}

console.log("ping (ms) | off: press -> applied | on: press -> applied | sooner | old-direction ticks off -> on");
for (const ping of PINGS) {
    const off = simulate(ping, false);
    const on = simulate(ping, true);
    console.log(`${String(ping).padStart(9)} | ${off.delay.toFixed(1).padStart(18)} ms | ${on.delay.toFixed(1).padStart(17)} ms | ${(off.delay - on.delay).toFixed(1).padStart(5)} ms | ${off.stale.toFixed(2)} -> ${on.stale.toFixed(2)}`);
}
