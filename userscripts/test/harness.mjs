/* Node harness for robotics-kusoi.user.js.
   Loads the whole userscript in a vm context with a mocked page (DOM
   elements, 2D canvas, WebSocket, localStorage, timers, clock) and the real
   msgpack-lite, then drives it through a fake game socket like the server
   would. Nothing connects anywhere.

   Internals are reached through window.__rb, which the harness inserts into
   the loaded source text right before the script's start-up call (rN()). The
   file on disk is not modified. */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import msgpack from "msgpack-lite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// ROBOTICS_SCRIPT=path benchmarks/tests another copy of the script (e.g. the previous version).
export const SCRIPT_PATH = process.env.ROBOTICS_SCRIPT ? path.resolve(process.env.ROBOTICS_SCRIPT) : path.join(HERE, "..", "robotics-kusoi.user.js");

// Names exposed on window.__rb (getters, so tests always see the current binding).
const EXPOSE = [
    "A3", "cF", "fU", "roboticsLimiter", "roboticsGrid", "roboticsSim", "roboticsAngles", "sN", "em", "s4", "s5", "s6", "sr", "r", "sc", "sV", "AW",
    "fu", "fl", "roboticsBudget", "roboticsPacketBudget", "roboticsBudgetFree", "roboticsResetWorld", "roboticsHitChance", "roboticsTargetWeakness",
    "roboticsReloadSlack", "roboticsWeaponDamage", "roboticsInCombatRange", "roboticsNextTickThreat", "roboticsSafeWalkSteer", "roboticsPlanAttack",
    "roboticsAutoHeal", "roboticsGear", "roboticsWantGear", "et", "ev", "eZ", "A0", "roboticsKnockbackHit", "roboticsFalconAttacks", "roboticsOneTickPlan",
    "eD", "Ai", "AX", "Ae", "Ad", "Ak", "AQ", "Ac", "AH", "AF", "ey", "fy", "fB", "e5", "e6", "sQ", "Ag", "Ap", "eM", "sh"
];

function makeSource() {
    let src = fs.readFileSync(SCRIPT_PATH, "utf8").split("\r\n").join("\n");
    const marker = "\n        rN();\n";
    if (src.indexOf(marker) < 0) throw new Error("harness: start-up marker rN() not found");
    const getters = EXPOSE.map(n => `get ${n}() { return typeof ${n} === "undefined" ? undefined : ${n}; }`).join(",\n");
    src = src.replace(marker, `\n        window.__rb = {\n${getters},\n set Ai(v) { Ai = v; }, set AQ(v) { AQ = v; }, set Ad(v) { Ad = v; }, set Ak(v) { Ak = v; } };` + marker);
    return src;
}

let cachedScript = null;
function compiled() {
    if (!cachedScript) cachedScript = new vm.Script(makeSource(), { filename: "robotics-kusoi.user.js" });
    return cachedScript;
}

/* ---- 2D context: plain no-op methods, so frame timing measures the script, not mocks. */
const CTX_METHODS = ["save", "restore", "translate", "rotate", "scale", "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo", "rect", "roundRect",
    "ellipse", "fill", "stroke", "fillRect", "strokeRect", "clearRect", "drawImage", "fillText", "strokeText", "setTransform", "resetTransform", "transform",
    "quadraticCurveTo", "bezierCurveTo", "clip", "putImageData", "setLineDash", "drawFocusIfNeeded"];
function makeCtx(canvas) {
    const ctx = { canvas, globalAlpha: 1, lineWidth: 1, font: "10px sans-serif", fillStyle: "#000", strokeStyle: "#000", textAlign: "start", textBaseline: "alphabetic",
        lineJoin: "miter", lineCap: "butt", globalCompositeOperation: "source-over", imageSmoothingEnabled: true, shadowBlur: 0, shadowColor: "" };
    for (const m of CTX_METHODS) ctx[m] = function () {};
    ctx.measureText = t => ({ width: String(t).length * 8 });
    ctx.createLinearGradient = ctx.createRadialGradient = ctx.createPattern = () => ({ addColorStop() {} });
    ctx.getImageData = (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(0, w * h * 4)) });
    ctx.createImageData = (w, h) => ({ data: new Uint8ClampedArray(Math.max(0, w * h * 4)) });
    ctx.isPointInPath = () => false;
    ctx.getLineDash = () => [];
    return ctx;
}

