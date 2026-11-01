// Feature #64, Input (Hook): WASD / arrow keys set our movement direction, number keys select a weapon or item, chat
// opens with Enter (history with the arrow keys, Tab completes commands; normal chat is capped at 30 characters), Z
// toggles Auto Mill, T One Tick's tap mode, R auto insta, E auto gather; the mouse wheel zooms.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

function key(type: "keydown" | "keyup", code: string, keyCode: number) {
    const event = new KeyboardEvent(type, { code, key: code });
    Object.defineProperty(event, "keyCode", { value: keyCode });
    document.dispatchEvent(event);
}

async function setUp() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5, 10], [0, 3, 6, 10, 15]);
    await import("@ui/Hook");
}

describe("Input", () => {
    it("moves with WASD and stops when the keys are released", async () => {
        await setUp();
        key("keydown", "KeyD", 68);
        expect(game!.Client.lastMoveDir).toBe(0);
        key("keydown", "KeyS", 83);
        expect(game!.Client.lastMoveDir).toBeCloseTo(Math.PI / 4, 2);
        key("keyup", "KeyD", 68);
        key("keyup", "KeyS", 83);
        expect(game!.Client.lastMoveDir).toBeNull();
    });

    it("stops moving when the window loses focus", async () => {
        // The keyup never arrives after alt-tabbing out; the direction used to stay, so we kept walking.
        await setUp();
        key("keydown", "KeyW", 87);
        expect(game!.Client.lastMoveDir).not.toBeNull();
        window.dispatchEvent(new Event("blur"));
        expect(game!.Client.lastMoveDir).toBeNull();
    });

    it("selects the weapon on a number key", async () => {
        await setUp();
        const before = game!.sent.length;
        key("keydown", "Digit2", 50);
        expect(game!.sent.slice(before).filter(p => p.type === "z").map(p => p.args)).toEqual([[10, true]]);
    });
});
