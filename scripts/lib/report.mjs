// Builds stats/report.html from stats/history.json: one page with the history inlined and Chart.js
// from a CDN. Used by dev-stats.mjs after each run, or on its own: node scripts/lib/report.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const CHART_JS = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

/** Only the fields the charts and table use, so the page doesn't carry every top-15 list. */
function slim(entry) {
    const errors = entry.typecheck ? Object.values(entry.typecheck.errors).reduce((a, b) => a + Math.max(0, b), 0) : null;
    return {
        date: entry.date,
        commit: entry.commit + (entry.dirty ? "+" : ""),
        label: entry.label ?? "",
        importsMethod: entry.methods?.imports ?? null,
        bundleKb: entry.bundle ? +(entry.bundle.raw / 1024).toFixed(1) : null,
        gzipKb: entry.bundle ? +(entry.bundle.gzip / 1024).toFixed(1) : null,
        modBuildS: entry.build ? +(entry.build.modMs / 1000).toFixed(2) : null,
        extBuildS: entry.build ? +(entry.build.extMs / 1000).toFixed(2) : null,
        tsErrors: errors,
        any: entry.typecheck?.any ?? null,
        tsIgnore: entry.typecheck?.tsIgnore ?? null,
        cycleFiles: entry.circular?.files ?? null,
        cyclePairs: entry.circular?.mutualPairs ?? null,
        audit: entry.deps?.audit ?? null,
        outdated: entry.deps?.outdated?.length ?? null
    };
}

