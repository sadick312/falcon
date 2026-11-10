// "Aim With Mouse While Gathering" (Utility, default off). In normal play Falcon sends no aim of its own unless an
// attack, break or grind aims for you, so with auto-gather turned on by hand (E) the server swung in whatever
// direction was last sent. With the setting, the mouse direction is sent each tick while E-gathering is on.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const pressE = () => document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", keyCode: 69, bubbles: true }));
const mouseAt = (x: number, y: number) => document.getElementById("game-canvas")!
    .dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }));

async function play(enable: string[]) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10]);
    game.update();
    game.sent.length = 0;
    // Mouse straight below the screen centre: aim pi / 2.
    mouseAt(window.innerWidth / 2, window.innerHeight / 2 + 100);
    return game;
}

const aims = () => game!.sent.filter(p => p.type === "D").map(p => p.args[0] as number);

describe("Aim With Mouse While Gathering", () => {
    it("off (default): E-gathering sends no aim", async () => {
        await play([]);
        pressE();
        game!.update();
        game!.update();
        expect(aims()).toEqual([]);
    });

    it("on: sends the mouse direction while E-gathering, and stops when E turns it off", async () => {
        await play(["mouseAimWhileGathering"]);
        pressE();
        game!.update();
        expect(aims().length).toBe(1);
        expect(aims()[0]).toBeCloseTo(Math.PI / 2, 5);

        pressE(); // off
        game!.sent.length = 0;
        mouseAt(window.innerWidth / 2 + 100, window.innerHeight / 2);
        game!.update();
        expect(aims()).toEqual([]);
    });

    it("on: nothing without E-gathering", async () => {
        await play(["mouseAimWhileGathering"]);
        game!.update();
        expect(aims()).toEqual([]);
    });

    it("resets on death, like the server", async () => {
        await play(["mouseAimWhileGathering"]);
        pressE();
        const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
        expect(CombatController.manualGather).toBe(true);
        game!.handlers.P();
        expect(CombatController.manualGather).toBe(false);
    });
});