/* ---- DOM elements: stores whatever is assigned; unknown methods are no-ops returning an element. */
function makeElement(doc, tag, id) {
    const target = {
        tagName: String(tag || "div").toUpperCase(), id: id || "", children: [], childNodes: [], style: {}, dataset: {}, attributes: {},
        className: "", innerHTML: "", textContent: "", value: undefined, width: 1280, height: 720, offsetWidth: 100, offsetHeight: 20,
        clientWidth: 1280, clientHeight: 720, scrollTop: 0, scrollHeight: 0, parentNode: null, firstChild: null, nodeType: 1, listeners: {}
    };
    target.classList = {
        set: new Set(),
        add(...c) { c.forEach(x => this.set.add(x)); }, remove(...c) { c.forEach(x => this.set.delete(x)); },
        contains(c) { return this.set.has(c); }, toggle(c, f) { const on = f === undefined ? !this.set.has(c) : f; on ? this.set.add(c) : this.set.delete(c); return on; }
    };
    let ctx = null;
    const methods = {
        appendChild(c) { target.children.push(c); target.firstChild = target.children[0]; if (c && typeof c === "object") c.parentNode = proxy; return c; },
        insertBefore(c) { target.children.unshift(c); target.firstChild = c; return c; },
        removeChild(c) { const i = target.children.indexOf(c); if (i >= 0) target.children.splice(i, 1); target.firstChild = target.children[0] || null; return c; },
        remove() {}, append(...c) { c.forEach(x => methods.appendChild(x)); }, prepend(c) { methods.insertBefore(c); },
        addEventListener(t, f) { (target.listeners[t] = target.listeners[t] || []).push(f); }, removeEventListener() {},
        dispatchEvent() { return true; }, focus() {}, blur() {}, click() {}, select() {},
        setAttribute(k, v) { target.attributes[k] = String(v); }, getAttribute(k) { return target.attributes[k] ?? null; }, removeAttribute(k) { delete target.attributes[k]; },
        querySelector() { return makeElement(doc, "div"); }, querySelectorAll() { return []; }, getElementsByTagName() { return []; }, getElementsByClassName() { return []; },
        getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }; },
        getContext() { return ctx || (ctx = makeCtx(proxy)); },
        toDataURL() { return "data:image/png;base64,"; }, cloneNode() { return makeElement(doc, tag); }, contains() { return false; },
        hasChildNodes() { return target.children.length > 0; }, closest() { return null; }, matches() { return false; }, scrollIntoView() {},
        requestPointerLock() {}, play() { return Promise.resolve(); }, pause() {}
    };
    const proxy = new Proxy(target, {
        get(t, p) {
            if (p === "lastChild") return t.children[t.children.length - 1] || null;
            if (p === "firstChild") return t.children[0] || null;
            if (p in t) return t[p];
            if (p in methods) return methods[p];
            if (typeof p === "symbol") return undefined;
            return undefined;
        },
        set(t, p, v) { t[p] = v; return true; }
    });
    return proxy;
}

function makeStorage(initial) {
    const m = new Map(Object.entries(initial || {}).map(([k, v]) => [k, String(v)]));
    return {
        getItem: k => m.has(String(k)) ? m.get(String(k)) : null,
        setItem: (k, v) => { m.set(String(k), String(v)); },
        removeItem: k => { m.delete(String(k)); },
        clear: () => m.clear(),
        key: i => [...m.keys()][i] ?? null,
        get length() { return m.size; },
        _map: m
    };
}

/* ---- Fake socket: records what the mod sends; the test pushes server packets in. */
class FakeWS {
    constructor(url) { this.url = String(url); this.readyState = 0; this.binaryType = "blob"; this.l = {}; this.out = []; }
    addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
    removeEventListener(t, f) { this.l[t] = (this.l[t] || []).filter(x => x !== f); }
    emit(t, e) { for (const f of (this.l[t] || []).slice()) f.call(this, e); }
    send(d) { this.out.push(d); }
    close() { this.readyState = 3; this.emit("close", { code: 1000, reason: "" }); }
}
FakeWS.CONNECTING = 0; FakeWS.OPEN = 1; FakeWS.CLOSING = 2; FakeWS.CLOSED = 3;

export function encode(type, args) {
    const b = msgpack.encode([type, args]);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
export function decode(data) {
    const u = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer || data, data.byteOffset || 0, data.byteLength);
    return msgpack.decode(u);
}

/* Create a running mod. opts.host (default sandbox), opts.storage (localStorage
   values, e.g. toggles "autoPlace": "true"), opts.quiet (hide console). */
