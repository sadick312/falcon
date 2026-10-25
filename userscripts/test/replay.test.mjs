// Packet replay: spawn, fight, death, respawn, disconnect/reconnect, server switch, repeated.
// No handler failures, sane state after each step, nothing that keeps growing (B4, B5).
import { createRobotics, spawnWorld, serverTick, reporter, decode } from "./harness.mjs";

const T = reporter("replay");
const env = await createRobotics({ storage: { autoPlace: "true", gradedAutoPlace: "true", smartAntiInsta: "true", knockbackHits: "true", hudThreat: "true", hudDanger: "true", hudReloads: "true" } });
const rb = env.rb;
let ws = await env.connect();
let world = spawnWorld(env);
let t = 0;
const run = (n, frames = 2) => {
    for (let i = 0; i < n; i++) {
        serverTick(env, world, t++);
        for (let f = 0; f < frames; f++) env.frame();
    }
};
const sizes = () => {
    let gridEntries = 0;
    for (const c of rb.roboticsGrid.cells.values()) gridEntries += c.length;
    let slots = 0;
    for (const s of rb.fU.slots) slots += s.length;
    return { players: rb.Ae.length, objects: rb.Ac.length, projectiles: rb.AH.length, gridEntries, bySid: rb.roboticsGrid.bySid.size, slots,
        queued: rb.roboticsLimiter.queued(), ey: rb.ey.length, deathMarks: rb.sQ.length, e5: rb.e5.length, e6: rb.e6.length };
};
const heap = () => { if (global.gc) { global.gc(); global.gc(); } return process.memoryUsage().heapUsed; };

run(60);
T.ok(rb.AX && rb.Ai && rb.Ai.alive !== false && rb.Ae.length === 9, "spawned: alive with 8 enemies");
T.ok(env.failures().length === 0, "fight: no handler failures");

// Player Follow (B5): following an enemy who then leaves view must stop, not walk on in the old direction.
{
    rb.fu.playerFollow = true;
    const target = world.enemies[0];
    // Follow the first enemy (as clicking a player does).
    const enemyObj = rb.Ae.find(p => p.sid === target.sid);
    rb.fl.followSid = String(target.sid);
    run(3);
    const gone = world.enemies.shift();
    run(4);
    const moves = env.sent().filter(p => p[0] === "9");
    const lastMove = moves[moves.length - 1];
    T.ok(!enemyObj.visible, "setup: the followed enemy is out of view");
    T.ok(lastMove && lastMove[1][0] == null, "Player Follow stops when the target leaves view (B5) - last move " + (lastMove && lastMove[1][0]));
    world.enemies.unshift(gone);
    rb.fu.playerFollow = false;
    rb.fl.followSid = "-1";
}

const base = sizes();
const heap0 = heap();
for (let cycle = 0; cycle < 4; cycle++) {
    run(80);
    // Death: the server stops sending you, other players keep fighting (their health changes keep coming).
    env.server("P", []);
    const me = world.me;
    world.me = { sid: 999, x: me.x, y: me.y };
    const deadFrom = ws.out.length;
    for (let i = 0; i < 40; i++) {
        env.server("O", [world.enemies[i % world.enemies.length].sid, 50 + (i % 2) * 30]);
        serverTick(env, world, t++);
        env.frame();
    }
    world.me = me;
    const whileDead = ws.out.slice(deadFrom).map(decode).filter(p => p[0] !== "0" && p[0] !== "M");
    T.ok(rb.AX === false, "cycle " + cycle + ": dead");
    T.ok(whileDead.length === 0, "cycle " + cycle + ": nothing but pings sent while dead (" + whileDead.map(p => p[0]).join("") + ")");
    T.ok(rb.ey.length <= 8, "cycle " + cycle + ": damage events don't pile up while dead: " + rb.ey.length);
    // Respawn.
    env.server("C", [1]);
    env.server("D", [["me", 1, "me", me.x, me.y, 0, 100, 100, 35, 0], true]);
    run(5);
    T.ok(rb.AX && rb.Ai, "cycle " + cycle + ": respawned");
    // Disconnect, then the page reconnects (cycle 1, 3) or switches server while connected (cycle 0, 2).
    if (cycle % 2) {
        ws.close();
        env.advance(1000);
        ws = await env.connect("wss://s1.moomodding.io/?token=t");
        env.advance(5000);
        T.ok(env.sandbox.__reloads === 0, "cycle " + cycle + ": reconnect in time -> no page reload");
    } else {
        ws = await env.connect("wss://s" + (cycle + 2) + ".moomodding.io/?token=t");
    }
    T.ok(rb.fB === ws && !rb.AX && rb.Ae.length === 0 && rb.Ac.length === 0, "cycle " + cycle + ": new socket, old world cleared" + (cycle % 2 ? " after a disconnect (B10)" : ""));
    world = spawnWorld(env, { seed: 100 + cycle });
    run(20);
    T.ok(rb.AX && rb.Ae.length === 9 && rb.Ac.length === 900, "cycle " + cycle + ": playing on the new server");
}
const end = sizes();
const heap1 = heap();
const grew = Object.keys(base).filter(k => end[k] > base[k] * 1.25 + 20);
T.ok(grew.length === 0, "nothing keeps growing: " + JSON.stringify(base) + " -> " + JSON.stringify(end));
T.ok(!global.gc || heap1 - heap0 < 8e6, "heap after GC grew " + ((heap1 - heap0) / 1e6).toFixed(1) + " MB over 4 cycles" + (global.gc ? "" : " (run with --expose-gc to measure)"));
T.ok(env.failures().length === 0, "no handler failures: " + env.failures().slice(0, 3).join(" | "));
T.ok(env.errors.length === 0, "no console errors: " + env.errors.slice(0, 2).join(" | "));

// Lost connection with nothing coming back: one rate-limited reload.
const lastWs = ws;
lastWs.close();
env.advance(10000);
T.ok(env.sandbox.__reloads === 1, "lost connection: the page reloads once (" + env.sandbox.__reloads + ")");
T.done();
