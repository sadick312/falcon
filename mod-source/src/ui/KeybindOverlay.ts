import Keybinds from "@core/Keybinds";

/**
 * "Show All Hotkeys" (O by default): a panel listing every hotkey and its current key.
 * Built fresh each time it opens, so keys you changed in Menu > Keybinds show up right away.
 * Press the key again (or click the panel) to close it.
 */
let panel: HTMLDivElement | null = null;

function build() {
    const el = document.createElement("div");
    el.id = "falcon-hotkeys";
    el.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:70;" +
        "max-height:80vh;overflow:auto;padding:14px 20px;border-radius:10px;background:rgba(20,20,24,.9);" +
        "color:#eee;font:14px/1.5 'Hammersmith One',sans-serif;min-width:360px;cursor:pointer";
    el.onclick = () => hide();

    const title = document.createElement("div");
    title.textContent = "Hotkeys (change them in Menu > Keybinds)";
    title.style.cssText = "font-size:18px;margin-bottom:8px;color:#fff";
    el.appendChild(title);

    let lastCategory = "";
    for (const row of Keybinds.listBindings()) {
        if (row.category !== lastCategory) {
            lastCategory = row.category;
            const header = document.createElement("div");
            header.textContent = row.category;
            header.style.cssText = "margin-top:8px;color:#9ab;font-size:13px;text-transform:uppercase";
            el.appendChild(header);
        }

        const line = document.createElement("div");
        line.style.cssText = "display:flex;justify-content:space-between;gap:24px";
        const label = document.createElement("span");
        label.textContent = row.label;
        const key = document.createElement("span");
        key.textContent = row.key;
        key.style.color = row.key === "None" ? "#777" : "#ffd27a";
        line.append(label, key);
        el.appendChild(line);
    }

    return el;
}

function hide() {
    panel?.remove();
    panel = null;
}

export default function toggleKeybindOverlay() {
    if (panel) {
        hide();
        return;
    }

    panel = build();
    document.body.appendChild(panel);
}