export function renderReport(history) {
    // "<" escaped so a label can't close the <script> element.
    const data = JSON.stringify(history.map(slim)).replace(/</g, "\\u003c");

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Falcon Dev Stats</title>
<style>
    :root { --bg: #f7f7f8; --card: #fff; --text: #1d1d20; --muted: #6b6b75; --border: #e3e3e8; }
    @media (prefers-color-scheme: dark) {
        :root { --bg: #151518; --card: #1f1f23; --text: #ececf0; --muted: #9a9aa6; --border: #33333a; }
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, sans-serif; }
    main { max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .sub { color: var(--muted); margin: 0 0 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; min-width: 0; }
    .card h2 { font-size: 14px; margin: 0 0 8px; }
    .card p { color: var(--muted); font-size: 12px; margin: 6px 0 0; }
    .chart { position: relative; height: 220px; }
    .table-wrap { overflow-x: auto; margin-top: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; white-space: nowrap; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<main>
    <h1>Falcon dev stats</h1>
    <p class="sub" id="summary"></p>
    <div class="grid">
        <section class="card"><h2>Bundle size (KB)</h2><div class="chart"><canvas id="bundle"></canvas></div></section>
        <section class="card"><h2>Build time (s)</h2><div class="chart"><canvas id="build"></canvas></div></section>
        <section class="card"><h2>"any" uses</h2><div class="chart"><canvas id="any"></canvas></div></section>
        <section class="card"><h2>Circular imports</h2><div class="chart"><canvas id="cycles"></canvas></div>
            <p id="cycle-note"></p></section>
        <section class="card"><h2>npm audit findings</h2><div class="chart"><canvas id="audit"></canvas></div></section>
    </div>
    <div class="card table-wrap"><table id="runs"></table></div>
</main>
<script src="${CHART_JS}"></script>
<script>
const runs = ${data};
const labels = runs.map((r, i) => "#" + (i + 1));
const css = getComputedStyle(document.documentElement);
const text = css.getPropertyValue("--muted").trim();
const grid = css.getPropertyValue("--border").trim();
const palette = ["#4f7cff", "#e8590c", "#2f9e44", "#ae3ec9", "#f08c00", "#e03131"];

const tooltipTitle = (items) => {
    const r = runs[items[0].dataIndex];
    return r.date.slice(0, 16).replace("T", " ") + "  " + r.commit + (r.label ? "  " + r.label : "");
};

function chart(id, series, options = {}) {
    const el = document.getElementById(id);
    if (typeof Chart === "undefined") { el.parentElement.textContent = "Chart.js didn't load (offline?)."; return; }
    new Chart(el, {
        type: options.type ?? "line",
        data: { labels, datasets: series.map((s, i) => ({ borderColor: palette[i], backgroundColor: palette[i], tension: 0.2, pointRadius: 3, spanGaps: true, ...s })) },
        options: {
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { labels: { color: text, boxWidth: 12 } }, tooltip: { callbacks: { title: tooltipTitle } } },
            scales: {
                x: { stacked: options.stacked, ticks: { color: text }, grid: { color: grid } },
                y: { stacked: options.stacked, beginAtZero: options.beginAtZero ?? false, ticks: { color: text, precision: 0 }, grid: { color: grid } }
            }
        }
    });
}

const pick = (key) => runs.map((r) => r[key]);
chart("bundle", [{ label: "raw", data: pick("bundleKb") }, { label: "gzip", data: pick("gzipKb") }], { beginAtZero: true });
chart("build", [{ label: "mod-source", data: pick("modBuildS") }, { label: "falcon-launcher", data: pick("extBuildS") }], { beginAtZero: true });
chart("any", [{ label: "any", data: pick("any") }, { label: "@ts-ignore", data: pick("tsIgnore") }], { beginAtZero: true });
chart("cycles", [{ label: "files in cycles", data: pick("cycleFiles") }, { label: "A<->B pairs", data: pick("cyclePairs") }], { beginAtZero: true });
const sev = { critical: "#c92a2a", high: "#e8590c", moderate: "#f08c00", low: "#4f7cff", info: "#868e96" };
chart("audit", Object.entries(sev).map(([s, color]) => ({ label: s, borderColor: color, backgroundColor: color, data: runs.map((r) => r.audit ? r.audit[s] : null) })), { type: "bar", stacked: true, beginAtZero: true });

const methodChanges = runs.map((r, i) => i > 0 && r.importsMethod !== runs[i - 1].importsMethod ? "#" + (i + 1) : null).filter(Boolean);
document.getElementById("cycle-note").textContent = methodChanges.length
    ? "Measured differently from " + methodChanges.join(", ") + " on (" + runs.at(-1).importsMethod + "), so the drop there is partly the method."
    : "";

const first = runs[0], last = runs.at(-1);
document.getElementById("summary").textContent = runs.length + " runs, " + first.date.slice(0, 10) + " to " + last.date.slice(0, 10)
    + ". Bundle " + first.bundleKb + " -> " + last.bundleKb + " KB, any " + first.any + " -> " + last.any + ".";

const cols = [["#", (r, i) => i + 1], ["date", (r) => r.date.slice(0, 16).replace("T", " ")], ["commit", (r) => r.commit], ["label", (r) => r.label],
    ["bundle KB", (r) => r.bundleKb], ["gzip KB", (r) => r.gzipKb], ["mod s", (r) => r.modBuildS], ["ext s", (r) => r.extBuildS],
    ["ts errors", (r) => r.tsErrors], ["any", (r) => r.any], ["cycle files", (r) => r.cycleFiles], ["outdated", (r) => r.outdated], ["audit", (r) => r.audit?.total ?? null]];
const table = document.getElementById("runs");
const head = table.createTHead().insertRow();
for (const [name] of cols) head.appendChild(Object.assign(document.createElement("th"), { textContent: name }));
const body = table.createTBody();
runs.forEach((r, i) => {
    const row = body.insertRow();
    for (const [, get] of cols) {
        const v = get(r, i);
        const cell = row.insertCell();
        cell.textContent = v ?? "–";
        if (typeof v === "number") cell.className = "num";
    }
});
</script>
</body>
</html>
`;
}

export function writeReport(historyPath, outPath) {
    const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    fs.writeFileSync(outPath, renderReport(history));
    return outPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const statsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "stats");
    const out = writeReport(path.join(statsDir, "history.json"), path.join(statsDir, "report.html"));
    console.log(`Wrote ${path.relative(process.cwd(), out)}`);
}
