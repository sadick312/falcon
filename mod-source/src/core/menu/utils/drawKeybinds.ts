import Keybinds, { KEYBIND_ACTIONS } from "@core/Keybinds";
import Menu from "../Menu";
import drawItemBody from "./drawItemBody";
import drawItemLabel from "./drawItemLabel";

/**
 * Keybinds tab: one row per action, grouped by category. Click the key button, then press a key
 * or mouse button. Esc cancels, Backspace/Delete unbinds. Keys used by two actions show in red.
 */
export default function drawKeybinds() {
    const content = Menu.contentElement;

    const intro = drawItemBody();
    drawItemLabel({
        label: "Keybinds",
        id: "",
        type: "paragraph",
        description: "Click a key, then press the new key or mouse button. Esc cancels, Backspace removes the key (turns that action off). Movement (WASD/arrows), hotbar (1-9) and the menu (Esc) are fixed."
    }, intro);

    const resetBtn = document.createElement("div");
    resetBtn.classList.add("keybindButton");
    resetBtn.innerText = "Reset all";
    resetBtn.style.minWidth = "90px";
    resetBtn.onclick = () => {
        Keybinds.resetAll();
        rerender();
    };
    intro.appendChild(resetBtn);
    content.appendChild(intro);

    for (const category of ["Combat", "Placement", "Utility"] as const) {
        const header = document.createElement("div");
        header.classList.add("keybindCategory");
        header.innerText = category;
        content.appendChild(header);

        for (const action of KEYBIND_ACTIONS.filter(a => a.category === category)) {
            const row = drawItemBody();
            drawItemLabel({ label: `${action.label}${action.mode === "hold" ? " (hold)" : ""}`, id: action.id, type: "paragraph", description: action.description }, row);

            const button = document.createElement("div");
            button.classList.add("keybindButton");
            const conflicts = Keybinds.conflictsWith(action.id);
            button.innerText = Keybinds.describe(Keybinds.get(action.id));
            if (conflicts.length) {
                button.classList.add("keybindConflict");
                button.title = "Also used by: " + conflicts.map(id => KEYBIND_ACTIONS.find(a => a.id === id)?.label).join(", ");
            }

            button.onclick = (clickEvent) => {
                clickEvent.stopPropagation();
                startCapture(action.id, button);
            };

            row.appendChild(button);
            content.appendChild(row);
        }
    }
}

function rerender() {
    Menu.contentElement.innerHTML = "";
    drawKeybinds();
}

function startCapture(id: string, button: HTMLDivElement) {
    if (Keybinds.isCapturing) return;
    Keybinds.isCapturing = true;
    button.innerText = "Press a key...";
    button.classList.add("keybindCapturing");

    const finish = (binding: string | null) => {
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("keyup", onKeyUp, true);
        document.removeEventListener("mousedown", onMouse, true);
        // Let this event finish before actions can fire again (so the new key doesn't trigger now).
        setTimeout(() => { Keybinds.isCapturing = false; }, 0);
        if (binding !== null) Keybinds.set(id, binding);
        rerender();
    };

    const onKey = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.code === "Escape") return finish(null);
        if (event.code === "Backspace" || event.code === "Delete") return finish("");
        // Shift alone: wait. Another key while Shift is held binds "Shift + key";
        // releasing Shift without another key binds Shift itself (see onKeyUp).
        if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
            pendingShift = event.code;
            return;
        }
        finish(Keybinds.fromKeyEvent(event));
    };

    let pendingShift: string | null = null;
    const onKeyUp = (event: KeyboardEvent) => {
        if (pendingShift && event.code === pendingShift) finish(pendingShift);
    };

    const onMouse = (event: MouseEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        finish(`Mouse${event.button}`);
    };

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKeyUp, true);
    // Mouse binding starts on the next press, not the click that opened capture mode.
    setTimeout(() => document.addEventListener("mousedown", onMouse, true), 0);
}
