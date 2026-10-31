// Runs ESLint or Prettier from tools/lint, which has its own install (see tools/lint/package.json for why).
// Usage: node scripts/tool.mjs <eslint|prettier> [args...]
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const bins = {
    eslint: "tools/lint/node_modules/eslint/bin/eslint.js",
    prettier: "tools/lint/node_modules/prettier/bin/prettier.cjs"
};

const [name, ...args] = process.argv.slice(2);
const bin = bins[name];

if (!bin) {
    console.error(`Unknown tool "${name}". Use one of: ${Object.keys(bins).join(", ")}.`);
    process.exit(1);
}

if (!existsSync(resolve(root, bin))) {
    console.error(`${name} is not installed yet. Run "npm run install:all" once, then try again.`);
    process.exit(1);
}

const result = spawnSync(process.execPath, [resolve(root, bin), ...args], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
