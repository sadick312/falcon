// npm run dev: builds the mod once, then watches the mod and the extension together.
// Every save in mod-source/src rebuilds mod-source/dist/bundle.js, which rebuilds falcon-launcher/dist.
// Reload the extension in chrome://extensions (or just reload the game tab) to pick up a change. Ctrl+C stops both.
import { spawn, spawnSync } from "child_process";
import { createRequire } from "module";
import { dirname, resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const node = process.execPath;
// vite's package.json "exports" hides bin/, so find the package folder and build the path from there.
const viteDir = dirname(createRequire(resolve(root, "falcon-launcher", "package.json")).resolve("vite/package.json"));
const vite = resolve(viteDir, "bin", "vite.js");

// The extension build needs mod-source/dist/bundle.js to exist before it starts.
const first = spawnSync(node, ["packaging/build.mjs", "--dev"], { cwd: resolve(root, "mod-source"), stdio: "inherit" });
if (first.status !== 0) {
    console.error("[dev] The first mod build failed. Fix the error above and run npm run dev again.");
    process.exit(first.status ?? 1);
}

const children = [];

function start(name, args, cwd) {
    const child = spawn(node, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const prefix = (stream, out) =>
        stream.on("data", (chunk) => {
            for (const line of chunk.toString().split(/\r?\n/)) if (line) out.write(`[${name}] ${line}\n`);
        });
    prefix(child.stdout, process.stdout);
    prefix(child.stderr, process.stderr);
    child.on("exit", (code) => {
        console.log(`[${name}] stopped (exit code ${code}).`);
        stopAll(code ?? 0);
    });
    children.push(child);
}

let stopping = false;
function stopAll(code) {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill();
    process.exit(code);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

start("mod", ["packaging/watch.mjs"], resolve(root, "mod-source"));
start("ext", [vite, "build", "--watch"], resolve(root, "falcon-launcher"));
console.log("[dev] Watching. Load falcon-launcher/dist as an unpacked extension. Press Ctrl+C to stop.");
