// fU on the live script: timing, isolation, no double runs, runs while dead, resets (B2, B3).
import { createRobotics, spawnWorld, serverTick, reporter } from "./harness.mjs";

const T = reporter("scheduler");
const env = await createRobotics();
// B8: the page-global debug() (Z reset) before you have spawned.
let threw = null;
try { env.sandbox.debug(); } catch (err) { threw = err.message; }
T.ok(threw === null, "debug() before spawning doesn't throw (B8) " + (threw || ""));
await env.connect();
const world = spawnWorld(env);
const rb = env.rb;
const fU = rb.fU;
let t = 0;
const tick = () => serverTick(env, world, t++);
tick();

const order = [];
fU.tickBase(() => order.push("a"), 1);
fU.tickBase(() => { throw new Error("boom"); }, 1);
fU.tickBase(() => order.push("b"), 1);
fU.tickBase(() => order.push("nan"), NaN);
fU.tickBase(() => order.push("three"), 3);
const start = fU.tick;
tick();
T.ok(order.join() === "a,b,nan", "tick+1 callbacks run in order; a throwing one doesn't stop the rest (" + order.join() + ")");
T.ok(env.warnings.some(w => /boom/.test(w)), "the failure is logged");
tick(); tick();
T.ok(order.filter(x => x === "three").length === 1 && fU.tick === start + 3, "tick+3 runs once, on the 3rd tick");
tick(); tick();
T.ok(order.length === 4, "nothing runs twice");
let every = 0;
fU.every(9, () => every++);
for (let i = 0; i < 27; i++) tick();
T.ok(every === 3, "every(9) runs 3 times in 27 ticks");

// Fallback ticks while the server is quiet (menu / dead).
const q0 = fU.tick;
env.advance(500); env.frame();
T.ok(fU.tick === q0, "no fallback tick within 1 s of a server tick");
for (let i = 0; i < 12; i++) { env.advance(111); env.frame(); }
T.ok(fU.tick > q0, "fallback ticks once the server is quiet (" + (fU.tick - q0) + ")");

// B12: a tick whose handler throws before runDue() still runs its callbacks (one tick late).
{
    let ran = 0;
    fU.tickBase(() => ran++, 1);
    const victim = rb.Ae.find(p => p !== rb.Ai);
    const saved = victim.updateShameTimer;
    victim.updateShameTimer = () => { throw new Error("handler broke"); };
    tick();
    victim.updateShameTimer = saved;
    tick();
    T.ok(ran === 1, "callbacks of a tick whose handler threw run at the next tick (B12): ran " + ran);
}

// While dead.
env.server("P", []);
let ranDead = 0;
fU.tickBase(() => ranDead++, 2);
for (let i = 0; i < 4; i++) tick();
T.ok(ranDead === 1 && rb.AX === false, "callbacks run while dead");

// Respawn.
env.server("C", [1]);
env.server("D", [["me", 1, "me", 7000, 7000, 0, 100, 100, 35, 0], true]);
tick();

// B3: the Z reset key (window.debug) during a running sequence must not leave it stuck.
rb.sc.dynamicOneTickType({ firstDir: 0, secondDir: 0 });
T.ok(rb.sc.isTrue && rb.sc.ticking, "setup: one tick running");
env.sandbox.debug();
for (let i = 0; i < 3; i++) tick();
T.ok(!rb.sc.isTrue && !rb.sc.ticking && !rb.AW.autoAim && rb.AW.customAim === undefined, "Z reset ends a running sequence (B3)");

// B2: a server switch during a sequence must not leave it stuck either.
rb.sc.bullHitType("test");
rb.sc.dynamicOneTickType({ firstDir: 0, secondDir: 0 });
await env.connect("wss://s2.moomodding.io/?token=t");
T.ok(rb.fB === env.ws, "switched to the new socket");
T.ok(!rb.sc.isTrue && !rb.sc.ticking && !rb.AW.autoAim && rb.AW.customAim === undefined && !rb.AW.waitHit, "server switch clears the running sequence (B2)");
T.ok(rb.e5.length === 0 && rb.e6.length === 0 && !rb.sV.active && rb.Ag === undefined, "server switch clears markers, breaker and follow target (B2/B7)");
let slots = 0;
for (const s of fU.slots) slots += s.length;
T.ok(slots === 0, "server switch leaves no pending callbacks");
T.done();
