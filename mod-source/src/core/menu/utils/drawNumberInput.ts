import Menu, { IMenuItem } from "@menu/Menu";
import drawItemBody from "@menu/utils/drawItemBody";
import drawItemLabel from "@menu/utils/drawItemLabel";
import drawResetButton from "@menu/utils/drawResetButton";
import { keepEnterInInput } from "@menu/utils/keyboard";

export default function drawNumberInput(item: IMenuItem, contentElement: HTMLElement) {
    const isInDropdownContent = contentElement !== Menu.contentElement;

    const body = drawItemBody();
    body.style.pointerEvents = "none";

    const iconHolderElem = document.createElement("div");

    if (item.icon) {
        iconHolderElem.classList.add("menuItemIconHolder");
        iconHolderElem.innerHTML = `
            ${item.icon.replace(/REPLACE_WITH_COLOR/g, `var(--generic-white-2)`)}
        `;

        body.appendChild(iconHolderElem);
    }

    drawItemLabel(item, body, isInDropdownContent);

    const input = document.createElement("input");
    input.type = "number";
    input.classList.add("menuNumberInput");
    input.value = item.status as string;
    input.setAttribute("aria-label", item.label);
    keepEnterInInput(input);
    drawResetButton(item, body);
    body.appendChild(input);

    if (typeof item.min === "number") input.min = String(item.min);
    if (typeof item.step === "number") input.step = String(item.step);
    if (typeof item.max === "number") input.max = String(item.max);

    input.addEventListener("input", () => {
        item.status = input.value;
        Menu.saveSettings();
        item.refreshReset?.();
    });

    contentElement.appendChild(body);
}