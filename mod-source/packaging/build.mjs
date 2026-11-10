import * as esbuild from "esbuild";
import cssModulesPlugin from "esbuild-plugin-inline-css";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";

const debug = process.env.FALCON_DEBUG_BUILD === "1";

async function run() {
    await esbuild.build({
        entryPoints: ["src/index.ts"],
        bundle: true,
        // FALCON_DEBUG_BUILD=1 keeps names readable so error messages point at real code.
        minify: !debug,
        minifySyntax: !debug,
        platform: "browser",
        plugins: [cssModulesPlugin(), inlineWorkerPlugin({
            format: "iife"
        })],
        outfile: "dist/bundle.js",
    });

    console.log("Built source files and bundled code.");
}

run();