// ==UserScript==
// @name         Sandbox HUD
// @namespace    https://sandbox.moomodding.io/
// @version      1.0.0
// @description  FPS, frame time, ping, packet rate and position HUD for sandbox.moomodding.io
// @match        https://sandbox.moomodding.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    const MOD = "[SandboxHUD]";

    /* ================================ CONFIG ================================ */

    const DEFAULTS = {
        menuKey: "Backquote", // KeyboardEvent.code, so it works on any keyboard layout
        hudKey: "F2",
        hudHz: 4, // HUD text refreshes per second
        corner: "top-left",
        // Send our own ping if the game hasn't sent one for this long. 0 = never.
        pingProbeMs: 3000,
        show: { fps: true, frameTime: true, ping: true, packets: true, position: true },
        hudVisible: true
    };
    const STORAGE_KEY = "sandbox-hud-config";
    const CONFIG = loadConfig();

    /* ================================ UTILS ================================= */

    const loggedOnce = new Set();
    function log(...args) { console.log(MOD, ...args); }
    function err(label, e) {
        // One log per label: a hook that fails every frame shouldn't flood the console.
        if (loggedOnce.has(label)) return;
        loggedOnce.add(label);
        console.error(MOD, label, e ?? "");
    }

    function loadConfig() {
        const cfg = structuredClone(DEFAULTS);
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            Object.assign(cfg, saved, { show: Object.assign(cfg.show, saved.show) });
        } catch (e) {
            console.warn(MOD, "Saved config unreadable, using defaults.", e);
        }
        return cfg;
    }
    function saveConfig() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(CONFIG)); } catch { /* private mode */ }
    }

    function isTyping(el) {
        if (!el || el === document.body) return false;
        if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
        return el.tagName === "INPUT" && !/^(checkbox|radio|range|button)$/.test(el.type);
    }

    function onReady(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
        else fn();
    }

    /* ---- minimal msgpack decoder (only what the game sends) ---- */

    const utf8 = new TextDecoder();
    function decode(u8) {
        const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        let p = 0;
        const str = (n) => { const s = utf8.decode(u8.subarray(p, p + n)); p += n; return s; };
        const arr = (n) => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = read(); return a; };
        const map = (n) => { const o = {}; for (let i = 0; i < n; i++) { const k = read(); o[k] = read(); } return o; };
        const bin = (n) => { const b = u8.slice(p, p + n); p += n; return b; };
        function read() {
            const b = u8[p++];
            if (b < 0x80) return b;
            if (b < 0x90) return map(b & 0x0f);
            if (b < 0xa0) return arr(b & 0x0f);
            if (b < 0xc0) return str(b & 0x1f);
            if (b >= 0xe0) return b - 0x100;
            let v;
            switch (b) {
                case 0xc0: return null;
                case 0xc2: return false;
                case 0xc3: return true;
                case 0xc4: return bin(u8[p++]);
                case 0xc5: v = view.getUint16(p); p += 2; return bin(v);
                case 0xc6: v = view.getUint32(p); p += 4; return bin(v);
                case 0xca: v = view.getFloat32(p); p += 4; return v;
                case 0xcb: v = view.getFloat64(p); p += 8; return v;
                case 0xcc: return u8[p++];
                case 0xcd: v = view.getUint16(p); p += 2; return v;
                case 0xce: v = view.getUint32(p); p += 4; return v;
                case 0xcf: v = Number(view.getBigUint64(p)); p += 8; return v;
                case 0xd0: v = view.getInt8(p); p += 1; return v;
                case 0xd1: v = view.getInt16(p); p += 2; return v;
                case 0xd2: v = view.getInt32(p); p += 4; return v;
                case 0xd3: v = Number(view.getBigInt64(p)); p += 8; return v;
                case 0xd9: return str(u8[p++]);
                case 0xda: v = view.getUint16(p); p += 2; return str(v);
                case 0xdb: v = view.getUint32(p); p += 4; return str(v);
                case 0xdc: v = view.getUint16(p); p += 2; return arr(v);
                case 0xdd: v = view.getUint32(p); p += 4; return arr(v);
                case 0xde: v = view.getUint16(p); p += 2; return map(v);
                case 0xdf: v = view.getUint32(p); p += 4; return map(v);
                default: throw new Error("Unsupported msgpack byte 0x" + b.toString(16));
            }
        }
        return read();
    }

    // Every packet is msgpack [type, args]. With a one-char type the first three bytes are
    // 0x92 (fixarray of 2), 0xa1 (fixstr of length 1) and the type char, so we can route
    // packets without decoding them.
    function packetType(u8) {
        return u8.length > 2 && u8[0] === 0x92 && u8[1] === 0xa1 ? u8[2] : -1;
    }
    function toBytes(data) {
        if (data instanceof ArrayBuffer) return new Uint8Array(data);
        if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        return null;
    }

    const T_PING = 0x30;    // "0"  client ping / server pong
    const T_SETUP = 0x43;   // "C"  [mySid]
    const T_HEALTH = 0x4f;  // "O"  [sid, health]
    const T_PLAYERS = 0x61; // "a"  [[sid, x, y, dir, ...9 attributes] * n]  (v1.8.2 layout)
    const PLAYER_STRIDE = 13;
    const PING_PACKET = new Uint8Array([0x92, 0xa1, 0x30, 0x90]); // ["0", []]

    /* ================================ STATE ================================= */

    const state = {
        ws: null,
        mySid: -1, x: 0, y: 0, hp: -1,
        pingSentAt: 0, lastPingSent: 0, ping: -1,
        inCount: 0, outCount: 0, ppsIn: 0, ppsOut: 0,
        lastPlayersDecode: 0,
        // frame stats
        frameT: -1, frameCost: 0, frames: 0,
        worstDelta: 0, worstCost: 0,
        fps: 0, shownWorstDelta: 0, shownWorstCost: 0,
        statsStart: 0, lastHud: 0
    };

    /* ================================ HOOKS ================================= */

    const trackedSockets = new WeakSet();
    let origSend = null;

    function hookWebSocket() {
        const proto = window.WebSocket && window.WebSocket.prototype;
        if (!proto || typeof proto.send !== "function") {
            err("WebSocket.prototype.send not found; network stats disabled.");
            return;
        }
        origSend = proto.send;
        proto.send = function (...args) {
            try { onSend(this, args[0]); } catch (e) { err("send hook failed", e); }
            return origSend.apply(this, args);
        };
    }

    function onSend(ws, data) {
        if (!trackedSockets.has(ws)) {
            // First send from this socket: listen alongside the game's onmessage instead of replacing it.
            trackedSockets.add(ws);
            state.ws = ws;
            ws.addEventListener("message", onMessage);
            ws.addEventListener("close", () => { if (state.ws === ws) state.ws = null; state.mySid = -1; });
        }
        state.outCount++;
        const u8 = toBytes(data);
        if (u8 && packetType(u8) === T_PING) {
            state.pingSentAt = state.lastPingSent = performance.now();
        }
    }

    function onMessage(ev) {
        try {
            state.inCount++;
            const u8 = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : null;
            if (!u8) return;

            switch (packetType(u8)) {
                case T_PING:
                    if (state.pingSentAt) {
                        state.ping = performance.now() - state.pingSentAt;
                        state.pingSentAt = 0;
                    }
                    break;
                case T_SETUP:
                    state.mySid = decode(u8)[1][0];
                    break;
                case T_HEALTH: {
                    if (!CONFIG.show.position || state.mySid < 0) break;
                    const [sid, hp] = decode(u8)[1];
                    if (sid === state.mySid) state.hp = hp;
                    break;
                }
                case T_PLAYERS: {
                    // The big packet. Decode it only when shown, and at most as often as the HUD refreshes.
                    if (!CONFIG.show.position || state.mySid < 0) break;
                    const now = performance.now();
                    if (now - state.lastPlayersDecode < 1000 / CONFIG.hudHz) break;
                    state.lastPlayersDecode = now;
                    const flat = decode(u8)[1][0];
                    for (let i = 0; i + PLAYER_STRIDE <= flat.length; i += PLAYER_STRIDE) {
                        if (flat[i] === state.mySid) { state.x = flat[i + 1]; state.y = flat[i + 2]; break; }
                    }
                    break;
                }
            }
        } catch (e) {
            err("message hook failed (packet layout changed?)", e);
        }
    }

    function hookAnimationFrame() {
        const orig = window.requestAnimationFrame;
        if (typeof orig !== "function") {
            err("requestAnimationFrame not found; frame stats disabled.");
            return;
        }
        // The game passes the same callback every frame, so cache one wrapper per callback.
        const wrappers = new WeakMap();
        window.requestAnimationFrame = function (cb) {
            if (typeof cb !== "function") return orig.call(window, cb);
            let wrapped = wrappers.get(cb);
            if (!wrapped) {
                wrapped = function (t) {
                    const start = performance.now();
                    try { return cb(t); } finally { afterCallback(t, performance.now() - start); }
                };
                wrappers.set(cb, wrapped);
            }
            return orig.call(window, wrapped);
        };
    }

    // Runs after every rAF callback. All callbacks in one frame share the same timestamp t.
    function afterCallback(t, cost) {
        try {
            if (t === state.frameT) { state.frameCost += cost; return; }

            if (state.frameT >= 0) {
                state.frames++;
                const delta = t - state.frameT;
                if (delta > state.worstDelta) state.worstDelta = delta;
                if (state.frameCost > state.worstCost) state.worstCost = state.frameCost;
            } else {
                state.statsStart = t;
            }
            state.frameT = t;
            state.frameCost = cost;

            if (t - state.lastHud >= 1000 / CONFIG.hudHz) {
                state.lastHud = t;
                tick(t);
            }
        } catch (e) {
            err("frame hook failed", e);
        }
    }

    // Throttled work: stats roll-up, ping probe, HUD text.
    function tick(t) {
        const elapsed = t - state.statsStart;
        if (elapsed >= 1000) {
            const scale = 1000 / elapsed;
            state.fps = Math.round(state.frames * scale);
            state.ppsIn = Math.round(state.inCount * scale);
            state.ppsOut = Math.round(state.outCount * scale);
            state.shownWorstDelta = state.worstDelta;
            state.shownWorstCost = state.worstCost;
            state.frames = state.inCount = state.outCount = 0;
            state.worstDelta = state.worstCost = 0;
            state.statsStart = t;
        }

        const ws = state.ws;
        if (CONFIG.pingProbeMs > 0 && ws && ws.readyState === 1 && t - state.lastPingSent > CONFIG.pingProbeMs) {
            ws.send(PING_PACKET); // goes through our send hook, which timestamps it
        }

        renderHud();
    }

    /* ================================ RENDER ================================ */

    let hudEl = null;
    let lastHudText = "";

    function renderHud() {
        if (!hudEl || !CONFIG.hudVisible) return;
        const s = CONFIG.show;
        const lines = [];
        if (s.fps) lines.push(`FPS   ${state.fps}`);
        if (s.frameTime) lines.push(`worst ${state.shownWorstDelta.toFixed(1)}ms  game ${state.shownWorstCost.toFixed(1)}ms`);
        if (s.ping) lines.push(`ping  ${state.ping < 0 ? "--" : Math.round(state.ping) + "ms"}`);
        if (s.packets) lines.push(`pkt/s in ${state.ppsIn}  out ${state.ppsOut}`);
        if (s.position && state.mySid >= 0) {
            lines.push(`pos   ${Math.round(state.x)}, ${Math.round(state.y)}${state.hp >= 0 ? `  hp ${state.hp}` : ""}`);
        }
        const text = lines.join("\n");
        if (text !== lastHudText) { hudEl.textContent = text; lastHudText = text; }
    }

    /* ================================== UI ================================== */

    let menuEl = null;

    const CSS = `
        #shud-hud { position: fixed; z-index: 100000; pointer-events: none; padding: 6px 8px;
            font: 12px/1.35 ui-monospace, Consolas, monospace; color: #fff; white-space: pre;
            background: rgba(0,0,0,.45); border-radius: 6px; text-shadow: 0 1px 1px #000; }
        #shud-hud.top-left { top: 8px; left: 8px; } #shud-hud.top-right { top: 8px; right: 8px; }
        #shud-hud.bottom-left { bottom: 8px; left: 8px; } #shud-hud.bottom-right { bottom: 8px; right: 8px; }
        #shud-menu { position: fixed; z-index: 100001; top: 50%; left: 50%; transform: translate(-50%,-50%);
            min-width: 240px; padding: 12px 14px; display: none; color: #fff; background: rgba(20,20,24,.92);
            border: 1px solid rgba(255,255,255,.15); border-radius: 8px; font: 13px/1.6 system-ui, sans-serif; }
        #shud-menu.open { display: block; }
        #shud-menu h3 { margin: 0 0 6px; font-size: 14px; }
        #shud-menu label { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
        #shud-menu select { background: #222; color: #fff; border: 1px solid #444; border-radius: 4px; }
        #shud-menu small { display: block; margin-top: 8px; opacity: .6; }
    `;

    function buildUi() {
        const style = document.createElement("style");
        style.textContent = CSS;
        document.head.appendChild(style);

        hudEl = document.createElement("div");
        hudEl.id = "shud-hud";
        applyHudLayout();
        document.body.appendChild(hudEl);

        menuEl = document.createElement("div");
        menuEl.id = "shud-menu";
        const toggles = [["fps", "FPS"], ["frameTime", "Frame time"], ["ping", "Ping"], ["packets", "Packets/s"], ["position", "Position / HP"]];
        menuEl.innerHTML = `
            <h3>Sandbox HUD</h3>
            ${toggles.map(([k, label]) => `<label>${label}<input type="checkbox" data-show="${k}"></label>`).join("")}
            <label>Refresh<select data-cfg="hudHz">${[1, 2, 4, 10].map((n) => `<option value="${n}">${n}/s</option>`).join("")}</select></label>
            <label>Corner<select data-cfg="corner">${["top-left", "top-right", "bottom-left", "bottom-right"].map((c) => `<option>${c}</option>`).join("")}</select></label>
            <label>Ping probe<select data-cfg="pingProbeMs"><option value="0">off</option><option value="3000">3s</option><option value="1000">1s</option></select></label>
            <small>\` menu · F2 hide HUD · Esc close</small>`;

        for (const box of menuEl.querySelectorAll("[data-show]")) box.checked = !!CONFIG.show[box.dataset.show];
        for (const sel of menuEl.querySelectorAll("[data-cfg]")) sel.value = String(CONFIG[sel.dataset.cfg]);

        menuEl.addEventListener("change", (e) => {
            const el = e.target;
            if (el.dataset.show) CONFIG.show[el.dataset.show] = el.checked;
            else if (el.dataset.cfg) CONFIG[el.dataset.cfg] = el.dataset.cfg === "corner" ? el.value : Number(el.value);
            applyHudLayout();
            saveConfig();
            el.blur(); // hand keyboard focus back so movement keys keep working
        });
        // Keep clicks and scrolls on the menu from reaching the game.
        for (const type of ["mousedown", "mouseup", "click", "wheel", "contextmenu"]) {
            menuEl.addEventListener(type, (e) => e.stopPropagation());
        }
        document.body.appendChild(menuEl);
    }

    function applyHudLayout() {
        if (!hudEl) return;
        hudEl.className = CONFIG.corner;
        hudEl.style.display = CONFIG.hudVisible ? "" : "none";
        lastHudText = "";
        renderHud();
    }

    function setMenu(open) {
        if (menuEl) menuEl.classList.toggle("open", open);
    }

    function onKeyDown(e) {
        if (isTyping(e.target)) return; // chat box, name input, etc.
        const menuOpen = menuEl && menuEl.classList.contains("open");
        let handled = true;
        if (e.code === CONFIG.menuKey) setMenu(!menuOpen);
        else if (e.code === "Escape" && menuOpen) setMenu(false);
        else if (e.code === CONFIG.hudKey) { CONFIG.hudVisible = !CONFIG.hudVisible; applyHudLayout(); saveConfig(); }
        else handled = false;
        if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
    }

    /* ================================= BOOT ================================= */

    try { hookWebSocket(); } catch (e) { err("WebSocket hook install failed", e); }
    try { hookAnimationFrame(); } catch (e) { err("rAF hook install failed", e); }
    window.addEventListener("keydown", onKeyDown, true);
    onReady(() => {
        try { buildUi(); log("Loaded. Press ` for settings."); } catch (e) { err("UI build failed", e); }
    });
})();
