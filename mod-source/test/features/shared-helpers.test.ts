// Features #74 Game data, #75 Geometry and angles, #76 Small helpers. Items, weapons, hats and accessories were
// compared with 1.8.2 in Step 0.5; geometry, text and storage helpers have tests in test/utils. This pins the one
// helper that must behave exactly like the game: lineInRect (projectile hits, line of sight, turret shots).
import { describe, expect, it } from "vitest";
import lineInRect from "@utils/geometry/lineInRect";

/** 1.8.2's lineInRect (game.js `Jo`), as written there. */
function gameLineInRect(e: number, t: number, i: number, s: number, n: number, a: number, o: number, d: number) {
    let l = n, c = o;
    if (n > o) { l = o; c = n; }
    if (c > i) c = i;
    if (l < e) l = e;
    if (l > c) return false;
    let m = a, g = d;
    const h = o - n;
    if (Math.abs(h) > 1e-7) {
        const u = (d - a) / h, p = a - u * n;
        m = u * l + p;
        g = u * c + p;
    }
    if (m > g) { const u = g; g = m; m = u; }
    if (g > s) g = s;
    if (m < t) m = t;
    return !(m > g);
}

describe("Shared helpers", () => {
    it("lineInRect agrees with 1.8.2 on 2000 random segments", () => {
        let seed = 7;
        const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 400 - 200;
        for (let k = 0; k < 2000; k++) {
            const x = rand(), y = rand(), w = Math.abs(rand()) / 2, h = Math.abs(rand()) / 2;
            const args = [x, y, x + w, y + h, rand(), rand(), rand(), rand()] as const;
            expect(lineInRect(...args), JSON.stringify(args)).toBe(gameLineInRect(...args));
        }
    });

    it("lineInRect handles vertical segments", () => {
        expect(lineInRect(0, 0, 10, 10, 5, -5, 5, 20)).toBe(true);
        expect(lineInRect(0, 0, 10, 10, 15, -5, 15, 20)).toBe(false);
    });
});
