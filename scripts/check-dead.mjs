// Finds dead code: files nothing uses, exports nothing else uses, and menu settings nothing reads.
//
// Stands in for knip, which can't load its native resolver on some Windows PCs (a missing Visual C++ runtime).
// The opposite settings check (every Menu.getValue name is a real setting) is a test: test/menu/setting-ids.test.ts.
//
// Usage: npm run check:dead   (builds the mod first, so dist/meta.json lists the files in the bundle)
// Exit code 1 when anything is found. To keep something on purpose, add it to KEEP with the reason.
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, extname, join, relative, sep } from "path";

const root = join(import.meta.dirname, "..");
const mod = join(root, "mod-source");
const src = join(mod, "src");

/** Exports kept on purpose although only their own file uses them: "file:name" -> why. */
const KEEP = new Map([
]);

function walk(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === "dist" || name === ".build" || name === "results") continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|mts|js|mjs)$/.test(name)) out.push(p);
    }
    return out;
}

const srcFiles = walk(src);
// Everything that may use src code: the mod itself, its tests and bench, the scripts, and the launcher.
const users = [...srcFiles, ...walk(join(mod, "test")), ...walk(join(mod, "bench")), ...walk(join(root, "scripts")), ...walk(join(root, "falcon-launcher", "src"))];
const text = new Map(users.map(f => [f, readFileSync(f, "utf8")]));
const rel = f => relative(root, f).split(sep).join("/");
const problems = [];

// 1. Source files that never reach the bundle and that no file imports (type-only files are imported but erased).
const metaPath = join(mod, "dist", "meta.json");
if (!existsSync(metaPath)) {
    console.error("mod-source/dist/meta.json is missing: run `npm run mod:build` first (npm run check:dead does).");
    process.exit(1);
}
const bundled = new Set(Object.keys(JSON.parse(readFileSync(metaPath, "utf8")).inputs).map(p => join(mod, p)));
const importLines = [...text.values()].flatMap(t => t.match(/(?:from|import)\s*\(?\s*["'][^"']+["']/g) ?? []);
for (const f of srcFiles) {
    if (bundled.has(f) || f.endsWith(".d.ts")) continue;
    const name = basename(f, extname(f));
    const imported = importLines.some(line => new RegExp(`[/"']${name}["']`).test(line));
    if (!imported) problems.push(`unused file: ${rel(f)}`);
}

// 2. Exports no other file mentions.
const exportRe = /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
for (const f of srcFiles) {
    for (const m of text.get(f).matchAll(exportRe)) {
        const name = m[1];
        if (KEEP.has(`${rel(f)}:${name}`)) continue;
        const word = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`);
        const usedElsewhere = users.some(other => other !== f && word.test(text.get(other)));
        if (!usedElsewhere) problems.push(`export only its own file uses: ${rel(f)}: ${name}`);
    }
}

// 3. Menu settings that no code reads (any quoted mention of the id outside the menu content counts as a read).
const contentDir = join(src, "core", "menu", "content");
const settingTypes = /type:\s*"(toggle|select|slider|number)"/;
const outsideMenu = srcFiles.filter(f => !f.startsWith(contentDir)).map(f => text.get(f)).join("\n");
for (const f of srcFiles.filter(f => f.startsWith(contentDir))) {
    const t = text.get(f);
    for (const m of t.matchAll(/id:\s*"([^"]+)"/g)) {
        // The setting's own object: from the id to the next "}, {" or end of item.
        const own = t.slice(Math.max(0, m.index - 400), m.index + 600);
        if (!settingTypes.test(own)) continue;
        const quoted = new RegExp(`["'\`]${m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`);
        if (!quoted.test(outsideMenu)) problems.push(`setting nothing reads: ${m[1]} (${rel(f)})`);
    }
}

if (problems.length) {
    console.error(`Dead code found (${problems.length}):`);
    for (const p of problems) console.error(`  ${p}`);
    console.error("Remove it, or add it to KEEP in scripts/check-dead.mjs with the reason.");
    process.exit(1);
}
console.log(`No dead code: ${srcFiles.length} source files, every export and setting is used.`);
