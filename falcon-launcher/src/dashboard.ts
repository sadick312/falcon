// The extension dashboard (index.html): shows whether Falcon is ready, the last load result and a setup guide.
import { type LoadStatus, STATUS_REQUEST, type StatusReply } from "./status";

const GUIDE_HIDDEN_KEY = "falcon-dashboard-guide-hidden";
/** Files the background worker injects into game pages (see vite.config.ts). */
const MOD_FILES = ["mod/bundle.js", "mod/index.html", "mod/style.css"];

function element<T extends HTMLElement = HTMLElement>(id: string) {
    const found = document.getElementById(id);
    if (!found) throw new Error(`Dashboard element #${id} is missing.`);
    return found as T;
}

type BadgeState = "ok" | "warn" | "error" | "checking";

function setStatus(state: BadgeState, badge: string, text: string) {
    const badgeElement = element("status-badge");
    badgeElement.className = `badge badge-${state}`;
    badgeElement.textContent = badge;
    element("status-text").textContent = text;
}

/** The mod files that are missing from the extension (it was built without `npm run mod:build`). */
async function missingModFiles() {
    const missing: string[] = [];

    for (const file of MOD_FILES) {
        try {
            const response = await fetch(chrome.runtime.getURL(file), { method: "HEAD", signal: AbortSignal.timeout(5e3) });
            if (!response.ok) missing.push(file);
        } catch {
            missing.push(file);
        }
    }

    return missing;
}

async function askBackground(): Promise<StatusReply | null> {
    try {
        return await chrome.runtime.sendMessage({ type: STATUS_REQUEST }) as StatusReply;
    } catch {
        return null;
    }
}

function describeTime(time: number) {
    const seconds = Math.round((Date.now() - time) / 1e3);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
    return new Date(time).toLocaleString();
}

function showLastLoad(lastLoad: LoadStatus | null) {
    const lastLoadElement = element("last-load");
    const errorElement = element("status-error");
    lastLoadElement.hidden = false;
    errorElement.hidden = true;

    if (!lastLoad) {
        // The background worker sleeps when idle and forgets this, so "nothing yet" is not an error.
        lastLoadElement.textContent = "No game page loaded since Chrome last started Falcon's background worker.";
        return;
    }

    if (lastLoad.ok) {
        lastLoadElement.textContent = `Last loaded on ${lastLoad.host}, ${describeTime(lastLoad.time)}.`;
        return;
    }

    lastLoadElement.textContent = `Last load on ${lastLoad.host} failed, ${describeTime(lastLoad.time)}:`;
    errorElement.textContent = lastLoad.error ?? "Unknown error.";
    errorElement.hidden = false;
}

async function refreshStatus() {
    const missing = await missingModFiles();
    if (missing.length) {
        setStatus("error", "Files missing",
            `The extension is missing ${missing.join(", ")}. Run "npm run build", then reload Falcon in chrome://extensions.`);
        return;
    }

    const reply = await askBackground();
    const lastLoad = reply?.lastLoad ?? null;
    showLastLoad(lastLoad);

    if (lastLoad && !lastLoad.ok) {
        setStatus("warn", "Last load failed", "The files are in place, but the last game page didn't start. See the error below.");
    } else {
        setStatus("ok", "Ready", "Falcon is installed. Open a game page below and it loads automatically.");
    }
}

function setUpGuide() {
    const guide = element<HTMLDetailsElement>("guide");
    let hidden = false;
    // Page storage can be unavailable (e.g. blocked site data); the guide then just stays open.
    try {
        hidden = localStorage.getItem(GUIDE_HIDDEN_KEY) === "1";
    } catch { /* keep it open */ }
    guide.open = !hidden;

    element("hide-guide").addEventListener("click", () => {
        guide.open = false;
        try {
            localStorage.setItem(GUIDE_HIDDEN_KEY, "1");
        } catch { /* nothing to remember it in */ }
    });
}

element("version").textContent = `v${chrome.runtime.getManifest().version}`;
setUpGuide();
refreshStatus().catch((err) => setStatus("error", "Error", `Could not check the status: ${String(err)}`));
// Coming back to the tab (e.g. after trying a game page) shows the latest result.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshStatus().catch(() => { });
});
