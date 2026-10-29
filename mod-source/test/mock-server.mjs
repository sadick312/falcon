// Mock moomodding.io game server for play-testing the real Falcon build offline.
// Run: npm run inject:build, then npm run mock --workspace=mod-source, then open http://localhost:8780/?v=1.8.2
// (or ?v=1.6.9), press Multiplayer, then Join Server with no server selected: that connects here.
// - http://localhost:8780/?v=1.8.2  test page: loads the Quick Inject build, <base href="/<v>/"> drives version detection
// - ws://localhost:1234/             game socket (Falcon's local dev server), v1.8.2 wire format, plain msgpack
// - /img/*                           proxied from sandbox.moomodding.io so sprites render
import http from "http";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { encode, decode } from "@msgpack/msgpack";

const BUILD = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "falcon-quick-inject.js");
const LOG = [];
const log = (...a) => { const line = `[${new Date().toISOString().slice(11, 23)}] ` + a.join(" "); LOG.push(line); if (LOG.length > 400) LOG.shift(); };

// ── Game data (moomoo values) ──
const WEAPONS = { // dmg, reload ms, range
    0: [25, 300, 65], 1: [30, 400, 70], 2: [35, 400, 75], 3: [35, 300, 110], 4: [40, 300, 118], 5: [45, 700, 142],
    6: [20, 300, 110], 7: [20, 100, 65], 8: [1, 400, 128], 10: [10, 400, 75], 11: [15, 700, 55], 14: [0, 700, 125]
};
const VARIANT = [1, 1.1, 1.18, 1.18];
const ITEM_SCALE = { 3: 50, 4: 50, 5: 52, 6: 49, 7: 52, 8: 52, 9: 52, 10: 45, 15: 50, 16: 45 };

// ── HTTP: test page, build, sprite proxy ──
const page = v => `<!doctype html><html><head><meta charset="utf-8"><base href="/${v}/"><title>Falcon mock ${v}</title></head>
<body><script>localStorage.setItem("falcon-dev-profile","moomodding");</script><script src="/build.js"></script></body></html>`;

http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/build.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(fs.readFileSync(BUILD)); }
    if (url.pathname === "/log") { res.setHeader("Content-Type", "text/plain"); return res.end(LOG.join("\n")); }
    if (url.pathname.startsWith("/img/") || url.pathname.includes("/img/")) {
        const path = url.pathname.slice(url.pathname.indexOf("/img/"));
        try {
            const r = await fetch("https://sandbox.moomodding.io" + path);
            res.statusCode = r.status;
            res.setHeader("Content-Type", r.headers.get("content-type") ?? "image/png");
            return res.end(Buffer.from(await r.arrayBuffer()));
        } catch { res.statusCode = 502; return res.end(); }
    }
    if (url.pathname === "/" || url.pathname.match(/^\/\d/)) {
        res.setHeader("Content-Type", "text/html");
        return res.end(page(url.searchParams.get("v") ?? "1.8.2"));
    }
    res.statusCode = 404; res.end();
}).listen(8780, "127.0.0.1", () => console.log("page on 8780"));

// ── Minimal WebSocket server (RFC 6455, no extensions) ──
function wsAccept(req, socket, onMessage, onClose) {
    const accept = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
    let buf = Buffer.alloc(0);
    socket.on("data", chunk => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 2) {
            const op = buf[0] & 0x0f; let len = buf[1] & 0x7f; let off = 2;
            if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
            else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
            const masked = buf[1] & 0x80; const total = off + (masked ? 4 : 0) + len;
            if (buf.length < total) return;
            const mask = masked ? buf.subarray(off, off + 4) : null; off += masked ? 4 : 0;
            const data = Buffer.from(buf.subarray(off, off + len));
            if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
            buf = buf.subarray(total);
            if (op === 8) { socket.end(); return; }
            if (op === 2 || op === 1) onMessage(data);
        }
    });
    socket.on("close", onClose); socket.on("error", () => { });
    return payload => {
        const len = payload.length; let header;
        if (len < 126) header = Buffer.from([0x82, len]);
        else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x82; header[1] = 126; header.writeUInt16BE(len, 2); }
        else { header = Buffer.alloc(10); header[0] = 0x82; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
        if (!socket.destroyed) socket.write(Buffer.concat([header, payload]));
    };
}

// ── Game ──
const TICK = 111;
let nextObjSid = 1000;

