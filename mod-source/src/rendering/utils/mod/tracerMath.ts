/**
 * Where to draw an edge arrow for something off screen: the point where the line from the screen
 * centre (cx, cy) toward (tx, ty) leaves the screen, moved `margin` px inside. Returns [x, y, angle].
 */
export function edgeArrowPoint(cx: number, cy: number, tx: number, ty: number, w: number, h: number, margin: number): [number, number, number] {
    const dx = tx - cx;
    const dy = ty - cy;
    const angle = Math.atan2(dy, dx);

    // How far along the line we can go before hitting the inner (margin) box on each axis.
    const halfW = Math.max(1, w / 2 - margin);
    const halfH = Math.max(1, h / 2 - margin);
    const sx = dx === 0 ? Infinity : halfW / Math.abs(dx);
    const sy = dy === 0 ? Infinity : halfH / Math.abs(dy);
    const s = Math.min(sx, sy);

    return [cx + dx * s, cy + dy * s, angle];
}
