// Auto Push asks a background worker for a path. It must not start a new search every tick while
// the previous one is still running, and the path that arrives must not be thrown away.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// AutoPusher pulls in the whole client (DOM, menu, socket). Swap those modules for small fakes.
// The fake Pathfinder never answers on its own: the test resolves each search by hand.
const stubs = {
    "@core/Keybinds": "export default { isHeld: () => false };",
    "@core/Client": "export default { player: null };",
    "@core/logic/ObjectManager": "export default {};",
    "@core/ModManager": "export default { activityList: [], enemyData: {} };",
    "@menu/Menu": "export default { getValue: () => false };",
    "@ui/Hook": "export const Input = { keys: {} };",
    "pathfinder": "export default { find: () => new Promise((res) => globalThis.__pathSearches.push(res)) };"
};

async function loadAutoPusher() {
    const out = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "falcon-test-")), "mod.mjs");
    await esbuild.build({
        entryPoints: [path.join(root, "src/core/mod/combat/core/AutoPusher.ts")],
        bundle: true, format: "esm", platform: "node", outfile: out,
        tsconfig: path.join(root, "tsconfig.json"), logLevel: "warning",
        plugins: [{
            name: "stubs",
            setup(build) {
                build.onResolve({ filter: /.*/ }, (args) => {
                    if (args.path.endsWith("services/pathfinding/Pathfinder")) return { path: "pathfinder", namespace: "stub" };
                    if (args.path in stubs) return { path: args.path, namespace: "stub" };
                    return undefined;
                });
                build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: stubs[args.path], loader: "js" }));
            }
        }]
    });
    return import(pathToFileURL(out).href);
}

globalThis.__pathSearches = [];
const { default: AutoPusher } = await loadAutoPusher();

const start = { x: 0, y: 0 };
const goal = { x: 500, y: 0 };
// What AutoPusher.main does each tick when the enemy is far away: reset, then follow/find a path.
const tick = () => {
    AutoPusher["resetState"]();
    return AutoPusher["pathfind"](start, goal);
};

test("only one path search runs at a time, and its result is kept", async () => {
    const searches = globalThis.__pathSearches;

    const first = tick();
    tick();
    tick();
    assert.equal(searches.length, 1, "3 ticks while waiting must start 1 search, not 3");

    const path = [{ x: 0, y: 0 }, { x: 250, y: 0 }, { x: 500, y: 0 }];
    searches[0](path);
    await first;
    assert.deepEqual(AutoPusher.currentPath, path, "the finished path is stored");

    // Next tick: the reset must not throw the new path away, and Auto Push follows it.
    tick();
    assert.deepEqual(AutoPusher.currentPath, path, "path survives the next tick");
    assert.equal(searches.length, 1, "no new search once a path is known");

    // Once the search has finished, a new one can start again (e.g. goal moved).
    AutoPusher.currentPath = [];
    tick();
    assert.equal(searches.length, 2, "a new search starts after the previous one finished");
    searches[1]([]);
});
