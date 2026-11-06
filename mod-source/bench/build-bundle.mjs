// Vitest globalSetup for the replay benchmark (vitest.bench.config.mts): builds bench-entry.ts into
// .build/bench-bundle.mjs for replay.ts's bundle mode. Runs in plain Node, since esbuild refuses to run inside jsdom.
// Same settings as the production build (packaging/esbuild.config.mjs) except __DEV__ on, ESM output and no minifying.
import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const benchDir = path.dirname(fileURLToPath(import.meta.url));

export default async function buildBenchBundle() {
    await esbuild.build({
        absWorkingDir: path.join(benchDir, ".."),
        entryPoints: [path.join(benchDir, "bench-entry.ts")],
        bundle: true,
        format: "esm",
        platform: "browser",
        target: "es2022",
        charset: "utf8",
        keepNames: true,
        define: { __DEV__: "true" },
        loader: { ".css": "text" },
        // jsdom has no Worker; same stub as the Vitest config.
        plugins: [{
            name: "stub-workers",
            setup(build) {
                build.onLoad({ filter: /\.worker\.js$/ }, () => ({
                    contents: "export default class StubWorker { postMessage() {} terminate() {} addEventListener() {} onmessage = null; }",
                    loader: "js"
                }));
            }
        }],
        outfile: path.join(benchDir, ".build", "bench-bundle.mjs"),
        logLevel: "error"
    });
}
