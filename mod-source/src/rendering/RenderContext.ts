import getElem from "@utils/dom/getElem";

/**
 * The game canvas and its 2D context, shared by RendererSystem and every render* function. They live here rather than in
 * RendererSystem so the render functions don't import RendererSystem back (it imports all of them).
 */
export const gameCanvas = getElem<"canvas">("game-canvas");
export const mainContext = gameCanvas.getContext("2d")!;

/** Canvas pixels per CSS pixel; fixed when the page loads. */
export const pixelDensity = window.devicePixelRatio || 1;
