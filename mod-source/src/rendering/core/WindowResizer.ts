import Menu from "@menu/Menu";
import RendererSystem, { gameCanvas, mainContext } from "../RendererSystem";
import RenderingConfig, { clampZoom, setZoom, ZOOM_DEFAULT } from "../RenderingConfig";

export default class WindowResizer {
    /** View Distance (percent) the screen is currently sized for. */
    static zoom = ZOOM_DEFAULT;
    private static saveTimer: number | null = null;

    static resize() {
        Menu.menuElement.style.left = "calc(50% - 450px)";
        Menu.menuElement.style.top = "calc(50% - 300px)";

        // Re-read so the canvas stays sharp after moving the window to a screen with other scaling.
        RendererSystem.pixelDensity = window.devicePixelRatio || 1;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        gameCanvas.width = screenWidth * RendererSystem.pixelDensity;
        gameCanvas.height = screenHeight * RendererSystem.pixelDensity;
        gameCanvas.style.width = `${screenWidth}px`;
        gameCanvas.style.height = `${screenHeight}px`;

        const scaleFillNative = Math.max(
            screenWidth / RenderingConfig.maxScreenWidth,
            screenHeight / RenderingConfig.maxScreenHeight
        ) * RendererSystem.pixelDensity;

        const transformX = (gameCanvas.width - (RenderingConfig.maxScreenWidth * scaleFillNative)) / 2;
        const transformY = (gameCanvas.height - (RenderingConfig.maxScreenHeight * scaleFillNative)) / 2;

        mainContext.setTransform(
            scaleFillNative, 0,
            0, scaleFillNative,
            transformX, transformY
        );
    }

    /**
     * Called once per frame: follows the "View Distance" setting (slider, loaded config, wheel, keys).
     * Only resizes when the value really changed, so it costs nothing on normal frames.
     */
    static syncZoom() {
        const wanted = clampZoom(Menu.getValue("viewDistance"));
        if (wanted === this.zoom) return;

        this.zoom = setZoom(wanted);
        this.resize();
    }

    /** Mouse wheel / Zoom In / Zoom Out: changes the saved View Distance by `step` percent. */
    static changeZoom(step: number) {
        const item = Menu.itemMap["viewDistance"];
        if (!item) return;

        item.status = clampZoom(this.zoom + step);
        this.syncZoom();
        this.saveSoon();
    }

    /** Reset Zoom: back to the default View Distance (125%). */
    static resetZoom() {
        const item = Menu.itemMap["viewDistance"];
        if (item) item.status = ZOOM_DEFAULT;
        this.syncZoom();
        this.saveSoon();
    }

    /** Wheel events come many per second; save once after scrolling stops. */
    private static saveSoon() {
        if (this.saveTimer !== null) clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => {
            this.saveTimer = null;
            Menu.saveSettings();
        }, 400);
    }

    static init() {
        window.addEventListener("resize", () => this.resize());
        setZoom(this.zoom);
        this.syncZoom();
        this.resize();
    }
}
