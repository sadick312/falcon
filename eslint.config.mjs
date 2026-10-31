// ESLint for the whole repo: `npm run lint`.
// typescript-eslint only supports TypeScript < 6.1, and the project builds with TypeScript 7. So the lint
// packages, with a TypeScript 6 used only for parsing, are a separate install in tools/lint (the root
// postinstall runs it) and load from there, so nothing in them can pick up the root's TypeScript 7.
import { createRequire } from "module";

const require = createRequire(new URL("./tools/lint/package.json", import.meta.url));
const { defineConfig } = require("eslint/config");
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const globals = require("globals");

export default defineConfig(
    {
        ignores: [
            "**/dist/",
            "**/node_modules/",
            "coverage/",
            "stats/",
            // Other sessions' git worktrees: copies of this repo.
            ".claude/",
            "mod-source/bench/recordings/",
            "mod-source/bench/results/",
            "public/"
        ]
    },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        rules: {
            // Same convention as tsc's noUnusedParameters: a leading _ marks a parameter or variable as unused on purpose.
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
            // 32 uses in packet code at the start; shown as warnings so they can be typed one at a time.
            "@typescript-eslint/no-explicit-any": "warn"
        }
    },
    {
        files: ["mod-source/src/**", "userscripts/**"],
        languageOptions: { globals: { ...globals.browser } }
    },
    {
        files: ["**/*.worker.js"],
        languageOptions: { globals: { ...globals.worker } }
    },
    {
        files: ["falcon-launcher/src/**"],
        languageOptions: { globals: { ...globals.browser, ...globals.webextensions } }
    },
    {
        files: ["**/*.mjs", "**/*.mts", "mod-source/packaging/**", "scripts/**"],
        languageOptions: { globals: { ...globals.node } }
    },
    {
        files: ["mod-source/test/**", "mod-source/bench/**"],
        languageOptions: { globals: { ...globals.node, ...globals.browser } }
    }
);
