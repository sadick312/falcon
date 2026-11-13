import readStoredJSON from "@utils/storage/readStoredJSON";
import showNotice from "@ui/Notice";
import Menu, { menuContent } from "../Menu";
import drawItemBody from "./drawItemBody";

function button(label: string) {
    const el = document.createElement("div");
    el.classList.add("menuConfigUIButton");
    el.textContent = label;
    el.style.pointerEvents = "auto";
    return el;
}

/** Export / Import / Reset to Default (settings as text you can copy, keep or share). */
function drawTransferUI() {
    const body = drawItemBody();
    body.style.pointerEvents = "none";
    body.style.flexDirection = "column";
    body.style.alignItems = "stretch";
    body.style.gap = "6px";

    const box = document.createElement("textarea");
    box.classList.add("menuConfigUIInput");
    box.placeholder = "Export puts your settings here (and copies them). Paste settings here, then Import.";
    box.spellcheck = false;
    box.style.cssText = "pointer-events:auto;height:70px;resize:vertical;font:12px Consolas,monospace;width:auto";

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;pointer-events:none";
    const exportButton = button("Export");
    const importButton = button("Import");
    const resetButton = button("Reset to Default");
    row.append(exportButton, importButton, resetButton);
    body.append(box, row);

    exportButton.onclick = async () => {
        box.value = Menu.exportSettings();
        box.select();
        try {
            await navigator.clipboard.writeText(box.value);
            showNotice("Settings copied to clipboard");
        } catch {
            showNotice("Settings are in the box: press Ctrl+C to copy");
        }
    };

    importButton.onclick = () => {
        try {
            const result = Menu.importSettings(box.value);
            showNotice(`Imported ${result.applied} settings${result.skipped ? ` (${result.skipped} skipped)` : ""}`);
            Menu.renderItems(menuContent.configs);
        } catch (e) {
            showNotice((e as Error).message, "warn");
        }
    };

    resetButton.onclick = () => {
        if (!confirm("Put every Falcon setting back to its default? (Keybinds and saved configs stay.)")) return;
        Menu.resetSettings();
        showNotice("Settings reset to default");
        Menu.renderItems(menuContent.configs);
    };

    Menu.contentElement.appendChild(body);
}

export default function drawConfigUI() {
    const body = drawItemBody();
    body.style.pointerEvents = "none";
    body.classList.add("menuConfigUI");

    const nameInput = document.createElement("input");
    nameInput.classList.add("menuConfigUIInput");
    nameInput.type = "text";
    nameInput.maxLength = 45;
    nameInput.placeholder = "Config Name";

    const saveButton = document.createElement("div");
    saveButton.classList.add("menuConfigUIButton");
    saveButton.innerHTML = "Save";

    body.appendChild(nameInput);
    body.appendChild(saveButton);

    saveButton.onclick = async () => {
        if (nameInput.value) {
            const savedCache: Record<string, any> = {};

            for (const id in Menu.itemMap) {
                const item = Menu.itemMap[id];
                if (item.neverSave) continue;
                if (item.type === "paragraph") continue;
                savedCache[item.id] = item.status;
            }

            const savedConfigs = readStoredJSON<Record<string, any>>("falcon-configs", {});
            savedConfigs[nameInput.value] = savedCache;
            localStorage.setItem("falcon-configs", JSON.stringify(savedConfigs));
            Menu.renderItems(menuContent.configs);
        }
    };

    Menu.contentElement.appendChild(body);
    drawTransferUI();
}