export async function createRobotics(opts = {}) {
    const host = opts.host || "sandbox.moomodding.io";
    const clock = { t: 1000, epoch: 1.7e12 };
    const timers = [];
    let timerId = 0;
    const warnings = [];
    const errors = [];
    const rafQueue = [];
    const storage = makeStorage(opts.storage);
    const docListeners = {};
    const ids = new Map();
    const doc = {
        readyState: "complete", baseURI: "https://" + host + "/", cookie: "", hidden: false, visibilityState: "visible",
        getElementById(id) {
            if (opts.missingIds && opts.missingIds.includes(id)) return null;
            if (!ids.has(id)) ids.set(id, makeElement(doc, "div", id));
            return ids.get(id);
        },
        createElement: tag => makeElement(doc, tag), createElementNS: (ns, tag) => makeElement(doc, tag),
        createTextNode: t => ({ nodeType: 3, textContent: String(t) }), createDocumentFragment: () => makeElement(doc, "fragment"),
        querySelector: () => makeElement(doc, "div"), querySelectorAll: () => [], getElementsByTagName: () => [], getElementsByClassName: () => [],
        addEventListener(t, f) { (docListeners[t] = docListeners[t] || []).push(f); }, removeEventListener() {},
        hasFocus: () => true, execCommand: () => false
    };
    doc.body = makeElement(doc, "body"); doc.head = makeElement(doc, "head"); doc.documentElement = makeElement(doc, "html");
    doc.activeElement = doc.body;
    const RealDate = Date;
    class FakeDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(clock.epoch + clock.t); }
        static now() { return clock.epoch + clock.t; }
    }
    const sandbox = {
        console: opts.quiet === false ? console : {
            log() {}, info() {}, debug() {},
            warn: (...a) => { warnings.push(a.map(String).join(" ")); },
            error: (...a) => { errors.push(a.map(String).join(" ")); }
        },
        document: doc, localStorage: storage, sessionStorage: makeStorage(),
        location: { hostname: host, host, href: "https://" + host + "/?server=1:1", origin: "https://" + host, pathname: "/", search: "?server=1:1", protocol: "https:", reload() { sandbox.__reloads++; } },
        navigator: { userAgent: "node", platform: "node", language: "en", clipboard: { writeText: () => Promise.resolve() }, maxTouchPoints: 0 },
        performance: { now: () => clock.t },
        Date: FakeDate,
        setTimeout: (f, ms, ...a) => { const id = ++timerId; timers.push({ id, at: clock.t + Math.max(0, +ms || 0), f, a }); return id; },
        clearTimeout: id => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); },
        setInterval: () => { throw new Error("setInterval used"); },
        clearInterval: () => {},
        requestAnimationFrame: f => { rafQueue.push(f); return rafQueue.length; },
        cancelAnimationFrame: () => {},
        queueMicrotask,
        innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
        Image: class { constructor() { this.onload = null; this.width = 0; this.height = 0; this.src = ""; } },
        Audio: class { constructor(src) { this.src = src; } play() { return Promise.resolve(); } pause() {} },
        MutationObserver: class { constructor(f) { this.f = f; } observe() {} disconnect() {} },
        CanvasRenderingContext2D: function () {}, HTMLCanvasElement: function () {}, HTMLElement: function () {}, Element: function () {},
        KeyboardEvent: class { constructor(t, o) { Object.assign(this, o || {}); this.type = t; } preventDefault() {} stopPropagation() {} },
        Event: class { constructor(t) { this.type = t; } },
        // A fresh subclass per instance: the script patches WebSocket.prototype.send.
        WebSocket: class extends FakeWS {},
        URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, Map, Set, WeakMap, Promise, JSON,
        // Seeded Math.random, so two runs (or two versions of the script) see the same game.
        Math: Object.assign(Object.create(Math), { random: rng(opts.seed || 1) }),
        __reloads: 0
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.top = sandbox;
    sandbox.addEventListener = (t, f) => { (docListeners["window:" + t] = docListeners["window:" + t] || []).push(f); };
    sandbox.removeEventListener = () => {};
    sandbox.getComputedStyle = () => ({ getPropertyValue: () => "" });
    sandbox.matchMedia = () => ({ matches: false, addEventListener() {} });
    sandbox.msgpack = msgpack;
    vm.createContext(sandbox);
    compiled().runInContext(sandbox);
    await Promise.resolve();
    await Promise.resolve();

    const env = {
        sandbox, clock, storage, warnings, errors, timers, rafQueue,
        get rb() { return sandbox.__rb; },
        ws: null,
        // Run due timers (the mod's setTimeout calls) up to now.
        runTimers() {
            for (let guard = 0; guard < 10000; guard++) {
                timers.sort((a, b) => a.at - b.at || a.id - b.id);
                const t = timers[0];
                if (!t || t.at > clock.t) return;
                timers.shift();
                t.f(...t.a);
            }
        },
        // Move the clock forward, stopping at each timer on the way (timers set by timers run too).
        advance(ms) {
            const end = clock.t + ms;
            for (let guard = 0; guard < 10000; guard++) {
                timers.sort((a, b) => a.at - b.at || a.id - b.id);
                const t = timers[0];
                if (!t || t.at > end) break;
                timers.shift();
                clock.t = Math.max(clock.t, t.at);
                t.f(...t.a);
            }
            clock.t = end;
        },
        // Open the game socket (as the page would) and let the mod attach it.
        async connect(url) {
            const ws = new sandbox.WebSocket(url || "wss://s1.moomodding.io/?token=t");
            ws.readyState = 1;
            env.ws = ws;
            await Promise.resolve();
            return ws;
        },
        server(type, args) { env.ws.emit("message", { data: encode(type, args) }); },
        // One render frame: what the page's requestAnimationFrame would run.
        frame() {
            const q = rafQueue.splice(0);
            for (const f of q) f(clock.t);
            if (!q.length && sandbox.__rb) sandbox.__rb.cF();
        },
        sent() { return env.ws ? env.ws.out.map(decode) : []; },
        failures() { return warnings.filter(w => /\[Robotics\].*fail/.test(w)); }
    };
    env.advance(150); // menu set-up timers (BoxF reads toggles 100 ms after building)
    return env;
}

