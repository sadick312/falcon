import type Menu from "@menu/Menu";
import type { IMenuItem } from "@menu/Menu";
import drawItemBody from "./drawItemBody";
import drawItemLabel from "./drawItemLabel";
import drawResetButton from "./drawResetButton";

export default function drawMenuSlider(item: IMenuItem, contentElement: HTMLElement, menu: typeof Menu) {
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

    drawItemLabel(item, body, contentElement !== menu.contentElement);

    const slider = document.createElement("input");
    slider.classList.add("menuSlider");
    slider.id = JSON.stringify(item);
    slider.type = "range";

    if (typeof item.min === "number") slider.min = String(item.min);
    if (typeof item.step === "number") slider.step = String(item.step);
    if (typeof item.max === "number") slider.max = String(item.max);

    slider.value = item.status as string;
    slider.setAttribute("aria-label", item.label);
    drawResetButton(item, body, menu);
    body.appendChild(slider);

    const sliderDisplay = document.createElement("div");
    sliderDisplay.style = "color: var(--theme-primary); font-size: 16px; width: 50px; margin-left: 10px; text-align: right;";
    body.appendChild(sliderDisplay);

    sliderDisplay.innerText = (item.status as string) || "0";

    slider.addEventListener("input", () => {
        item.status = slider.value;
        sliderDisplay.innerText = item.status as string;
        menu.saveSettings();
        item.refreshReset?.();
    });

    contentElement.appendChild(body);
}