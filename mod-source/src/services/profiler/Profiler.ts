/**
 * Opt-in timing for hot paths, in development builds only (`npm run mod:build:dev` or `npm run mod:watch`).
 * Turn it on in the game page's console with
 * `localStorage.setItem("falcon-profiler", "1")` and reload; remove the key to turn it off.
 *
 * It only measures: it reads performance.now() and draws an overlay. Callers guard every call with
 * `__DEV__`, which production builds define as false, so esbuild drops the calls and this module.
 * Keep the top level free of side effects so that stays true.
 */

type Stat = { count: number; total: number; worst: number; sessionWorst: number };

const STORAGE_KEY = "falcon-profiler";
const stats: Record<string, Stat> = {};
let enabled: boolean | null = null;

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

/** Returns a start time to pass to profileEnd, or 0 when the profiler is off. */
export function profileStart(): number {
    return isEnabled() ? performance.now() : 0;
}

export function profileEnd(name: string, start: number) {
    if (!enabled) return;

    const elapsed = performance.now() - start;
    const stat = stats[name] ??= { count: 0, total: 0, worst: 0, sessionWorst: 0 };
    stat.count++;
    stat.total += elapsed;
    if (elapsed > stat.worst) stat.worst = elapsed;
    if (elapsed > stat.sessionWorst) stat.sessionWorst = elapsed;
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
        const lines = ["           avg/1s  worst/1s  worst  calls/s"];
        for (const name of Object.keys(stats).sort()) {
            const s = stats[name];
            const avg = s.count ? s.total / s.count : 0;
            lines.push(`${name.padEnd(8)} ${ms(avg)}  ${ms(s.worst)}  ${ms(s.sessionWorst)}  ${String(s.count).padStart(7)}`);
            s.count = 0;
            s.total = 0;
            s.worst = 0;
        }
        overlay.textContent = lines.join("\n");
    }, 1000);
}
