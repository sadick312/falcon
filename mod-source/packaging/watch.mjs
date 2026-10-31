import * as esbuild from "esbuild";
import { createBuildOptions } from "./esbuild.config.mjs";

/** Prints one line per rebuild, so it's clear when a save has been picked up. */
const rebuildLogPlugin = {
    name: "rebuild-log",
    setup(build) {
        let startedAt = 0;
        build.onStart(() => {
            startedAt = performance.now();
        });
        build.onEnd((result) => {
            const ms = Math.round(performance.now() - startedAt);
            const time = new Date().toLocaleTimeString();
            if (result.errors.length) console.log(`${time} Rebuild failed (${result.errors.length} error(s)).`);
            else console.log(`${time} Rebuilt bundle in ${ms} ms.`);
        });
    }
};

// Watch builds are development builds: __DEV__ is true, so the opt-in profiler is available.
async function run() {
    const options = createBuildOptions({ dev: true });
    options.plugins = [...options.plugins, rebuildLogPlugin];
    // Print esbuild's own error messages; the default for the JS API is silent.
    options.logLevel = "warning";

    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log("Watching source files and bundling code (development)...");
}

run().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
});
