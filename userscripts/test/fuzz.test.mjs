// Fuzz: random and malformed server packets (wrong types, missing fields, unknown ids) never crash the
// script, never break the tick/frame loop, and a normal game afterwards works with no failures.
import { createRobotics, spawnWorld, serverTick, reporter, rng, encode } from "./harness.mjs";

const T = reporter("fuzz");
const SEED = Number(process.env.FUZZ_SEED || 4242);
const ROUNDS = Number(process.env.FUZZ_ROUNDS || 3000);
const TYPES = ["A", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z",
    "0", "2", "3", "4", "5", "6", "7", "8", "9", "io-init", "auth_ok", "", "zz"];
const R = rng(SEED);
const pick = a => a[Math.floor(R() * a.length)];
function junk(depth) {
    const k = R();
    if (k < 0.2) return Math.floor(R() * 40) - 5;
    if (k < 0.3) return R() * 20000 - 1000;
    if (k < 0.38) return pick([NaN, Infinity, -Infinity, -0, 1e308]);
    if (k < 0.48) return pick(["", "x", "me", "<img src=x onerror=alert(1)>", "__proto__", "constructor"]);
    if (k < 0.55) return null;
    if (k < 0.6) return pick([true, false]);
    if (k < 0.85 && depth < 3) {
        const n = Math.floor(R() * 16);
        const arr = [];
        for (let i = 0; i < n; i++) arr.push(junk(depth + 1));
        return arr;
    }
    if (depth < 3) return { x: junk(depth + 1), sid: junk(depth + 1) };
    return 0;
}
// Mostly-valid shapes too, so handlers get past their first lines.
function plausible(type) {
    const n = () => Math.floor(R() * 20);
    switch (type) {
        case "a": { const f = []; for (let i = 0; i < 13 * (1 + n() % 4); i++) f.push(i % 13 === 0 ? 1 + n() % 10 : pick([R() * 14400, n(), null, -1])); return [f]; }
        case "D": return [[pick(["me", "e2", "x"]), 1 + n() % 10, "p", R() * 14400, R() * 14400, 0, 100, 100, 35, 0], pick([true, false])];
        case "H": { const f = []; for (let i = 0; i < 8 * (1 + n() % 3); i++) f.push(i % 8 === 6 ? pick([3, 7, 15, 17, 99, null]) : i % 8 === 0 ? 5000 + n() : R() * 14400); return [f]; }
        case "O": return [1 + n() % 10, pick([0, 50, 100, -5, 1000, NaN])];
        case "X": return [R() * 14400, R() * 14400, R() * 6, 1000, 1.6, pick([0, 1, 9, 99]), 0, n()];
        case "V": return [pick([[5, 10], [99], [], null]), pick([true, false])];
        case "Q": return [5000 + n()];
        case "K": return [1 + n() % 10, pick([0, 1]), pick([0, 5, 10, 99])];
        default: return junk(0) instanceof Array ? junk(0) : [junk(1)];
    }
}

const env = await createRobotics();
const rb = env.rb;
const ws = await env.connect();
let world = spawnWorld(env);
for (let t = 0; t < 10; t++) serverTick(env, world, t);

let thrown = 0;
const thrownSamples = [];
const handlerFail = {};
let failsBefore = env.failures().length;
for (let i = 0; i < ROUNDS; i++) {
    const type = pick(TYPES);
    const args = R() < 0.6 ? plausible(type) : junk(0);
    try {
        if (R() < 0.05) {
            // Raw garbage bytes, not msgpack.
            const b = new Uint8Array(1 + Math.floor(R() * 20)).map(() => Math.floor(R() * 256));
            ws.emit("message", { data: b.buffer });
        } else {
            ws.emit("message", { data: encode(type, args) });
        }
        if (i % 7 === 0) { env.advance(111); env.frame(); }
    } catch (err) {
        thrown++;
        if (thrownSamples.length < 3) thrownSamples.push(type + ": " + err.message);
        if (process.env.STACK && thrown === 1) console.log(err.stack);
    }
    const fails = env.failures().length;
    if (fails > failsBefore) handlerFail[type] = (handlerFail[type] || 0) + fails - failsBefore;
    failsBefore = fails;
}
if (process.env.DETAIL) {
    const g = new Map();
    for (const w of env.failures()) { const k = w.replace(/\(x\d+\)/, "").replace(/packet \S+:/, "packet:").slice(0, 260); g.set(k, (g.get(k) || 0) + 1); }
    for (const [k, v] of [...g].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5) + "  " + k);
}
T.ok(thrown === 0, "no exception escapes the packet handler or the frame loop in " + ROUNDS + " packets (" + thrownSamples.join(" | ") + ")");
T.ok(Object.keys(handlerFail).length === 0, "malformed packets are dropped at the boundary, no handler throws: " + JSON.stringify(handlerFail));

// A normal game afterwards: respawn and play, with no new failures.
const before = env.failures().length;
env.server("C", [1]);
world = spawnWorld(env, { seed: 7 });
for (let t = 0; t < 60; t++) { serverTick(env, world, t); env.frame(); }
const after = env.failures().slice(before);
T.ok(after.length === 0, "a normal game after the fuzz runs clean (" + after.slice(0, 2).join(" | ") + ")");
T.ok(rb.AX && rb.Ai && rb.Ai.sid === 1, "state is sane after the fuzz: alive as sid 1");
T.ok(Number.isFinite(rb.Ai.x2) && Number.isFinite(rb.Ai.y2), "your position is finite (" + rb.Ai.x2 + ", " + rb.Ai.y2 + ", id " + rb.Ai.id + ", visible " + rb.Ai.visible + ", players with sid 1: " + rb.Ae.filter(p => p.sid === 1).length + ")");
T.ok(rb.Ae.every(p => p && typeof p.sid === "number"), "every player entry is a player");
const badObjects = [...rb.roboticsGrid.cells.values()].flat().filter(o => !Number.isFinite(o.x) || !Number.isFinite(o.y));
T.ok(badObjects.length === 0, "every object in the grid has a finite position" + badObjects.slice(0, 2).map(o => " [sid " + o.sid + " " + o.x + "," + o.y + " scale " + o.scale + " " + (o.name || "natural " + o.type) + "]").join(""));
T.ok(rb.roboticsLimiter.count <= rb.roboticsPacketBudget().perSecond, "the packet limit held during the fuzz");
T.done();
