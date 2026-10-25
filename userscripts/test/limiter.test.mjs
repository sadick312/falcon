// roboticsLimiter on the live script, for both host profiles: per-second window, per-tick cap,
// heal reserve, priorities, whole sequences, newest-only aim/move, budget readout (B1).
import { createRobotics, spawnWorld, serverTick, reporter, decode, rng } from "./harness.mjs";

const T = reporter("limiter");

for (const host of (process.env.HOSTS || "sandbox.moomodding.io,moomodding.io").split(",")) {
    const env = await createRobotics({ host });
    const ws = await env.connect();
    const world = spawnWorld(env, { enemies: 3 });
    const rb = env.rb;
    const P = rb.roboticsPacketBudget();
    const tag = " [" + host + " " + P.perSecond + "/s " + P.perTick + "/tick]";
    for (let t = 0; t < 10; t++) serverTick(env, world, t);

    // Random load: every tick a burst of combat, aim, move and chat packets, a heal now and then.
    const R = rng(99);
    const steps = [];
    let heals = 0;
    for (let t = 10; t < 400; t++) {
        const before = ws.out.length;
        serverTick(env, world, t);
        const afterTick = ws.out.length;
        let healed = false;
        const burst = Math.floor(R() * 30);
        for (let i = 0; i < burst; i++) {
            const k = R();
            if (k < 0.35) rb.A0("z", 5 + (i % 2), 1);
            else if (k < 0.55) rb.A0("D", R() * 6);
            else if (k < 0.7) rb.A0("9", R() * 6, 1);
            else if (k < 0.85) rb.A0("6", "hi " + i);
            else if (k < 0.9 && !healed) { const n = ws.out.length; rb.eZ(); if (ws.out.length > n) { healed = true; heals++; } }
            else rb.A0("c", 0, 7, 0);
        }
        // Heal sequences (food item select, use, weapon select) may pass the per-tick cap.
        const types = ws.out.slice(before).map(decode);
        let healSeq = 0;
        for (let i = 0; i + 2 < types.length; i++) {
            if (types[i][0] === "z" && types[i][1][0] <= 2 && types[i][1][1] == null && types[i + 1][0] === "F") healSeq++;
        }
        steps.push({ t: env.clock.t, tick: rb.fU.tick, packets: ws.out.length - before, fromTick: afterTick - before, healed, healSeq });
        env.frame();
    }
    // Sliding 1 s window over the step timestamps (packets in one step share a timestamp).
    let worst = 0;
    for (let i = 0; i < steps.length; i++) {
        let sum = 0;
        for (let j = i; j < steps.length && steps[j].t - steps[i].t < 1000; j++) sum += steps[j].packets;
        worst = Math.max(worst, sum);
    }
    T.ok(worst <= P.perSecond, "never more than perSecond in any 1 s window (worst " + worst + ")" + tag);
    const overTick = steps.filter(s => s.packets - 3 * s.healSeq > P.perTick);
    T.ok(overTick.length === 0, "per-tick cap holds for everything but heal sequences - over: " + overTick.length + tag);
    T.ok(heals > 0, "heals went out under load (" + heals + ")" + tag);
    T.ok(rb.roboticsLimiter.queued() <= 4 * P.perSecond, "queues stay bounded (" + rb.roboticsLimiter.queued() + ")" + tag);

    // Heal reserve: fill the window with chat (non-critical), a heal still fits.
    env.advance(1500); rb.roboticsLimiter.purge(env.clock.t);
    for (const q of rb.roboticsLimiter.queue) q.length = 0;
    rb.roboticsLimiter.tickCount = 0;
    for (let i = 0; i < 400; i++) { rb.A0("6", "x" + i); if (i % 10 === 9) rb.roboticsLimiter.newTick(); }
    rb.roboticsLimiter.purge(env.clock.t);
    T.ok(rb.roboticsLimiter.count <= P.perSecond - P.reserve, "non-critical packets stop at perSecond - reserve (" + rb.roboticsLimiter.count + ")" + tag);
    rb.AW.healed = false;
    rb.AW.pendingHeal = 0;
    env.server("O", [1, 50]);
    const n0 = ws.out.length;
    rb.eZ(-2);
    T.ok(ws.out.length - n0 === 3, "heal sequence goes out whole from the reserve" + tag);
    T.ok(rb.roboticsLimiter.queue[3].length <= rb.roboticsLimiter.queue[3].length && rb.roboticsLimiter.queue[3].length <= 48, "chat queue capped" + tag);

    // Place sequences: all three packets or none.
    env.advance(1500); rb.roboticsLimiter.purge(env.clock.t);
    for (const q of rb.roboticsLimiter.queue) q.length = 0;
    let partial = 0;
    for (let i = 0; i < 40; i++) {
        if (i % 6 === 0) rb.roboticsLimiter.newTick();
        const n = ws.out.length;
        rb.ev(2, i * 0.3);
        const d = ws.out.length - n;
        if (d !== 0 && d !== 3) partial++;
    }
    T.ok(partial === 0, "place sequences never split" + tag);

    // Newest-only aim while queued.
    rb.roboticsLimiter.tickCount = 999;
    for (const q of rb.roboticsLimiter.queue) q.length = 0;
    rb.A0("D", 1.1); rb.A0("D", 1.2); rb.A0("D", 1.3);
    const aims = rb.roboticsLimiter.queue[2].filter(e => e.type === "D");
    T.ok(aims.length === 1 && Math.abs(decode(aims[0].bytes)[1][0] - 1.3) < 1e-9, "queued aim keeps only the newest" + tag);
    rb.roboticsLimiter.tickCount = 0;

    // B1: after a busy second and a quiet one, the budget check must see the window emptied.
    env.advance(1500); rb.roboticsLimiter.purge(env.clock.t); rb.roboticsLimiter.newTick();
    for (let i = 0; i < 60; i++) { rb.A0("z", 5 + (i % 2), 1); if (i % 10 === 9) rb.roboticsLimiter.newTick(); }
    env.advance(2000);
    T.ok(rb.roboticsBudgetFree(true), "budget is free again after 2 quiet seconds (B1)" + tag);
    T.ok(env.failures().length === 0, "no handler failures" + tag);
}
T.done();
