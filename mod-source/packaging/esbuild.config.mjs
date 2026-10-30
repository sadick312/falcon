// esbuild options shared by build.mjs and watch.mjs.
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Read by scripts/dev-stats.mjs for the bundle breakdown and import graph. */
export const metafilePath = path.join(root, "dist", "meta.json");
const historyPath = path.join(root, "..", "stats", "history.json");

/** The build fails above this size. Override with FALCON_BUNDLE_LIMIT_KB (default 1.2 MB). */
export const bundleLimitBytes = Number(process.env.FALCON_BUNDLE_LIMIT_KB || 1.2 * 1024) * 1024;
/** Warn when the bundle is this much bigger than in the last `npm run stats` entry. */
const GROWTH_WARNING = 0.05;

/** Writes dist/meta.json after every build, including watch rebuilds. */
const writeMetafilePlugin = {
    name: "write-metafile",
    setup(build) {
        build.onEnd(async (result) => {
            if (result.metafile) await fsp.writeFile(metafilePath, JSON.stringify(result.metafile));
        });
    }
};

function lastRecordedBundleSize() {
    try {
        const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
        return history.findLast((entry) => entry.bundle?.raw)?.bundle.raw ?? null;
    } catch {
        return null;
    }
}

/**
 * Checks bundle.js against the size budget. esbuild still resolves when an onEnd callback adds an
 * error, so build.mjs checks result.errors itself; watch mode just prints it.
 */
const sizeBudgetPlugin = {
    name: "size-budget",
    setup(build) {
        build.onEnd((result) => {
            const output = Object.entries(result.metafile?.outputs ?? {}).find(([file]) => file.endsWith("bundle.js"))?.[1];
            if (!output) return;

            const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
            const size = output.bytes;

            if (size > bundleLimitBytes) {
                const text = `Bundle is ${kb(size)}, over the ${kb(bundleLimitBytes)} limit (set FALCON_BUNDLE_LIMIT_KB to change it).`;
                result.errors.push({ text });
                console.error(`[size-budget] ${text}`);
                return;
            }

            const previous = lastRecordedBundleSize();
            if (previous && size > previous * (1 + GROWTH_WARNING)) {
                const text = `Bundle grew ${((size / previous - 1) * 100).toFixed(1)}% since the last stats run (${kb(previous)} -> ${kb(size)}).`;
                result.warnings.push({ text });
                console.warn(`[size-budget] ${text}`);
            }
        });
    }
};

/**
 * @param {{ dev?: boolean }} options  dev: defines __DEV__ = true, which keeps the opt-in runtime
 *   profiler (src/services/profiler). Production builds define it false and esbuild drops that code.
 * @returns {import("esbuild").BuildOptions}
 */
export function createBuildOptions({ dev = false } = {}) {
    return {
        absWorkingDir: root,
        entryPoints: ["src/index.ts"],
        bundle: true,
        minify: true,
        minifySyntax: true,
        platform: "browser",
        target: "es2022",
        sourcemap: "linked",
        metafile: true,
        define: { __DEV__: String(dev) },
        // CSS is imported as a string and injected by the importing module (see core/menu/menuStyle.ts).
        loader: { ".css": "text" },
        plugins: [inlineWorkerPlugin({ format: "iife" }), writeMetafilePlugin, sizeBudgetPlugin],
        outfile: "dist/bundle.js"
    };
}
