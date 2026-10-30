// Collects build, bundle, type, code-size, import-graph and dependency stats for the monorepo,
// appends them to stats/history.json and prints the change since the previous run.
//
// Usage: npm run stats [-- --label "text"] [-- --skip-deps]
//   --label      note stored with the entry (e.g. "batch 1")
//   --skip-deps  skip npm outdated / npm audit (they need the network)
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";
import { countAny } from "./lib/count-any.mjs";
import { writeReport } from "./lib/report.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATS_DIR = path.join(ROOT, "stats");
const HISTORY_PATH = path.join(STATS_DIR, "history.json");

const WORKSPACES = [
    { name: "mod-source", dir: path.join(ROOT, "mod-source") },
    { name: "falcon-launcher", dir: path.join(ROOT, "falcon-launcher") }
];
const MOD_DIR = WORKSPACES[0].dir;
const BUNDLE_PATH = path.join(MOD_DIR, "dist", "bundle.js");
// Written by every mod build (mod-source/packaging/esbuild.config.mjs).
const METAFILE_PATH = path.join(MOD_DIR, "dist", "meta.json");

const args = process.argv.slice(2);
const label = args.includes("--label") ? args[args.indexOf("--label") + 1] ?? "" : "";
const skipDeps = args.includes("--skip-deps");

const kb = (bytes) => bytes / 1024;
const fmtKb = (bytes) => `${kb(bytes).toFixed(1)} KB`;

function run(command, cwd = ROOT, timeout = 600_000) {
    const start = performance.now();
    const result = spawnSync(command, { cwd, shell: true, encoding: "utf8", timeout, maxBuffer: 1 << 28 });
    return {
        ok: result.status === 0,
        status: result.status,
        ms: Math.round(performance.now() - start),
        out: (result.stdout ?? "") + (result.stderr ?? "")
    };
}

function section(title) {
    console.log(`\n== ${title}`);
}

function listFiles(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) listFiles(full, out);
        else out.push(full);
    }
    return out;
}

const rel = (file) => path.relative(ROOT, file).replace(/\\/g, "/");

// ---------------------------------------------------------------- build

function collectBuild() {
    section("Build");
    const mod = run("npm run build --workspace=mod-source");
    console.log(`mod-source       ${mod.ok ? "ok" : "FAILED"}  ${(mod.ms / 1000).toFixed(1)} s`);
    const ext = run("npm run build --workspace=falcon-launcher");
    console.log(`falcon-launcher  ${ext.ok ? "ok" : "FAILED"}  ${(ext.ms / 1000).toFixed(1)} s`);

    for (const [name, r] of [["mod-source", mod], ["falcon-launcher", ext]]) {
        if (!r.ok) console.log(`--- ${name} build output (tail)\n${r.out.split("\n").slice(-15).join("\n")}`);
    }

    return { modMs: mod.ms, modOk: mod.ok, extMs: ext.ms, extOk: ext.ok };
}

// ---------------------------------------------------------------- bundle

/** The metafile from this run's build, or null when the build failed or didn't write one. */
function readMetafile() {
    if (!fs.existsSync(METAFILE_PATH) || !fs.existsSync(BUNDLE_PATH)) return null;
    // A metafile older than the bundle is from a previous build.
    if (fs.statSync(METAFILE_PATH).mtimeMs < fs.statSync(BUNDLE_PATH).mtimeMs) return null;
    return JSON.parse(fs.readFileSync(METAFILE_PATH, "utf8"));
}

/** The bundle.js entry of meta.outputs (the other output is the source map). */
function bundleOutput(meta) {
    return Object.entries(meta.outputs).find(([file]) => file.endsWith("bundle.js"))?.[1] ?? Object.values(meta.outputs)[0];
}

/** Groups node_modules inputs by package so a dependency shows up as one line. */
function contributorName(input) {
    const match = input.replace(/\\/g, "/").match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
    return match ? `${match[1]} (npm)` : input.replace(/^\.\.\//, "");
}

function collectBundle(meta) {
    section("Bundle");
    if (!fs.existsSync(BUNDLE_PATH)) {
        console.log("No mod-source/dist/bundle.js; the build failed.");
        return null;
    }

    const bytes = fs.readFileSync(BUNDLE_PATH);
    const raw = bytes.length;
    const gzip = zlib.gzipSync(bytes, { level: 9 }).length;
    console.log(`bundle.js  ${fmtKb(raw)} raw, ${fmtKb(gzip)} gzip`);

    if (!meta) {
        console.log(`No fresh ${rel(METAFILE_PATH)}; skipping the breakdown.`);
        return { raw, gzip, top: [] };
    }

    const totals = new Map();
    for (const [input, info] of Object.entries(bundleOutput(meta).inputs)) {
        const name = contributorName(input);
        totals.set(name, (totals.get(name) ?? 0) + info.bytesInOutput);
    }

    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([name, size]) => ({ name, bytes: size, pct: +(size / sum * 100).toFixed(1) }));

    console.log(`Top 15 contributors (minified bytes in output, from ${rel(METAFILE_PATH)}):`);
    for (const t of top) console.log(`  ${fmtKb(t.bytes).padStart(10)}  ${String(t.pct).padStart(5)}%  ${t.name}`);

    return { raw, gzip, top };
}

