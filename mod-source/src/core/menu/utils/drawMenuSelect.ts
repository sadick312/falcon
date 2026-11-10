import type Menu from "@menu/Menu";
import type { IMenuItem } from "@menu/Menu";
import drawItemBody from "./drawItemBody";
import drawItemLabel from "./drawItemLabel";

export default function drawMenuSelect(item: IMenuItem, contentElement: HTMLElement, menu: typeof Menu) {
    if (!item.options) return;
    const isInDropdownContent = contentElement !== menu.contentElement;

    const body = drawItemBody();
    body.style.pointerEvents = "none";

    const iconHolderElem = document.createElement("div");
    if (item.icon) {
        iconHolderElem.classList.add("menuItemIconHolder");
        if (item.status) iconHolderElem.classList.add("activeMenuItem");

        iconHolderElem.innerHTML = `
            ${item.icon.replace(/REPLACE_WITH_COLOR/g, `var(${item.status ? "--theme-primary" : "--generic-white-2"})`)}
        `;

        body.appendChild(iconHolderElem);
    }

    drawItemLabel(item, body, isInDropdownContent);

    const selector = document.createElement("select");
    selector.id = JSON.stringify(item);
    selector.classList.add("menuSelector");

    for (const option of item.options) {
        const elem = document.createElement("option");
        elem.innerText = option.label;
        elem.value = option.value as string;
        elem.selected = String(item.status) === String(option.value);

        selector.appendChild(elem);
    }

    selector.setAttribute("aria-label", item.label);
    body.appendChild(selector);
    selector.onchange = (ev) => {
        if (ev.target === selector) {
            item.status = selector.value;
            menu.saveSettings();
        }
    }

    contentElement.appendChild(body);
}