// Basic shapes used by the item renderers (rendering/utils/items) and RendererUtils. Kept apart from RendererUtils so
// the item renderers don't import RendererUtils back (its item table imports them). Moved unchanged.

export function drawCircle(x: number, y: number, mainContext: CanvasRenderingContext2D, radius: number, dontStroke?: boolean, dontFill?: boolean) {
    mainContext.beginPath();
    mainContext.arc(x, y, radius, 0, Math.PI * 2);

    if (!dontFill) mainContext.fill();
    if (!dontStroke) mainContext.stroke();
}

export function drawPolygon(ctx: CanvasRenderingContext2D, sides: number, centerX: number, centerY: number, radius: number, dontFill?: boolean, dontStroke?: boolean) {
    if (sides < 3) {
        throw new Error("Polygon must have at least 3 sides");
    }

    const angleStep = (2 * Math.PI) / sides;

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const x = centerX + radius * Math.cos(i * angleStep - Math.PI / 2);
        const y = centerY + radius * Math.sin(i * angleStep - Math.PI / 2);

        if (i == 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.closePath();

    if (!dontFill) ctx.fill();
    if (!dontStroke) ctx.stroke();
}

export function drawStar(mainContext: CanvasRenderingContext2D, points: number, centerX: number, centerY: number, innerRadius: number, outerRadius: number, dontFill?: boolean, dontStroke?: boolean) {
    if (points < 2) {
        throw new Error("Star must have at least 2 points");
    }

    const step = Math.PI / points;

    mainContext.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 == 0 ? outerRadius : innerRadius;
        const angle = i * step - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        if (i == 0) {
            mainContext.moveTo(x, y);
        } else {
            mainContext.lineTo(x, y);
        }
    }

    mainContext.closePath();

    if (!dontFill) mainContext.fill();
    if (!dontStroke) mainContext.stroke();
}

export function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, stroke = true) {
    const left = x - width / 2;
    const top = y - height / 2;

    ctx.fillRect(left, top, width, height);
    if (stroke) ctx.strokeRect(left, top, width, height);
}

export function drawCircleRect(ctx: CanvasRenderingContext2D, x: number, y: number, rectWidth: number, rectHeight: number, segments: number, stroke = true) {
    ctx.save();
    ctx.translate(x, y);

    const halfSegs = Math.ceil(segments / 2);
    const angleStep = Math.PI / halfSegs;

    for (let i = 0; i < halfSegs; i++) {
        drawRect(ctx, 0, 0, rectWidth * 2, rectHeight, stroke);
        ctx.rotate(angleStep);
    }

    ctx.restore();
}