// ---------------------------------------------------------------- typecheck

function collectTypecheck() {
    section("Type check");
    const errors = {};
    for (const ws of WORKSPACES) {
        const r = run(`npm exec --workspace=${ws.name} -- tsc --noEmit -p .`);
        const count = (r.out.match(/error TS\d+/g) ?? []).length;
        // A non-zero exit with no "error TS" lines means tsc itself failed to run.
        errors[ws.name] = !r.ok && count === 0 ? -1 : count;
        console.log(`${ws.name.padEnd(16)} ${errors[ws.name] === -1 ? "tsc failed to run" : `${count} errors`}  (${(r.ms / 1000).toFixed(1)} s)`);
    }

    let anyCount = 0;
    let tsIgnore = 0;
    for (const ws of WORKSPACES) {
        for (const file of listFiles(path.join(ws.dir, "src")).filter((f) => /\.(ts|tsx|mts)$/.test(f))) {
            const text = fs.readFileSync(file, "utf8");
            tsIgnore += (text.match(/@ts-(ignore|expect-error|nocheck)\b/g) ?? []).length;
            anyCount += countAny(text);
        }
    }

    console.log(`"any" uses       ${anyCount}`);
    console.log(`@ts-ignore etc.  ${tsIgnore}`);
    return { errors, any: anyCount, tsIgnore };
}

// ---------------------------------------------------------------- code size

function collectCode() {
    section("Code size (src/ of each workspace)");
    const workspaces = {};
    const all = [];

    for (const ws of WORKSPACES) {
        const files = listFiles(path.join(ws.dir, "src"));
        let lines = 0;
        for (const file of files) {
            const count = fs.readFileSync(file, "utf8").split("\n").length;
            lines += count;
            all.push({ file: rel(file), lines: count });
        }
        workspaces[ws.name] = { files: files.length, lines };
        console.log(`${ws.name.padEnd(16)} ${String(files.length).padStart(4)} files  ${String(lines).padStart(6)} lines`);
    }

    const largest = all.sort((a, b) => b.lines - a.lines).slice(0, 10);
    console.log("10 largest files:");
    for (const f of largest) console.log(`  ${String(f.lines).padStart(6)}  ${f.file}`);
    return { workspaces, largest };
}

// ---------------------------------------------------------------- import graph

/**
 * The mod's import graph from the esbuild metafile: the imports the bundle really loads, after
 * path aliases are resolved and type-only imports are dropped. The launcher's 3 files import nothing local.
 */
function buildGraph(meta) {
    const graph = new Map();
    const packages = new Map();
    const toRepo = (input) => rel(path.join(MOD_DIR, input));
    const isSource = (input) => input.startsWith("src/") && /\.(ts|tsx|mts|js|mjs)$/.test(input);

    for (const [input, info] of Object.entries(meta.inputs)) {
        if (!isSource(input)) continue;
        const deps = new Set();
        const pkgs = new Set();

        for (const imp of info.imports) {
            if (imp.path.includes("node_modules/")) pkgs.add(contributorName(imp.path).replace(/ \(npm\)$/, ""));
            else if (isSource(imp.path)) deps.add(toRepo(imp.path));
        }

        for (const pkg of pkgs) packages.set(pkg, (packages.get(pkg) ?? 0) + 1);
        graph.set(toRepo(input), deps);
    }
    return { graph, packages };
}

/** Tarjan's algorithm: strongly connected components with more than one file are import cycles. */
function findCycleGroups(graph) {
    let index = 0;
    const indices = new Map(), low = new Map(), onStack = new Set(), stack = [], groups = [];

    const strongConnect = (v) => {
        indices.set(v, index); low.set(v, index); index++;
        stack.push(v); onStack.add(v);

        for (const w of graph.get(v) ?? []) {
            if (!graph.has(w)) continue;
            if (!indices.has(w)) { strongConnect(w); low.set(v, Math.min(low.get(v), low.get(w))); }
            else if (onStack.has(w)) low.set(v, Math.min(low.get(v), indices.get(w)));
        }

        if (low.get(v) === indices.get(v)) {
            const group = [];
            let w;
            do { w = stack.pop(); onStack.delete(w); group.push(w); } while (w !== v);
            if (group.length > 1) groups.push(group);
        }
    };

    for (const v of graph.keys()) if (!indices.has(v)) strongConnect(v);
    return groups;
}

