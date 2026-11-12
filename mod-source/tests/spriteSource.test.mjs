// "Original MooMoo Artwork": on moomodding.io, hats/weapons load from moomoo.io (the old look).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

globalThis.Image = class { constructor() { this.src = ""; this.crossOrigin = null; } };
globalThis.__settings = {};

const out = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "falcon-test-")), "mod.mjs");
await esbuild.build({
    entryPoints: [path.join(root, "src/rendering/core/SpriteSource.ts")],
    bundle: true, format: "esm", platform: "node", outfile: out,
    tsconfig: path.join(root, "tsconfig.json"), logLevel: "warning",
    plugins: [{
        name: "stubs",
        setup(build) {
            build.onResolve({ filter: /^@menu\/Menu$/ }, () => ({ path: "menu", namespace: "stub" }));
            build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export default { getValue: (id) => globalThis.__settings[id] };", loader: "js" }));
        }
    }]
});
const { loadGameSprite } = await import(pathToFileURL(out).href);

test("moomodding, setting on (default): official picture, no crossOrigin", () => {
    globalThis.__settings = {};
    const img = loadGameSprite("hats", "hat_7.png", "sandbox.moomodding.io");
    assert.equal(img.src, "https://moomoo.io/img/hats/hat_7.png");
    assert.equal(img.crossOrigin, null, "moomoo.io sends no CORS header");
});

test("moomodding, setting off: the site's own picture", () => {
    globalThis.__settings = { originalArtwork: false };
    const img = loadGameSprite("weapons", "samurai_1.png", "sandbox.moomodding.io");
    assert.equal(img.src, "../../img/weapons/samurai_1.png");
    assert.equal(img.crossOrigin, "anonymous");
});

test("on moomoo.io itself: the site's picture (already official)", () => {
    globalThis.__settings = {};
    assert.equal(loadGameSprite("accessories", "access_21.png", "sandbox.moomoo.io").src, "../../img/accessories/access_21.png");
});
