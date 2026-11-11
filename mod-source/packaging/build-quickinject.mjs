/**
 * Builds ONE self-contained file for Quick Inject (sandbox.moomodding.io "Paste & Play"):
 *   dist/falcon-quickinject.js
 *
 * It contains Falcon's HTML, CSS and bundle. When it runs it replaces the page with Falcon's UI
 * and starts the client - the same thing the Chrome launcher does, without needing the launcher
 * or the local backend.
 *
 * Run `npm run build` (in mod-source) first so dist/bundle.js exists, or use `npm run quickinject`.
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

const html = await fs.readFile(path.join(root, "public", "index.html"), "utf8");
const css = await fs.readFile(path.join(root, "public", "style.css"), "utf8");
const bundle = await fs.readFile(path.join(__dirname, "..", "dist", "bundle.js"), "utf8");

// Only the <head> and <body> inner content is needed; innerHTML on <html> ignores the doctype.
const inner = html.replace(/^[\s\S]*?<html[^>]*>/i, "").replace(/<\/html>\s*$/i, "");

const output = `/* Falcon client - Quick Inject build (${new Date().toISOString()}) */
(function () {
    if (window.__falconQuickInjectLoaded) return;
    window.__falconQuickInjectLoaded = true;

    var FALCON_HTML = ${JSON.stringify(inner)};
    var FALCON_CSS = ${JSON.stringify(css)};

    function startBundle() {
        // The bundle looks up its DOM elements as soon as it runs, so it must run after the HTML swap.
${bundle}
        if (typeof window.initFalconClient === "function") {
            var init = window.initFalconClient;
            delete window.initFalconClient;
            init();
        } else {
            console.error("[Falcon] initFalconClient missing - bundle failed to load");
        }
    }

    // In "hook" mode the normal game has already connected. Servers allow few connections per IP
    // ("IP limit reached"), so close the normal game's socket the next time it sends (it pings
    // every 2.5s). Falcon's own sockets are marked with __falcon and are never touched.
    function closeVanillaSocket() {
        var proto = WebSocket.prototype;
        var originalSend = proto.send;
        var restore = function () { if (proto.send === patchedSend) proto.send = originalSend; };
        var patchedSend = function (data) {
            if (!this.__falcon) {
                console.log("[Falcon] Closed the normal game's connection (hook mode).");
                try { this.close(); } catch (e) { }
                restore();
                return;
            }
            return originalSend.call(this, data);
        };
        proto.send = patchedSend;
        setTimeout(restore, 15000);
    }

    function boot() {
        // window.requestAnimFrame is created only by the site's game script, so it tells us the
        // normal game really ran (the #gameCanvas element exists in the HTML either way).
        if (typeof window.requestAnimFrame === "function") {
            console.warn("[Falcon] The normal game is also running (hook mode). It will be disconnected, but for " +
                "best performance choose 'bundle replacement' or 'HTML replacement' in Quick Inject.");
            closeVanillaSocket();
            // The normal game reschedules its render loop through window.requestAnimFrame every
            // frame; a no-op stops that loop (it kept drawing to a hidden canvas, wasting CPU).
            window.requestAnimFrame = function () { };
        }

        window.oldHTML = document.documentElement.innerHTML;
        document.documentElement.innerHTML = FALCON_HTML;

        var style = document.createElement("style");
        style.textContent = FALCON_CSS;
        document.head.appendChild(style);

        // The official 1.9 site needs Cloudflare Turnstile before connecting; 1.8.2 hosts don't.
        if (/(^|\\.)moomoo\\.io$/.test(location.hostname)) {
            var turnstile = document.createElement("script");
            turnstile.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            turnstile.onload = startBundle;
            document.head.appendChild(turnstile);
        } else {
            startBundle();
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
`;

const outFile = path.join(__dirname, "..", "dist", "falcon-quickinject.js");
await fs.writeFile(outFile, output);
console.log(`Quick Inject build written to ${outFile} (${(output.length / 1024).toFixed(0)} KB)`);
