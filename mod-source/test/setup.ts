// Runs before every test file. Most mod modules look up their DOM elements when they load, so the
// game page Falcon injects (public/index.html) has to be in place before anything is imported.
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { beforeEach } from "vitest";

// Plain paths: jsdom replaces the global URL with one Node's fs doesn't accept.
const gamePage = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/index.html");
document.documentElement.innerHTML = readFileSync(gamePage, "utf8");

// jsdom has no canvas implementation. Rendering isn't under test, so any 2D context call is a no-op.
const noop = () => undefined;
function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx: Record<PropertyKey, unknown> = { canvas, measureText: () => ({ width: 0 }) };
    return new Proxy(ctx, {
        get: (target, prop) => (prop in target ? target[prop] : noop),
        set: (target, prop, value) => { target[prop] = value; return true; }
    }) as unknown as CanvasRenderingContext2D;
}

if (typeof globalThis.CanvasRenderingContext2D === "undefined") {
    (globalThis as Record<string, unknown>).CanvasRenderingContext2D = class CanvasRenderingContext2D { };
}
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    return fakeContext(this);
} as typeof HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
    localStorage.clear();
});
