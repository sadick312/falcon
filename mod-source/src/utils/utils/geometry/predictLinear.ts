import { Point } from "@mod-types/index";

/**
 * Linear prediction: where something at `current` (which was at `previous` one server tick ago)
 * will be after `ms`, if it keeps the same velocity. `ms` is capped at `maxMs` to avoid wild guesses.
 */
export default function predictLinear(current: Point, previous: Point, ms: number, tickMs: number, out: Point, maxMs = 600): Point {
    const ticks = Math.min(Math.max(ms, 0), maxMs) / tickMs;
    out.x = current.x + (current.x - previous.x) * ticks;
    out.y = current.y + (current.y - previous.y) * ticks;
    return out;
}