/** Shortest cycle through `start` inside its group, for a readable example. */
function shortestCycle(graph, start, group) {
    const members = new Set(group);
    const prev = new Map([[start, null]]);
    const queue = [start];

    while (queue.length) {
        const v = queue.shift();
        for (const w of graph.get(v) ?? []) {
            if (!members.has(w)) continue;
            if (w === start) {
                const cycle = [v];
                for (let p = prev.get(v); p !== null; p = prev.get(p)) cycle.unshift(p);
                return [...cycle, start];
            }
            if (!prev.has(w)) { prev.set(w, v); queue.push(w); }
        }
    }
    return null;
}

function collectImports(meta) {
    section("Imports (from the esbuild metafile)");
    if (!meta) {
        console.log("Skipped: the build wrote no metafile.");
        return { imports: null, circular: null };
    }

    const { graph, packages } = buildGraph(meta);

    const importedBy = new Map();
    for (const deps of graph.values()) for (const d of deps) importedBy.set(d, (importedBy.get(d) ?? 0) + 1);

    const topModules = [...importedBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([module, count]) => ({ module, count }));
    console.log("Most-imported local modules (files that import each):");
    for (const m of topModules) console.log(`  ${String(m.count).padStart(4)}  ${m.module}`);

    const topPackages = [...packages.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    console.log(`npm packages: ${topPackages.map((p) => `${p.name} (${p.count})`).join(", ") || "none"}`);

    const groups = findCycleGroups(graph);
    let mutualPairs = 0;
    for (const [v, deps] of graph) for (const w of deps) if (v < w && graph.get(w)?.has(v)) mutualPairs++;

    const filesInCycles = groups.reduce((n, g) => n + g.length, 0);
    const examples = groups.sort((a, b) => b.length - a.length).slice(0, 10).map((g) => {
        const start = [...g].sort()[0];
        return { size: g.length, cycle: shortestCycle(graph, start, g) };
    });

    section("Circular imports (runtime imports only)");
    console.log(`${groups.length} cycle groups, ${filesInCycles} files involved, ${mutualPairs} direct A<->B pairs`);
    for (const ex of examples) {
        console.log(`  group of ${ex.size}: ${ex.cycle.map((f) => f.replace(/^mod-source\/src\//, "")).join(" -> ")}`);
    }

    return {
        imports: { files: graph.size, topModules, packages: topPackages },
        circular: { groups: groups.length, files: filesInCycles, mutualPairs, examples }
    };
}

// ---------------------------------------------------------------- dependencies

function parseJson(text) {
    try { return JSON.parse(text); } catch { return null; }
}

function collectDeps() {
    section("Dependencies");
    if (skipDeps) {
        console.log("Skipped (--skip-deps).");
        return null;
    }

    // npm outdated exits 1 when anything is outdated, so read the JSON rather than the exit code.
    const outdatedRun = run("npm outdated --json --workspaces --include-workspace-root", ROOT, 180_000);
    const outdatedJson = parseJson(outdatedRun.out.slice(outdatedRun.out.indexOf("{")));
    let outdated = null;

    if (outdatedJson) {
        outdated = [];
        for (const [name, info] of Object.entries(outdatedJson)) {
            for (const entry of Array.isArray(info) ? info : [info]) {
                const major = (v) => parseInt(String(v ?? "").split(".")[0], 10);
                outdated.push({
                    name,
                    current: entry.current ?? "missing",
                    wanted: entry.wanted,
                    latest: entry.latest,
                    dependent: entry.dependent,
                    majorBehind: major(entry.latest) > major(entry.current)
                });
            }
        }
        console.log(`${outdated.length} outdated (${outdated.filter((o) => o.majorBehind).length} a major version behind)`);
        for (const o of outdated) {
            console.log(`  ${o.name.padEnd(34)} ${String(o.current).padEnd(16)} wanted ${String(o.wanted).padEnd(16)} latest ${o.latest}  [${o.dependent}]`);
        }
    } else {
        console.log(`npm outdated failed:\n${outdatedRun.out.split("\n").slice(-5).join("\n")}`);
    }

    const auditRun = run("npm audit --json", ROOT, 180_000);
    const auditJson = parseJson(auditRun.out.slice(auditRun.out.indexOf("{")));
    let audit = null;

    if (auditJson?.metadata?.vulnerabilities) {
        audit = auditJson.metadata.vulnerabilities;
        console.log(`npm audit: ${audit.total} findings (critical ${audit.critical}, high ${audit.high}, moderate ${audit.moderate}, low ${audit.low}, info ${audit.info})`);
        for (const [name, v] of Object.entries(auditJson.vulnerabilities ?? {})) {
            console.log(`  ${v.severity.padEnd(9)} ${name}${v.fixAvailable ? "" : " (no fix available)"}`);
        }
    } else {
        console.log(`npm audit failed:\n${auditRun.out.split("\n").slice(-5).join("\n")}`);
    }

    return { outdated, audit };
}

// ---------------------------------------------------------------- history

function gitInfo() {
    const commit = run("git rev-parse --short HEAD").out.trim();
    const dirty = run("git status --porcelain --untracked-files=no").out.trim().length > 0;
    return { commit, dirty };
}

/** Flat numbers compared between runs; a missing value on either side is skipped. */
function metrics(entry) {
    const errorSum = entry.typecheck ? Object.values(entry.typecheck.errors).reduce((a, b) => a + Math.max(0, b), 0) : null;
    return {
        "bundle": { value: entry.bundle?.raw, unit: "KB", scale: 1 / 1024 },
        "bundle gzip": { value: entry.bundle?.gzip, unit: "KB", scale: 1 / 1024 },
        "mod build": { value: entry.build?.modMs, unit: "s", scale: 1 / 1000 },
        "ext build": { value: entry.build?.extMs, unit: "s", scale: 1 / 1000 },
        "ts errors": { value: errorSum },
        "any": { value: entry.typecheck?.any },
        "ts-ignore": { value: entry.typecheck?.tsIgnore },
        "lines": { value: entry.code ? Object.values(entry.code.workspaces).reduce((a, w) => a + w.lines, 0) : null },
        "cycle files": { value: entry.circular?.files },
        "outdated": { value: entry.deps?.outdated?.length },
        "audit": { value: entry.deps?.audit?.total }
    };
}

function printDiff(prev, curr) {
    section(`Change since previous run (${prev.date.slice(0, 16)} ${prev.commit}${prev.dirty ? "+dirty" : ""}${prev.label ? `, "${prev.label}"` : ""})`);
    const a = metrics(prev), b = metrics(curr);
    const parts = [];

    for (const key of Object.keys(b)) {
        const before = a[key]?.value, after = b[key].value;
        if (before == null || after == null) continue;

        const scale = b[key].scale ?? 1;
        const delta = (after - before) * scale;
        // Build times move by a few hundred ms run to run; only report bigger swings.
        const threshold = b[key].unit === "s" ? 0.5 : b[key].unit === "KB" ? 0.05 : 0;
        if (Math.abs(delta) <= threshold) continue;

        const digits = b[key].unit ? 1 : 0;
        parts.push(`${key} ${delta > 0 ? "+" : ""}${delta.toFixed(digits)}${b[key].unit ? ` ${b[key].unit}` : ""}`);
    }

    console.log(parts.length ? parts.join(", ") : "no change");

    if (prev.methods?.imports !== curr.methods?.imports) {
        console.log(`Note: imports were measured with ${prev.methods?.imports ?? "?"} before and ${curr.methods?.imports} now, so the cycle change is partly the method.`);
    }
}

async function main() {
    const started = performance.now();
    const { commit, dirty } = gitInfo();

    console.log(`Falcon dev stats  ${new Date().toISOString()}  ${commit}${dirty ? " (uncommitted changes)" : ""}${label ? `  "${label}"` : ""}`);

    const build = collectBuild();
    const meta = readMetafile();
    const bundle = collectBundle(meta);
    const typecheck = collectTypecheck();
    const code = collectCode();
    const { imports, circular } = collectImports(meta);
    const deps = collectDeps();

    // How "any" and the import graph were measured; numbers from different methods aren't directly comparable.
    const methods = { any: "scanner", imports: "esbuild-metafile" };
    const entry = { date: new Date().toISOString(), commit, dirty, label, methods, build, bundle, typecheck, code, imports, circular, deps };

    fs.mkdirSync(STATS_DIR, { recursive: true });
    const history = fs.existsSync(HISTORY_PATH) ? parseJson(fs.readFileSync(HISTORY_PATH, "utf8")) ?? [] : [];
    const prev = history[history.length - 1];
    history.push(entry);
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n");

    if (prev) printDiff(prev, entry);
    else section("First run; nothing to compare against yet.");

    console.log(`\nSaved entry ${history.length} to ${rel(HISTORY_PATH)} (${((performance.now() - started) / 1000).toFixed(0)} s).`);
    console.log(`Report: ${rel(writeReport(HISTORY_PATH, path.join(STATS_DIR, "report.html")))}`);

    // The entry is saved either way, but CI should go red when a build failed (e.g. over the size budget).
    if (!build.modOk || !build.extOk) {
        console.error("\nA build failed; see the Build section above.");
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
