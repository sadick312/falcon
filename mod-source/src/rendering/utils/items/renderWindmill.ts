import GameObject from "@constants/GameObject";
import { ListItem } from "@constants/items";
import { drawCircle, drawCircleRect } from "@rendering/shapes";

export default function renderWindmill(obj: GameObject | ListItem, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#a5974c";
    drawCircle(0, 0, ctx, obj.scale);

    ctx.fillStyle = "#c9b758";
    drawCircleRect(ctx, 0, 0, obj.scale * 1.5, 29, 4);

    ctx.fillStyle = "#a5974c";
    drawCircle(0, 0, ctx, obj.scale * .5);
}