import * as esbuild from "esbuild";
import { createBuildOptions } from "./esbuild.config.mjs";

// --dev keeps development-only code such as the runtime profiler (see esbuild.config.mjs).
const dev = process.argv.includes("--dev");

async function run() {
    const result = await esbuild.build(createBuildOptions({ dev }));
    // Errors added by plugins after the build (the size budget, which prints its own) don't reject.
    if (result.errors.length) {
        process.exitCode = 1;
        return;
    }
    console.log(`Built source files and bundled code${dev ? " (development)" : ""}.`);
}

run().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
});
