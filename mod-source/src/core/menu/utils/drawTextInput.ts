import Menu, { IMenuItem } from "@menu/Menu";
import drawItemBody from "@menu/utils/drawItemBody";
import drawItemLabel from "@menu/utils/drawItemLabel";

/** A one-line text box in the menu (e.g. a quick chat message). `max` = max length. */
export default function drawTextInput(item: IMenuItem, contentElement: HTMLElement) {
    const isInDropdownContent = contentElement !== Menu.contentElement;

    const body = drawItemBody(item);
    body.style.pointerEvents = "none";

    drawItemLabel(item, body, isInDropdownContent);

    const input = document.createElement("input");
    input.type = "text";
    input.classList.add("menuNumberInput");
    input.style.pointerEvents = "auto";
    input.style.width = "150px";
    input.value = String(item.status ?? "");
    if (typeof item.max === "number") input.maxLength = item.max;
    body.appendChild(input);

    input.addEventListener("input", () => {
        item.status = input.value;
        Menu.saveSettings();
    });

    contentElement.appendChild(body);
}
