// ==UserScript==
// @name         Robotics socket capture (temporary)
// @match        *://sandbox.moomodding.io/*
// @match        *://moomodding.io/*
// @grant        none
// @run-at       document-start
// @version      1.0
// @description  Logs the game socket URL and the first packet names in/out. Turn Robotics off while this runs.
// ==/UserScript==

/* Read-only: records, never changes or sends anything. When done, run in the console:
     copy(__wsCapture.report())
   and paste the result back. Query values in socket URLs are cut to 3 characters. */
(function () {
    const KEEP = 30;
    const page = { host: location.hostname, path: location.pathname, inFrame: window !== window.top };
    const sockets = [];

    function redact(url) {
        try {
            const u = new URL(url);
            u.searchParams.forEach((v, k) => u.searchParams.set(k, v.slice(0, 3) + "..."));
            return u.toString();
        } catch (e) {
            return String(url).slice(0, 80);
        }
    }

    function bytes(d) {
        if (d instanceof ArrayBuffer) return new Uint8Array(d);
        if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        return null;
    }

    // Packets are msgpack [type, payload]: 0x9N (fixarray) then 0xa0|len (fixstr) holding the type.
    function describe(d) {
        if (typeof d === "string") return { type: "text", len: d.length, head: d.slice(0, 40) };
        const b = bytes(d);
        if (!b) return { type: d && d.constructor ? d.constructor.name : typeof d, len: -1 };
        const head = Array.from(b.subarray(0, 24), x => x.toString(16).padStart(2, "0")).join(" ");
        const i = (b[0] & 0xf0) === 0x90 ? 1 : b[0] === 0xdc ? 3 : -1;
        if (i < 0 || (b[i] & 0xe0) !== 0xa0) return { type: "?", len: b.length, head };
        const n = b[i] & 0x1f;
        return { type: new TextDecoder().decode(b.subarray(i + 1, i + 1 + n)), len: b.length, head };
    }

    function entry(ws, url) {
        let s = sockets.find(x => x.ws === ws);
        if (!s) {
            s = { ws, url: redact(url || ws.url), opened: performance.now(), in: [], out: [], counts: { in: {}, out: {} }, outStamps: [], peakOutPerSec: 0, close: null };
            sockets.push(s);
        }
        return s;
    }

    function note(ws, dir, data) {
        const s = entry(ws);
        const p = describe(data);
        s.counts[dir][p.type] = (s.counts[dir][p.type] || 0) + 1;
        if (s[dir].length < KEEP) s[dir].push(Object.assign({ t: Math.round(performance.now() - s.opened) }, p));
        if (dir === "out") {
            const now = performance.now();
            s.outStamps.push(now);
            while (now - s.outStamps[0] > 1000) s.outStamps.shift();
            s.peakOutPerSec = Math.max(s.peakOutPerSec, s.outStamps.length);
        }
    }

    const Native = window.WebSocket;
    window.WebSocket = new Proxy(Native, {
        construct(target, args) {
            const ws = Reflect.construct(target, args);
            const s = entry(ws, String(args[0]));
            ws.addEventListener("message", e => note(ws, "in", e.data));
            ws.addEventListener("close", e => { s.close = { code: e.code, reason: e.reason, after: Math.round(performance.now() - s.opened) }; });
            console.log("[capture] socket", s.url);
            return ws;
        }
    });
    // Installed at document-start, so pages that cache WebSocket.prototype.send still call this.
    const nativeSend = Native.prototype.send;
    Native.prototype.send = function (data) {
        try { note(this, "out", data); } catch (e) { /* never block the game */ }
        return nativeSend.call(this, data);
    };

    function probe() {
        const has = id => !!document.getElementById(id);
        page.title = document.title;
        page.ids = { gameCanvas: has("gameCanvas"), enterGame: has("enterGame"), mainMenu: has("mainMenu"), nameInput: has("nameInput"), chatBox: has("chatBox"), storeHolder: has("storeHolder"), altcha: has("altcha") };
        page.iframes = Array.from(document.querySelectorAll("iframe"), f => { try { const u = new URL(f.src, location.href); return u.origin + u.pathname; } catch (e) { return f.src; } });
        page.scripts = Array.from(document.scripts, s => s.src).filter(Boolean).map(src => { try { const u = new URL(src); return u.origin + u.pathname; } catch (e) { return src; } });
    }
    document.addEventListener("DOMContentLoaded", probe, { once: true });

    window.__wsCapture = {
        page,
        sockets,
        report() {
            probe();
            return JSON.stringify({ page, sockets: sockets.map(s => ({ url: s.url, peakOutPerSec: s.peakOutPerSec, close: s.close, counts: s.counts, firstIn: s.in, firstOut: s.out })) }, null, 1);
        }
    };
})();