/* ---- Synthetic game (same shape as the browser replay bench): you, objects, enemies. */
export function rng(seed) {
    return function () {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}
export function spawnWorld(env, opts = {}) {
    const R = rng(opts.seed || 12345);
    const me = { sid: 1, x: 7000, y: 7000 };
    env.server("C", [1]);
    env.server("D", [["me", 1, "me", me.x, me.y, 0, 100, 100, 35, 0], true]);
    env.server("V", [[5, 10], true]);
    env.server("V", [[0, 3, 7, 10, 15, 22], false]);
    let sid = 1000;
    const objects = [];
    for (let i = 0; i < (opts.resources ?? 400); i++) {
        const type = Math.floor(R() * 4);
        const scale = type === 0 ? 150 + Math.floor(R() * 25) : type === 1 ? 80 + Math.floor(R() * 15) : 80 + Math.floor(R() * 10);
        objects.push(sid++, Math.floor(R() * 14000) + 200, Math.floor(R() * 14000) + 200, 0, scale, type, null, -1);
    }
    const items = [[3, 50], [7, 52], [15, 50], [10, 45], [17, 43], [4, 50]];
    for (let i = 0; i < (opts.buildings ?? 500); i++) {
        const [id, scale] = items[Math.floor(R() * items.length)];
        const owner = [1, 2, 3, 4, 5, 6, 7, 8, 9, 101, 102][Math.floor(R() * 11)];
        objects.push(sid++, me.x + Math.floor((R() - 0.5) * 3000), me.y + Math.floor((R() - 0.5) * 3000), R() * 6.28, scale, null, id, owner);
    }
    env.server("H", [objects]);
    const enemies = [];
    for (let i = 0; i < (opts.enemies ?? 8); i++) {
        const a = R() * Math.PI * 2;
        const d = 150 + R() * 250;
        const e = { sid: 2 + i, x: me.x + Math.cos(a) * d, y: me.y + Math.sin(a) * d, health: 100 };
        enemies.push(e);
        env.server("D", [["e" + e.sid, e.sid, "enemy" + e.sid, e.x, e.y, 0, 100, 100, 35, 0], false]);
    }
    return { me, enemies, R, nextSid: sid, projSid: 1, myHealth: 100 };
}
// One server tick: players update (13 fields each), health changes and a projectile now and then.
export function serverTick(env, world, t) {
    const { me, enemies, R } = world;
    me.x += (R() - 0.5) * 6;
    me.y += (R() - 0.5) * 6;
    const flat = [me.sid, me.x, me.y, 0, -1, 5, 2, null, 0, 6, 0, 0, 0];
    for (const e of enemies) {
        e.x += (R() - 0.5) * 20;
        e.y += (R() - 0.5) * 20;
        flat.push(e.sid, e.x, e.y, Math.atan2(me.y - e.y, me.x - e.x), -1, 5, 2, null, 0, 7, 0, 0, 0);
    }
    if (t % 3 === 0) {
        world.myHealth = Math.max(20, world.myHealth - 35);
        env.server("O", [me.sid, world.myHealth]);
    } else if (t % 3 === 2) {
        world.myHealth = 100;
        env.server("O", [me.sid, world.myHealth]);
    }
    if (t % 5 === 0) {
        const e = enemies[t % enemies.length];
        env.server("X", [e.x, e.y, Math.atan2(me.y - e.y, me.x - e.x), 1000, 1.6, 0, 0, world.projSid++]);
    }
    env.clock.t += 111;
    env.runTimers();
    env.server("a", [flat]);
}

/* ---- Tiny test reporter shared by the test files. */
export function reporter(name) {
    let pass = 0;
    let fail = 0;
    return {
        ok(cond, msg) {
            if (cond) { pass++; } else { fail++; console.log("  FAIL " + msg); }
            if (cond && process.env.VERBOSE) console.log("  PASS " + msg);
        },
        done() {
            console.log((fail ? "FAIL " : "ok   ") + name + ": " + pass + " passed" + (fail ? ", " + fail + " failed" : ""));
            if (fail) process.exitCode = 1;
            return { pass, fail };
        }
    };
}
