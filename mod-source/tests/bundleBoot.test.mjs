// Boot smoke test: bundle the whole mod and run its top-level code against a fake browser.
// Catches import cycles that only break at load time ("X is not a constructor",
// "Cannot access 'X' before initialization", "Class extends value undefined"), which
// the per-module tests can't see. (Real bug: an import added to DebugOverlay broke boot.)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";
import cssModulesPlugin from "esbuild-plugin-inline-css";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** An object that accepts any property access, call or `new` and returns another such object. */
function makeStub(name = "stub") {
    const cache = new Map();
    const fn = function () { };
    return new Proxy(fn, {
        get(_t, key) {
            if (key === Symbol.toPrimitive) return (hint) => (hint === "number" ? 0 : "");
            if (key === Symbol.iterator) return function* () { };
            if (key === "then" || key === "catch" || key === "finally") return () => makeStub(`${name}.${String(key)}()`);
            if (key === "length") return 0;
            if (typeof key === "symbol") return undefined;
            if (!cache.has(key)) cache.set(key, makeStub(`${name}.${key}`));
            return cache.get(key);
        },
        set(_t, key, value) { cache.set(key, value); return true; },
        has: () => true,
        apply: () => makeStub(`${name}()`),
        construct: () => makeStub(`new ${name}`),
    });
}

test("whole bundle loads without errors (catches import cycles)", async () => {
    const result = await esbuild.build({
        entryPoints: [path.join(root, "src/index.ts")], bundle: true, write: false, minify: false,
        platform: "browser", absWorkingDir: root, logLevel: "silent",
        plugins: [cssModulesPlugin(), inlineWorkerPlugin({ format: "iife" })],
    });
    const code = result.outputFiles[0].text;

    const errors = [];
    const sandbox = {
        console: { log() { }, warn() { }, info() { }, debug() { }, error() { } },
        setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
        queueMicrotask() { }, requestAnimationFrame: () => 0, cancelAnimationFrame() { },
        performance: { now: () => 0 }, TextEncoder, TextDecoder, atob, btoa,
    };
    for (const name of ["document", "localStorage", "sessionStorage", "navigator", "location", "WebSocket",
        "Image", "HTMLCanvasElement", "CanvasRenderingContext2D", "Worker", "Blob", "URL", "MutationObserver",
        "Audio", "fetch", "XMLHttpRequest", "screen", "history", "crypto", "Event", "CustomEvent", "Path2D",
        "HTMLElement", "Element", "Node", "DOMParser", "OffscreenCanvas", "FontFace", "matchMedia",
        "getComputedStyle", "alert", "postMessage", "MessageChannel", "addEventListener", "removeEventListener"]) {
        sandbox[name] = makeStub(name);
    }
    sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.top = sandbox;
    // Built-ins (Math, DataView, ...) come from the vm context itself; only browser objects are stubbed.
    const context = vm.createContext(sandbox);

    try {
        vm.runInContext(code, context, { filename: "bundle.js", timeout: 5000 });
    } catch (e) {
        errors.push(e);
    }

    // Any error fails: an unrelated stub problem would stop evaluation early and hide later load errors.
    assert.deepEqual(errors.map((e) => `${e.message} @ ${String(e.stack).split("\n")[1]?.trim()}`), []);
});
