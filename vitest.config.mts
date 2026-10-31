// Vitest setup for mod-source. Mirrors what mod-source/packaging/esbuild.config.mjs does for the bundle:
// tsconfig path aliases, the __DEV__ define, CSS imported as text and inline *.worker.js imports.
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const modDir = resolve(import.meta.dirname, "mod-source");

/** "@core/*": ["./src/core/*"] -> { find: /^@core\//, replacement: <abs>/src/core/ } */
function tsconfigAliases() {
    const raw = readFileSync(resolve(modDir, "tsconfig.json"), "utf8").replace(/^\s*\/\/.*$/gm, "");
    const paths: Record<string, string[]> = JSON.parse(raw).compilerOptions.paths;
    return Object.entries(paths).map(([key, [target]]) => ({
        find: new RegExp(`^${key.replace("/*", "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
        replacement: resolve(modDir, target.replace("*", "")) + "/"
    }));
}

/** esbuild's { ".css": "text" } loader: `import css from "./x.css"` gives the file's contents. */
function cssAsText(): Plugin {
    return {
        name: "css-as-text",
        enforce: "pre",
        load(id) {
            if (!id.endsWith(".css")) return null;
            return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
        }
    };
}

/** esbuild-plugin-inline-worker turns `import W from "./x.worker.js"` into a Worker class; tests get a stub. */
function stubWorkers(): Plugin {
    return {
        name: "stub-workers",
        enforce: "pre",
        load(id) {
            if (!id.endsWith(".worker.js")) return null;
            return "export default class StubWorker { postMessage() {} terminate() {} addEventListener() {} onmessage = null; }";
        }
    };
}

export default defineConfig({
    plugins: [cssAsText(), stubWorkers()],
    resolve: { alias: tsconfigAliases() },
    define: { __DEV__: "false" },
    test: {
        environment: "jsdom",
        include: ["mod-source/test/**/*.test.ts"],
        setupFiles: ["mod-source/test/setup.ts"],
        restoreMocks: true,
        // The first test in a file imports the whole mod into jsdom, which can take over the 5 s default on a busy
        // machine (the replay test runs alongside the others).
        testTimeout: 30_000,
        coverage: {
            provider: "v8",
            include: ["mod-source/src/**/*.ts"],
            exclude: ["**/*.d.ts"],
            reporter: ["text-summary", "json-summary", "json"],
            reportsDirectory: "coverage"
        }
    }
});
