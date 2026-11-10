// Tiny helper: bundles one TypeScript file (with the project's path aliases) and imports it.
import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs/promises";
import os from "os";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function loadTs(rel) {
    const out = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "falcon-test-")), "mod.mjs");
    await esbuild.build({
        entryPoints: [path.join(root, rel)], bundle: true, format: "esm", platform: "node",
        outfile: out, tsconfig: path.join(root, "tsconfig.json"), logLevel: "warning"
    });
    return import(pathToFileURL(out).href);
}
