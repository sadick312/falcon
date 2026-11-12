// What Falcon believes an enemy carries. The sandbox server allows Katana + Musket, so a Musket we
// have seen must not be "corrected" back to a guessed Hunting Bow when the enemy swings a Katana.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// PlayerCombatManager only needs the tick and our own sid from these; the rest of the client stays out.
const stubs = {
    "@core/Client": "export default { mySID: -1 };",
    "@core/ModManager": "export default { tick: 100 };",
};

const out = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "falcon-test-")), "mod.mjs");
await esbuild.build({
    entryPoints: [path.join(root, "src/core/logic/players/core/PlayerCombatManager.ts")],
    bundle: true, format: "esm", platform: "node", outfile: out,
    tsconfig: path.join(root, "tsconfig.json"), logLevel: "warning",
    plugins: [{
        name: "stubs",
        setup(build) {
            build.onResolve({ filter: /^@core\/(Client|ModManager)$/ }, (args) => ({ path: args.path, namespace: "stub" }));
            build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: stubs[args.path], loader: "js" }));
        }
    }]
});
const { default: PlayerCombatManager } = await import(pathToFileURL(out).href);

function enemy() {
    return {
        sid: 7, reloads: new Array(64).fill(1),
        weaponData: {
            primary: 0, primaryConfirmed: false, primaryVariant: 0,
            secondary: 15, secondaryConfirmed: false, secondaryVariant: 0,
            lastPrimaryTickHit: 0, lastSecondaryTickHit: 0, lastTurretTickHit: 0,
            lastTickSincePrimaryReloaded: 0, lastTickSinceSecondaryReloaded: 0
        }
    };
}

test("Katana + Musket enemy: the Musket we saw stays known", () => {
    const p = enemy();
    PlayerCombatManager.update(p, 15); // seen holding a Musket
    PlayerCombatManager.update(p, 4);  // then swings a Katana
    assert.equal(p.weaponData.primary, 4);
    assert.equal(p.weaponData.secondary, 15, "still a Musket");
    assert.equal(p.weaponData.secondaryConfirmed, true);
});

test("Katana enemy with an unseen secondary: still guessed as Hunting Bow (unchanged)", () => {
    const p = enemy();
    PlayerCombatManager.update(p, 4);
    assert.equal(p.weaponData.secondary, 9);
    assert.equal(p.weaponData.secondaryConfirmed, false);
});

test("Polearm enemy with an unseen secondary: still guessed as Musket (unchanged)", () => {
    const p = enemy();
    PlayerCombatManager.update(p, 5);
    assert.equal(p.weaponData.secondary, 15);
    assert.equal(p.weaponData.secondaryConfirmed, false);
});
