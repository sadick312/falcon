// Shared ESLint config for every workspace. Run it from the repository root with `npm run lint`.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        // Paths are relative to the repository root, two folders up.
        basePath: "../..",
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "coverage/**",
            "stats/**",
            "mod-source/bench/results/**"
        ]
    },
    {
        basePath: "../..",
        files: ["**/*.{ts,mts,js,mjs,cjs}"],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        rules: {
            // Same convention as TypeScript's noUnusedParameters: a leading underscore marks "unused on purpose".
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
            // Use a real type, `unknown`, or (for decoded packet data) WireValue from utils/socket/PacketMap.ts.
            "@typescript-eslint/no-explicit-any": "error",
            // Class fields like `isPlayer: true = true` tag a type on purpose; `as const` would read worse there.
            "@typescript-eslint/prefer-as-const": "off"
        }
    },
    {
        basePath: "../..",
        files: ["mod-source/src/**", "falcon-launcher/src/**", "userscripts/**"],
        languageOptions: { globals: globals.browser }
    },
    {
        basePath: "../..",
        files: ["falcon-launcher/src/background.ts"],
        languageOptions: { globals: globals.serviceworker }
    },
    {
        basePath: "../..",
        files: ["**/*.{mjs,cjs,mts}", "scripts/**", "mod-source/packaging/**", "**/vite.config.ts", "mod-source/bench/**", "mod-source/test/**"],
        languageOptions: { globals: globals.node }
    }
);
