import GameObject from "@constants/GameObject";
import { drawPolygon, drawStar } from "@rendering/shapes";

export default function renderStone(obj: GameObject, ctx: CanvasRenderingContext2D, bodyColor: string, innerBodyColor: string) {
    ctx.fillStyle = bodyColor;
    drawPolygon(ctx, 6, 0, 0, obj.scale);

    ctx.fillStyle = innerBodyColor;
    drawStar(ctx, 3, 0, 0, obj.scale * .55, obj.scale * .65, false, true);
}