import type { IMenuItem } from "@menu/Menu";
import drawItemBody from "./drawItemBody";

export default function drawMenuParagraph(item: IMenuItem, contentElement: HTMLElement) {
    const body = drawItemBody();
    body.style.pointerEvents = "none";
    body.style.color = "var(--generic-white)";
    body.style.fontSize = "13px";
    body.innerHTML = item.description || "";
    contentElement.appendChild(body);
}