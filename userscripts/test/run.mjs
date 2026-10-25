// Runs every *.test.mjs in its own Node process (each loads its own copy of the script).
import { spawnSync } from "child_process";
import fs from "fs";
const files = fs.readdirSync(new URL(".", import.meta.url)).filter(f => f.endsWith(".test.mjs")).sort();
let failed = 0;
const t0 = Date.now();
for (const f of files) {
    const r = spawnSync(process.execPath, ["--expose-gc", f], { cwd: new URL(".", import.meta.url), stdio: "inherit", timeout: 300000 });
    if (r.status !== 0) failed++;
}
console.log((failed ? "FAILED: " + failed + " of " : "all passed: ") + files.length + " test files in " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exitCode = failed ? 1 : 0;
