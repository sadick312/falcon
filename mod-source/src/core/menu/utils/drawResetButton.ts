import type Menu from "@menu/Menu";
import type { IMenuItem } from "@menu/Menu";
import { makeKeyboardClickable } from "./keyboard";

/**
 * A small "reset to default" button for one setting. It's only visible while the setting differs from its
 * default; the draw function calls item.refreshReset after every change so it appears and hides right away.
 */
export default function drawResetButton(item: IMenuItem, container: HTMLElement, menu: typeof Menu) {
    if (!menu.canReset(item)) return;

    const button = document.createElement("div");
    button.classList.add("menuItemSettings", "menuResetButton");
    button.innerHTML = `<span class="material-icons menuSettingsIcon" style="font-size: 16px;">restart_alt</span>`;
    button.title = `Reset to default (${menu.describeDefault(item)})`;
    makeKeyboardClickable(button, `Reset ${item.label} to default`);

    const refresh = () => {
        button.style.display = menu.isChanged(item) ? "" : "none";
    };

    button.onclick = (ev) => {
        ev.stopPropagation();
        menu.resetToDefault(item);
    };

    item.refreshReset = refresh;
    refresh();
    container.appendChild(button);
}