function newPlayer(sid, name, x, y) {
    return { id: "p" + sid, sid, name, x, y, dir: 0, health: 100, buildIndex: -1, weaponIndex: 5, weaponVariant: 0, team: null,
        isLeader: 0, skinIndex: 0, tailIndex: 0, iconIndex: 0, zIndex: 0, moveDir: null, autoGather: false, hitQueued: false,
        lastSwing: 0, weapons: [5, 10], heal: false, alive: true };
}

http.createServer().on("upgrade", (req, socket) => {
    let me = null, bot = null, timer = null, objects = [];
    /** Enemy players added by \stress; they circle around me so Falcon's enemy logic has work to do. */
    let extras = [];
    const stats = { packetsIn: 0, byType: {} };
    const send = wsAccept(req, socket, data => {
        let msg; try { msg = decode(data); } catch { log("bad msgpack"); return; }
        const [type, args = []] = msg; stats.packetsIn++; stats.byType[type] = (stats.byType[type] ?? 0) + 1;
        handle(type, args);
    }, () => { clearInterval(timer); log("client closed", JSON.stringify(stats.byType)); });
    const out = (type, ...args) => send(Buffer.from(encode([type, args])));

    log("client connected", req.url);
    out("io-init", "mock-socket-id");
    out("A", { teams: [] });

    function playerInit(p) { return [p.id, p.sid, p.name, p.x, p.y, p.dir, p.health, 100, 35, 0]; }

    function handle(type, a) {
        switch (type) {
            case "M": { // join
                me = newPlayer(1, a[0]?.name ?? "me", 7200, 7200);
                out("C", me.sid);
                out("D", playerInit(me), true);
                out("V", me.weapons, true);
                out("V", [0, 3, 6, 10, 15], false);
                out("T", 0, 300, 1);
                log("joined as", me.name);
                timer = setInterval(tick, TICK);
                break;
            }
            case "9": if (me) me.moveDir = a[0]; break;               // move
            case "e": if (me) me.moveDir = null; break;               // reset move
            case "D": if (me) me.dir = a[0]; break;                   // aim
            case "K": if (me && a[0] === 1) me.autoGather = !me.autoGather; break;
            case "F": if (me) { if (typeof a[1] === "number") me.dir = a[1]; if (a[0]) me.hitQueued = true; } break;
            case "z": if (me) { if (a[1]) { me.weaponIndex = a[0]; me.buildIndex = -1; } else me.buildIndex = me.buildIndex === a[0] ? -1 : a[0]; } break;
            case "c": if (me) { if (a[0]) out("5", 0, a[1], a[2] ? 1 : 0); else if (a[2]) me.tailIndex = a[1]; else me.skinIndex = a[1]; } break;
            case "0": out("0"); break;
            case "6": chat(String(a[0] ?? "")); break;
            case "H": case "S": case "b": case "N": case "L": case "P": case "Q": case "R": case "T": case "A": case "V": break;
            default: log("unhandled", type, JSON.stringify(a).slice(0, 80));
        }
    }

    function whisper(text) { out("6", me.sid, text); }

    function chat(text) {
        if (!me) return;
        log("chat", JSON.stringify(text));
        if (!text.startsWith("\\")) { out("6", me.sid, text); return; }
        const p = text.split(/\s+/);
        if (p[0] === "\\b") {
            const sub = p[1];
            if (sub === "t") { if (bot) { bot.x = me.x + 60; bot.y = me.y; } return; }
            if (sub === "d") { if (bot) { bot.alive = false; bot = null; } return; }
            if (sub === "hl") { if (bot) { bot.heal = p[2] === "on" || p[2] === "1" || (p[2] === undefined && !bot.heal); if (bot.heal) bot.health = 100, out("O", bot.sid, 100); } return; }
            if (["h", "ac", "w", "v", "i"].includes(sub)) {
                if (!bot) return whisper("no bot");
                const n = parseInt(p[2]);
                if (sub === "h") bot.skinIndex = n; else if (sub === "ac") bot.tailIndex = n;
                else if (sub === "w") bot.weaponIndex = n; else if (sub === "i") bot.buildIndex = n;
                else bot.weaponVariant = { n: 0, g: 1, d: 2, r: 3 }[p[2]] ?? n;
                return;
            }
            // spawn: \b [name]
            if (bot) return whisper("max 1 bot");
            bot = newPlayer(2, sub ?? "Target", me.x + 60, me.y);
            bot.weaponIndex = 0;
            out("D", playerInit(bot), false);
            return;
        }
        if (p[0] === "\\stress") { stress(parseInt(p[1]) || 200, parseInt(p[2]) || 4); return; }
        if (p[0] === "\\v") { me.weaponVariant = { n: 0, g: 1, d: 2, r: 3 }[p[1]] ?? parseInt(p[1]); return; }
        if (p[0] === "\\c") {
            if (p[1] !== "b") { objects = []; out("R", me.sid); }
            if ((p[1] === "a" || p[1] === "b") && bot) { bot.alive = false; bot = null; }
            return;
        }
        whisper("unknown command");
    }

    /** \stress [objects] [enemies]: a ring of enemy-owned structures around me plus moving enemy players. */
    function stress(count, enemyCount) {
        const ids = [3, 6, 15, 10, 4, 7];
        const batch = [];
        for (let i = 0; i < count; i++) {
            const ring = 120 + (i % 8) * 70, ang = (i / count) * Math.PI * 2 * 8;
            const id = ids[i % ids.length];
            const o = [nextObjSid++, Math.round(me.x + Math.cos(ang) * ring), Math.round(me.y + Math.sin(ang) * ring), 0, ITEM_SCALE[id] ?? 45, -1, id, 99];
            objects.push(o); batch.push(...o);
        }
        out("H", batch);
        for (let i = 0; i < enemyCount; i++) {
            const e = newPlayer(10 + i, "Enemy" + i, me.x + 200, me.y);
            e.weaponIndex = [5, 4, 3, 0][i % 4]; e.skinIndex = [7, 6, 0, 40][i % 4]; e.phase = i * 1.7;
            extras.push(e); out("D", playerInit(e), false);
        }
        log("stress", count, "objects", enemyCount, "enemies");
    }

    function swing() {
        const now = Date.now();
        const w = WEAPONS[me.weaponIndex] ?? WEAPONS[0];
        if (now - me.lastSwing < w[1]) return;
        me.lastSwing = now;

        if (me.buildIndex >= 0) { // place or eat
            const id = me.buildIndex;
            if (id <= 2) { me.health = Math.min(100, me.health + 20); out("O", me.sid, me.health); }
            else {
                const scale = ITEM_SCALE[id] ?? 45;
                const dist = 35 + scale + 5;
                const o = [nextObjSid++, Math.round(me.x + Math.cos(me.dir) * dist), Math.round(me.y + Math.sin(me.dir) * dist), me.dir, scale, -1, id, me.sid];
                objects.push(o); out("H", o);
            }
            me.buildIndex = -1;
            return;
        }

        let didHit = false;
        if (bot && bot.alive) {
            const dx = bot.x - me.x, dy = bot.y - me.y, d = Math.hypot(dx, dy);
            let ang = Math.abs(Math.atan2(dy, dx) - me.dir); if (ang > Math.PI) ang = 2 * Math.PI - ang;
            if (d <= w[2] + 35 && ang <= Math.PI / 2.6) {
                const soldier = bot.skinIndex === 6 ? 0.75 : 1;
                const dmg = w[0] * VARIANT[me.weaponVariant] * soldier;
                bot.health = Math.max(0, bot.health - dmg); didHit = true;
                out("O", bot.sid, bot.health);
                if (bot.health <= 0) { log("bot died"); bot.alive = false; bot = null; }
            }
        }
        out("K", me.sid, didHit, me.weaponIndex);
    }

    function row(p) { return [p.sid, p.x, p.y, p.dir, p.buildIndex, p.weaponIndex, p.weaponVariant, p.team, p.isLeader, p.skinIndex, p.tailIndex, p.iconIndex, p.zIndex]; }

    function tick() {
        if (!me) return;
        if (typeof me.moveDir === "number") { me.x += Math.cos(me.moveDir) * 25; me.y += Math.sin(me.moveDir) * 25; }
        if (me.autoGather || me.hitQueued) { swing(); me.hitQueued = false; }
        if (bot && bot.heal && bot.health < 100) { bot.health = Math.min(100, bot.health + 6); out("O", bot.sid, bot.health); }
        const flat = row(me);
        if (bot && bot.alive) flat.push(...row(bot));
        const t = Date.now() / 1000;
        for (const e of extras) {
            e.x = Math.round(me.x + Math.cos(t + e.phase) * 160);
            e.y = Math.round(me.y + Math.sin(t + e.phase) * 160);
            e.dir = Math.atan2(me.y - e.y, me.x - e.x);
            flat.push(...row(e));
        }
        out("a", flat);
    }
}).listen(1234, "127.0.0.1", () => console.log("game ws on 1234"));
