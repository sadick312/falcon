import GameObject from "@constants/GameObject";
import { ListItem } from "@constants/items";
import randInt from "@utils/random/randInt";
import { drawCircle } from "@rendering/shapes";

export default function renderDottedCircle(obj: GameObject | ListItem, ctx: CanvasRenderingContext2D, bodyColor: string, dotColor: string) {
    const chips = 4;
    const rotVal = Math.PI * 2 / chips;

    ctx.fillStyle = bodyColor;
    drawCircle(0, 0, ctx, obj.scale);

    ctx.fillStyle = dotColor;

    for (let i = 0; i < chips; ++i) {
        const tmpRange = randInt(obj.scale / 2.5, obj.scale / 1.7);

        drawCircle(
            tmpRange * Math.cos(rotVal * i),
            tmpRange * Math.sin(rotVal * i),
            ctx,
            randInt(4, 5),
            true
        );
    }
}