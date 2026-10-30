import * as esbuild from "esbuild";
import { createBuildOptions } from "./esbuild.config.mjs";

// Watch builds are development builds: __DEV__ is true, so the opt-in profiler is available.
async function run() {
    const ctx = await esbuild.context(createBuildOptions({ dev: true }));
    await ctx.watch();
    console.log("Watching source files and bundling code (development)...");
}

run().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
});
