/**
 * Short on-screen messages at the top of the screen (e.g. "Weapon Build: Katana + Musket",
 * "Upgrade failed: Musket"). Each one fades out after a few seconds; at most 3 are shown at once.
 * Use this instead of console.log for things the player should see while playing.
 */
export type NoticeKind = "info" | "warn";

const MAX_SHOWN = 3;
const SHOW_MS = 2500;
const FADE_MS = 300;

let holder: HTMLDivElement | null = null;

function getHolder() {
    if (holder && holder.isConnected) return holder;

    holder = document.createElement("div");
    holder.id = "falcon-notices";
    holder.style.cssText = "position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:60;" +
        "display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none";
    document.body.appendChild(holder);
    return holder;
}

export default function showNotice(text: string, kind: NoticeKind = "info") {
    const box = getHolder();

    // Oldest message goes first when too many are on screen.
    while (box.childElementCount >= MAX_SHOWN) box.firstElementChild!.remove();

    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = "font:600 15px/1.3 'Hammersmith One',sans-serif;color:#fff;padding:6px 14px;border-radius:6px;" +
        `background:${kind === "warn" ? "rgba(170,40,40,.85)" : "rgba(0,0,0,.6)"};transition:opacity ${FADE_MS}ms`;
    box.appendChild(el);

    window.setTimeout(() => {
        el.style.opacity = "0";
        window.setTimeout(() => el.remove(), FADE_MS);
    }, SHOW_MS);
}
