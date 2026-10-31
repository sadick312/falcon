// Writes bench/recordings/sample-synthetic.fpl: a scripted 15 s fight in the same format as !plog exports
// (PacketRecorder.compileBinaryLog). It exists so the benchmark can run before you have a real recording;
// its numbers say little about real games, so benchmark real .fpl files for decisions.
//
// Usage: node mod-source/bench/make-sample-recording.mjs [--name sample-synthetic] [--seconds 15] [--enemies 2] [--objects 40]
// A longer, busier file (e.g. --name sample-busy --seconds 120 --enemies 6 --objects 160) lets the JIT warm up and
// stresses the per-object and per-enemy loops.
import { Encoder } from "@msgpack/msgpack";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map(a => a.trim().split(/\s+/)));
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "recordings");
const outPath = path.join(outDir, `${args.name ?? "sample-synthetic"}.fpl`);

const TICK_MS = 111;
const DURATION_MS = Number(args.seconds ?? 15) * 1000;
const ENEMIES = Number(args.enemies ?? 2);
const OBJECTS = Number(args.objects ?? 40);
const ME = 1;
const CENTER = { x: 5000, y: 5000 };

// Same PRNG as the game's packet shuffle; fixed seed so the file is identical on every run.
function prng(seed) {
    return () => {
        seed |= 0;
        seed = seed + 1831565813 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const random = prng(42);

const packets = [];
const add = (time, type, data) => packets.push({ time, type, data });

// [id, sid, name, x, y, dir, health, maxHealth, scale, skinColor]
const players = [
    { sid: ME, id: "me000000000000000001", name: "falcon", x: CENTER.x, y: CENTER.y, weapon: 5, hat: 6, tail: 0 },
    { sid: 2, id: "en000000000000000002", name: "enemy 1", x: CENTER.x + 220, y: CENTER.y, weapon: 5, hat: 7, tail: 0, orbit: 220, speed: 0.9 },
    { sid: 3, id: "en000000000000000003", name: "enemy 2", x: CENTER.x - 300, y: CENTER.y + 80, weapon: 15, hat: 7, tail: 0, orbit: 310, speed: -0.6 }
].slice(0, 1 + ENEMIES);
for (let sid = players.length + 1; sid <= 1 + ENEMIES; sid++) {
    const orbit = 180 + (sid * 70) % 400;
    players.push({ sid, id: `en${String(sid).padStart(18, "0")}`, name: `enemy ${sid - 1}`, x: CENTER.x + orbit, y: CENTER.y, weapon: sid % 2 ? 5 : 15, hat: 7, tail: 0, orbit, speed: (sid % 2 ? 1 : -1) * (0.4 + (sid % 4) * 0.15) });
}

add(0, "C", [ME]);
add(0, "A", [{ teams: [] }]);
for (const p of players) add(0, "D", [[p.id, p.sid, p.name, p.x, p.y, 0, 100, 100, 35, 0], p.sid === ME]);
add(0, "V", [[0, 3, 6, 15, 10], false]);
add(0, "V", [[5, 15], true]);

// Trees and rocks around the fight, plus enemy spikes and a trap: [sid, x, y, dir, scale, type, itemId, owner]
const objects = [];
let objectSid = 1000;
for (let i = 0; i < OBJECTS; i++) {
    const angle = random() * Math.PI * 2;
    const dist = 250 + random() * 900;
    objects.push(objectSid++, Math.round(CENTER.x + Math.cos(angle) * dist), Math.round(CENTER.y + Math.sin(angle) * dist), 0, 140 + Math.round(random() * 60), i % 3, null, null);
}
for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    objects.push(objectSid++, Math.round(CENTER.x + Math.cos(angle) * 130), Math.round(CENTER.y + Math.sin(angle) * 130), angle, 45, null, 6, 2);
}
objects.push(objectSid++, CENTER.x + 60, CENTER.y - 40, 0, 50, null, 15, Math.min(3, players.length));
add(0, "H", [objects]);

const lastAttributes = new Map();
for (let time = TICK_MS, tick = 0; time <= DURATION_MS; time += TICK_MS, tick++) {
    const positions = [];
    const attributes = [];

    for (const p of players) {
        if (p.orbit) {
            const angle = tick * 0.05 * p.speed + p.sid;
            p.x = Math.round(CENTER.x + Math.cos(angle) * p.orbit);
            p.y = Math.round(CENTER.y + Math.sin(angle) * p.orbit);
            p.hat = tick % 9 < 3 ? 6 : 7;
        } else {
            p.x = Math.round(CENTER.x + Math.sin(tick * 0.03) * 40);
            p.y = Math.round(CENTER.y + Math.cos(tick * 0.03) * 40);
        }

        const dir = p.sid === ME ? 0 : Math.atan2(CENTER.y - p.y, CENTER.x - p.x);
        positions.push(p.sid, p.x, p.y, Math.round(dir * 100));

        const values = [-1, p.weapon, 0, null, 0, p.hat, p.tail, 0, 0];
        const key = values.join();
        if (lastAttributes.get(p.sid) !== key) {
            lastAttributes.set(p.sid, key);
            attributes.push(p.sid, ...values);
        }
    }

    add(time, "a", [positions, attributes, []]);

    // An enemy swing every ~1 s that hits, then the damage and a heal.
    if (tick % 9 === 4) {
        add(time + 5, "K", [2, true, 5]);
        add(time + 6, "O", [ME, 55]);
        add(time + TICK_MS + 6, "O", [ME, 100]);
    }
}

// Same binary layout as PacketRecorder.compileBinaryLog: f64 time, i32 length, msgpack [type, data], i32 0 (no brain state).
const encoder = new Encoder();
const chunks = [];
for (const { time, type, data } of packets.sort((a, b) => a.time - b.time)) {
    const body = encoder.encode([type, data]);
    const header = new DataView(new ArrayBuffer(12));
    header.setFloat64(0, time, true);
    header.setInt32(8, body.length, true);
    chunks.push(new Uint8Array(header.buffer), body, new Uint8Array(4));
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, Buffer.concat(chunks));
console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${packets.length} packets, ${DURATION_MS / 1000} s, ${ENEMIES} enemies, ${OBJECTS} resources).`);
