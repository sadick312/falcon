/**
 * Names are drawn once into a small offscreen canvas and then stamped with drawImage each frame.
 * Thick outlined text (strokeText with round joins) was the most expensive thing Falcon drew.
 * Sprites are rendered at 2x so they stay sharp when zoomed in.
 */
interface NameSprite {
    canvas: HTMLCanvasElement;
    /** Width of the text itself (for placing the crown/skull icons), in game units. */
    textWidth: number;
    width: number;
    height: number;
}

const RESOLUTION = 2;
const MAX_ENTRIES = 300; // names come and go; cap the cache so it can't grow forever

export default class NameSpriteCache {
    private static cache = new Map<string, NameSprite>();
    private static measureCtx = document.createElement("canvas").getContext("2d")!;

    static get(text: string, fontSize: number, lineWidth: number, color = "#ffffff", outline = "#3d3f42"): NameSprite {
        const key = `${fontSize}|${lineWidth}|${color}|${outline}|${text}`;
        const cached = this.cache.get(key);
        if (cached) return cached;

        if (this.cache.size >= MAX_ENTRIES) this.cache.clear();

        const font = `${fontSize}px Hammersmith One`;
        this.measureCtx.font = font;
        const textWidth = this.measureCtx.measureText(text).width;

        const width = Math.ceil(textWidth + lineWidth * 2 + 4);
        const height = Math.ceil(fontSize * 1.5 + lineWidth * 2);

        const canvas = document.createElement("canvas");
        canvas.width = width * RESOLUTION;
        canvas.height = height * RESOLUTION;

        const ctx = canvas.getContext("2d")!;
        ctx.scale(RESOLUTION, RESOLUTION);
        ctx.font = font;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.lineJoin = "round";
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = outline;
        ctx.fillStyle = color;
        ctx.strokeText(text, width / 2, height / 2);
        ctx.fillText(text, width / 2, height / 2);

        const sprite = { canvas, textWidth, width, height };
        this.cache.set(key, sprite);
        return sprite;
    }

    /** Draws outlined text centred on (x, y) using a cached sprite. */
    static draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number, lineWidth: number, color: string, outline: string) {
        const sprite = this.get(text, fontSize, lineWidth, color, outline);
        ctx.drawImage(sprite.canvas, x - sprite.width / 2, y - sprite.height / 2, sprite.width, sprite.height);
        return sprite;
    }

    /** Fonts load asynchronously; drop sprites drawn with the fallback font once the real one is ready. */
    static clear() {
        this.cache.clear();
    }
}

if (document.fonts) {
    document.fonts.ready.then(() => NameSpriteCache.clear()).catch(() => { });
    document.fonts.addEventListener?.("loadingdone", () => NameSpriteCache.clear());
}
