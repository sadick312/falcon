import Menu from "@menu/Menu";
import RenderingConfig from "@rendering/RenderingConfig";

/** "View Distance" and "Limit Wheel Zoom" bounds, in % of the base 1920 × 1080 view. */
const VIEW_MIN = 75;
const VIEW_MAX = 250;

/** The "View Distance" setting in %, 100 (the classic view) when it isn't a number. */
export function viewPercent() {
    const value = Number(Menu.getValue("viewDistance"));
    if (!Number.isFinite(value)) return 100;
    return Math.min(VIEW_MAX, Math.max(VIEW_MIN, value));
}

/** The current view size in % of the base view. */
export function currentViewPercent() {
    return RenderingConfig.maxScreenWidth / RenderingConfig.baseScreenWidth * 100;
}

export function setViewPercent(percent: number) {
    RenderingConfig.maxScreenWidth = RenderingConfig.baseScreenWidth * percent / 100;
    RenderingConfig.maxScreenHeight = RenderingConfig.baseScreenHeight * percent / 100;
}

/** The view after one mouse-wheel step (5%), kept within VIEW_MIN-VIEW_MAX only with "Limit Wheel Zoom" on. */
export function wheelZoom(zoomOut: boolean) {
    if (zoomOut) {
        RenderingConfig.maxScreenWidth /= 0.95;
        RenderingConfig.maxScreenHeight /= 0.95;
    } else {
        RenderingConfig.maxScreenWidth *= 0.95;
        RenderingConfig.maxScreenHeight *= 0.95;
    }

    if (Menu.getValue("limitWheelZoom") !== true) return;
    const percent = currentViewPercent();
    if (percent > VIEW_MAX) setViewPercent(VIEW_MAX);
    else if (percent < VIEW_MIN) setViewPercent(VIEW_MIN);
}

let appliedPercent = NaN;

/**
 * Called every frame: when the "View Distance" slider was moved, the view jumps to it (true: the caller resizes).
 * The first call only remembers the value; connecting (and the reset key) set the view to it.
 */
export function applyViewDistanceChange() {
    const percent = viewPercent();
    if (percent === appliedPercent) return false;
    const first = Number.isNaN(appliedPercent);
    appliedPercent = percent;
    if (first) return false;
    setViewPercent(percent);
    return true;
}
