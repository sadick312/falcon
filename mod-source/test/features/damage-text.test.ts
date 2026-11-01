// Feature #44, Damage text (TextManager): floating numbers over players (damage white, healing green, type -1 red) and
// short labels (strings, e.g. One Tick "Active"/"Passive"). Numbers rise, pop up to 1.25× then settle, and fade over
// their last 375 ms of a 1250 ms life; the renderer deletes them when their life runs out.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

describe("Damage text", () => {
    it("rises and fades out over its life", async () => {
        game = await startGame();
        const { default: TextManager } = await import("@core/logic/TextManager");
        TextManager.texts.clear();
        TextManager.add(100, 200, 25, 0);
        const text = [...TextManager.texts.values()][0];

        text.update(500);
        expect(text.y).toBeCloseTo(200 - 500 * TextManager.TEXT_SPEED);
        expect(text.alpha).toBe(1);

        text.update(500); // 1000 ms: 250 left, inside the 375 ms fade
        expect(text.alpha).toBeLessThan(1);
        text.update(250);
        expect(text.life).toBeLessThanOrEqual(0);
        expect(text.alpha).toBe(0);
    });

    it("keeps labels in place", async () => {
        game = await startGame();
        const { default: TextManager } = await import("@core/logic/TextManager");
        TextManager.texts.clear();
        TextManager.add(100, 200, "Active", 0);
        const text = [...TextManager.texts.values()][0];
        text.update(500);
        expect(text.y).toBe(200);
    });
});
