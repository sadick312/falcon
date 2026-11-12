const ICON_STYLE = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;border-radius:4px";

/**
 * Puts a drawn hotbar icon into its slot. A picture from moomoo.io ("Original MooMoo Artwork";
 * another website without a CORS header) makes the canvas unreadable, so toDataURL throws; then
 * the canvas itself is shown in the slot, which looks the same.
 */
export function showHotbarIcon(slot: HTMLElement, iconCanvas: HTMLCanvasElement) {
    try {
        slot.style.backgroundImage = `url('${iconCanvas.toDataURL()}')`;
    } catch {
        iconCanvas.classList.add("hotbar-icon");
        iconCanvas.style.cssText = ICON_STYLE;
        slot.prepend(iconCanvas);
    }
}

/** Copies a hotbar slot's icon to another element (the upgrade bar shows the same pictures). */
export function copyHotbarIcon(from: HTMLElement, to: HTMLElement) {
    if (from.style.backgroundImage) {
        to.style.backgroundImage = from.style.backgroundImage;
        return;
    }

    const source = from.querySelector<HTMLCanvasElement>("canvas.hotbar-icon");
    if (!source) return;

    // Drawing an unreadable canvas onto another canvas is allowed; only reading pixels back is not.
    const copy = document.createElement("canvas");
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext("2d")?.drawImage(source, 0, 0);
    copy.classList.add("hotbar-icon");
    copy.style.cssText = ICON_STYLE;
    to.style.position = "relative";
    to.prepend(copy);
}
