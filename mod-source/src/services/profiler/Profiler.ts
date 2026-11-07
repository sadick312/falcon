/**
 * Opt-in timing for hot paths, in development builds only (`npm run mod:build:dev` or `npm run mod:watch`).
 * Turn it on in the game page's console with
 * `localStorage.setItem("falcon-profiler", "1")` and reload; remove the key to turn it off.
 *
 * It only measures: it reads performance.now() and draws an overlay. Callers guard every call with
 * `__DEV__`, which production builds define as false, so esbuild drops the calls and this module.
 * Keep the top level free of side effects so that stays true.
 */

/** count/total/worst cover the overlay's last second; the session fields cover everything since load or reset. */
type Stat = { count: number; total: number; worst: number; sessionWorst: number; sessionCount: number; sessionTotal: number; samples?: number[] };

export interface ProfileSummary {
    calls: number;
    totalMs: number;
    avgMs: number;
    worstMs: number;
    /** Only when enabled with `keepSamples`. */
    p95Ms?: number;
}

const STORAGE_KEY = "falcon-profiler";
const stats: Record<string, Stat> = {};
let enabled: boolean | null = null;
let keepSamples = false;
let now = () => performance.now();

function isEnabled() {
    if (enabled === null) {
        try {
            enabled = localStorage.getItem(STORAGE_KEY) === "1";
        } catch {
            enabled = false;
        }
        if (enabled) startOverlay();
    }
    return enabled;
}

/**
 * Turns the profiler on without the localStorage key, for the replay benchmark (mod-source/bench).
 * `clock` replaces performance.now(), which the benchmark fakes to replay recorded timestamps.
 */
export function enableProfiler(options: { overlay?: boolean; keepSamples?: boolean; clock?: () => number } = {}) {
    enabled = true;
    keepSamples = options.keepSamples ?? false;
    if (options.clock) now = options.clock;
    if (options.overlay ?? true) startOverlay();
}

/** Returns a start time to pass to profileEnd, or 0 when the profiler is off. */
export function profileStart(): number {
    return isEnabled() ? now() : 0;
}

function record(name: string, elapsed: number) {
    const stat = stats[name] ??= { count: 0, total: 0, worst: 0, sessionWorst: 0, sessionCount: 0, sessionTotal: 0 };
    stat.count++;
    stat.total += elapsed;
    stat.sessionCount++;
    stat.sessionTotal += elapsed;
    if (elapsed > stat.worst) stat.worst = elapsed;
    if (elapsed > stat.sessionWorst) stat.sessionWorst = elapsed;
    if (keepSamples) (stat.samples ??= []).push(elapsed);
}

export function profileEnd(name: string, start: number) {
    if (!enabled) return;
    record(name, now() - start);
}

/** Records the time since `start` under `name` and returns the current time, to time consecutive steps. */
export function profileLap(name: string, start: number): number {
    if (!enabled) return 0;

    const time = now();
    record(name, time - start);
    return time;
}

/** Every measurement since load (or the last reset), by name. */
export function profileSummary(): Record<string, ProfileSummary> {
    const out: Record<string, ProfileSummary> = {};

    for (const [name, s] of Object.entries(stats)) {
        const summary: ProfileSummary = {
            calls: s.sessionCount,
            totalMs: s.sessionTotal,
            avgMs: s.sessionCount ? s.sessionTotal / s.sessionCount : 0,
            worstMs: s.sessionWorst
        };

        if (s.samples?.length) {
            const sorted = [...s.samples].sort((a, b) => a - b);
            summary.p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        }

        out[name] = summary;
    }

    return out;
}

/** Shows the last second's average and worst time per measurement, plus the worst since load. */
function startOverlay() {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;pointer-events:none;"
        + "background:rgba(0,0,0,.7);color:#fff;font:11px/1.4 monospace;padding:6px 8px;border-radius:4px;white-space:pre";
    overlay.textContent = "profiler: waiting for data";
    document.body.appendChild(overlay);

    const ms = (n: number) => n.toFixed(2).padStart(7);

    setInterval(() => {
        const names = Object.keys(stats).sort();
        const width = Math.max(8, ...names.map(name => name.length));
        const lines = [`${"".padEnd(width)}  avg/1s  worst/1s  worst  calls/s`];
        for (const name of names) {
            const s = stats[name];
            if (!s) continue;
            const avg = s.count ? s.total / s.count : 0;
            lines.push(`${name.padEnd(width)} ${ms(avg)}  ${ms(s.worst)}  ${ms(s.sessionWorst)}  ${String(s.count).padStart(7)}`);
            s.count = 0;
            s.total = 0;
            s.worst = 0;
        }
        overlay.textContent = lines.join("\n");
    }, 1000);
}
