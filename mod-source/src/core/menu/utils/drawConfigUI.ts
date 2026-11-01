import readJson from "@utils/storage/readJson";
import Menu, { menuContent, SavedConfigs } from "../Menu";
import drawItemBody from "./drawItemBody";
import { keepEnterInInput, makeKeyboardClickable } from "./keyboard";

function makeButton(text: string, label: string) {
    const button = document.createElement("div");
    button.classList.add("menuConfigUIButton");
    button.textContent = text;
    makeKeyboardClickable(button, label);
    return button;
}

/** Saves the current settings as a .json file the player can keep or share. */
function exportSettings() {
    const json = JSON.stringify(Menu.collectSettings(), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "falcon-settings.json";
    link.click();
    // Revoking in the same task can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
}

/** Reads a settings file chosen by the player and applies it. Returns a message for the status line. */
async function importSettings(file: File) {
    let data: unknown;

    try {
        data = JSON.parse(await file.text());
    } catch {
        return `"${file.name}" is not a valid settings file (it isn't JSON).`;
    }

    if (!data || typeof data !== "object" || Array.isArray(data))
        return `"${file.name}" is not a valid settings file (expected an object of settings).`;

    const { applied, skipped } = await Menu.applySettings(data as Record<string, unknown>);
    const skippedText = skipped ? `, skipped ${skipped} that don't exist or don't fit anymore` : "";
    return `Imported ${applied} setting${applied === 1 ? "" : "s"}${skippedText}.`;
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
    nameInput.setAttribute("aria-label", "Config name");
    keepEnterInInput(nameInput);

    const saveButton = makeButton("Save", "Save config");
    const exportButton = makeButton("Export", "Export settings to a file");
    const importButton = makeButton("Import", "Import settings from a file");
    exportButton.title = "Download your current settings as falcon-settings.json";
    importButton.title = "Load settings from a .json file exported by Falcon";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.style.display = "none";

    body.append(nameInput, saveButton, exportButton, importButton, fileInput);

    const status = document.createElement("div");
    status.classList.add("menuConfigUIStatus");
    status.setAttribute("role", "status");

    saveButton.onclick = async () => {
        if (nameInput.value) {
            const savedConfigs = readJson<SavedConfigs>("falcon-configs", {});
            savedConfigs[nameInput.value] = Menu.collectSettings();
            localStorage.setItem("falcon-configs", JSON.stringify(savedConfigs));
            Menu.renderItems(menuContent.configs);
        }
    };

    exportButton.onclick = () => {
        exportSettings();
        status.textContent = "Saved falcon-settings.json to your downloads.";
    };

    importButton.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        fileInput.value = "";
        if (!file) return;

        const message = await importSettings(file);
        // Applying redraws the Configs tab, so write the message into the new status line.
        const newStatus = Menu.contentElement.querySelector(".menuConfigUIStatus");
        (newStatus ?? status).textContent = message;
    };

    Menu.contentElement.appendChild(body);
    Menu.contentElement.appendChild(status);
}
