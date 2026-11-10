import Menu from "../../../core/menu/Menu";
import CameraManager from "../../core/CameraManager";
import { mainContext } from "../../RendererSystem";
import RenderingConfig from "../../RenderingConfig";

export default function renderGrid(xOffset: number, yOffset: number) {
    if (!Menu.getValue("renderGrid")) return;

    mainContext.save();

    mainContext.lineWidth = 4;
    mainContext.strokeStyle = "#000";
    mainContext.globalAlpha = 0.06;
    mainContext.beginPath();

    if (Menu.getValue("staticGrid")) {
        const gridSpacing = RenderingConfig.baseScreenHeight / 18;
        const startX = Math.ceil(xOffset / gridSpacing) * gridSpacing;
        const startY = Math.ceil(yOffset / gridSpacing) * gridSpacing;

        for (let wx = startX; wx <= xOffset + RenderingConfig.maxScreenWidth; wx += gridSpacing) {
            const sx = wx - xOffset;
            mainContext.moveTo(sx, 0);
            mainContext.lineTo(sx, RenderingConfig.maxScreenHeight);
        }

        for (let wy = startY; wy <= yOffset + RenderingConfig.maxScreenHeight; wy += gridSpacing) {
            const sy = wy - yOffset;
            mainContext.moveTo(0, sy);
            mainContext.lineTo(RenderingConfig.maxScreenWidth, sy);
        }
    } else {
        const gridSize = RenderingConfig.maxScreenHeight / 14;

        // Start at the first visible line instead of looping up from -camX (up to ~190 wasted
        // iterations per axis per frame). Same lines as before: x = -camX + k * gridSize, x > 0.
        const firstX = ((-CameraManager.camX % gridSize) + gridSize) % gridSize || gridSize;
        const firstY = ((-CameraManager.camY % gridSize) + gridSize) % gridSize || gridSize;

        for (let x = firstX; x < RenderingConfig.maxScreenWidth; x += gridSize) {
            mainContext.moveTo(x, 0);
            mainContext.lineTo(x, RenderingConfig.maxScreenHeight);
        }

        for (let y = firstY; y < RenderingConfig.maxScreenHeight; y += gridSize) {
            mainContext.moveTo(0, y);
            mainContext.lineTo(RenderingConfig.maxScreenWidth, y);
        }
    }

    mainContext.stroke();
    mainContext.restore();
}