type ConnectionStep =
    | "server-list"
    | "protocol"
    | "captcha"
    | "join"
    | "socket-open"
    | "handshake"
    | "closed";

const STEP_LABELS: Record<ConnectionStep, string> = {
    "server-list": "Server list failed",
    protocol: "Game protocol not found",
    captcha: "Captcha failed",
    join: "Join request failed",
    "socket-open": "Could not open socket",
    handshake: "Server handshake failed",
    closed: "Connection closed"
};

/**
 * Reloads the page: the only way to connect again, since the main menu is gone once we've connected. A reload also
 * starts every manager from a clean state (Quick Inject and the extension both run Falcon again on load).
 */
export const reconnect = { run: () => location.reload() };

const reconnectBtn = document.getElementById("reconnect-btn");
if (reconnectBtn) reconnectBtn.onclick = () => reconnect.run();

function setDisplay(id: string, value: string) {
    const elem = document.getElementById(id);
    if (elem) elem.style.display = value;
}

/** Full-screen error for failures that end the connection attempt. */
export function showConnectionError(step: ConnectionStep, detail: string) {
    console.error(`[Falcon] ${step}: ${detail}`);

    setDisplay("loading-page", "none");
    setDisplay("server-browser-page", "none");
    setDisplay("main-menu", "none");
    setDisplay("game-ui", "none");
    setDisplay("death-text", "none");
    setDisplay("respawn-page-main-card", "none");
    setDisplay("respawn-page", "flex");
    setDisplay("disconnected-page", "flex");

    const reason = document.getElementById("disconnected-reason");
    if (reason) reason.innerText = `${STEP_LABELS[step]}: ${detail}`;
}

/** "Server restarting in m:ss", like the game's own countdown. The server repeats SERVER_RESTARTING while counting down. */
export function showServerRestarting(secondsLeft: number) {
    // The game ignores negative values too.
    if (!(secondsLeft >= 0)) return;

    let banner = document.getElementById("falcon-restart-notice");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "falcon-restart-notice";
        banner.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99999;pointer-events:none;" +
            "background:rgba(0,0,0,.6);color:#fff;padding:8px 14px;border-radius:8px;font:16px 'Hammersmith One',sans-serif;";
        document.body.appendChild(banner);
    }

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(Math.floor(secondsLeft % 60)).padStart(2, "0");
    banner.innerText = `Server restarting in ${minutes}:${seconds}`;
    banner.style.display = "block";
}

let noticeTimer: number | undefined;

/** Small non-blocking banner for failures that don't end anything (e.g. quick-connect lookup). */
export function showConnectionNotice(step: ConnectionStep, detail: string) {
    console.warn(`[Falcon] ${step}: ${detail}`);

    let banner = document.getElementById("falcon-connection-notice");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "falcon-connection-notice";
        banner.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;" +
            "background:#b3261e;color:#fff;padding:10px 16px;border-radius:8px;font:14px sans-serif;max-width:80vw;";
        document.body.appendChild(banner);
    }

    banner.innerText = `${STEP_LABELS[step]}: ${detail}`;
    banner.style.display = "block";

    clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => { banner!.style.display = "none"; }, 6000);
}
