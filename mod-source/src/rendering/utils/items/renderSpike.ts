import GameObject from "@constants/GameObject";
import { ListItem } from "@constants/items";
import { drawCircle, drawStar } from "@rendering/shapes";

export default function renderSpike(obj: GameObject | ListItem, ctx: CanvasRenderingContext2D, bodyColor: string, innerBodyColor: string, spikeColor: string, spikes: number) {
    const tmpScale = obj.scale * .6;

    ctx.fillStyle = spikeColor;
    drawStar(ctx, spikes, 0, 0, tmpScale, obj.scale);

    ctx.fillStyle = bodyColor;
    drawCircle(0, 0, ctx, tmpScale);

    ctx.fillStyle = innerBodyColor;
    drawCircle(0, 0, ctx, tmpScale / 2, true);
}