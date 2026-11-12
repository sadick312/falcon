/** View Distance limits, in percent of the normal game's 1920x1080 view. */
export const ZOOM_MIN = 75;
export const ZOOM_MAX = 250;
/** Falcon has always started at 125% (a little wider than the normal game). */
export const ZOOM_DEFAULT = 125;
/** One mouse-wheel notch or one Zoom In/Out key press. */
export const ZOOM_STEP = 5;

const RenderingConfig = {
    maxScreenWidth: 1920 * ZOOM_DEFAULT / 100,
    maxScreenHeight: 1080 * ZOOM_DEFAULT / 100,

    baseScreenWidth: 1920,
    baseScreenHeight: 1080,
    iconPadding: 15,
    iconPad: 0.9,
    skinColors: [
        "#bf8f54", "#cbb091", "#896c4b",
        "#fadadc", "#ececec", "#c37373",
        "#4c4c4c", "#ecaff7", "#738cc3",
        "#8bc373", "#91b2db"
    ]
};

/** Turns any saved/typed value into a whole percent inside the limits (bad values -> default). */
export function clampZoom(value: unknown): number {
    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (!Number.isFinite(num)) return ZOOM_DEFAULT;
    return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, num)));
}

/** Sets the view size for a View Distance percent. Returns the percent actually used. */
export function setZoom(value: unknown): number {
    const percent = clampZoom(value);
    RenderingConfig.maxScreenWidth = RenderingConfig.baseScreenWidth * percent / 100;
    RenderingConfig.maxScreenHeight = RenderingConfig.baseScreenHeight * percent / 100;
    return percent;
}

export default RenderingConfig;
