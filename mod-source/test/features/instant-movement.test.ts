// 1E, "Send Movement Instantly" (default off): a movement key normally only sets Client.lastMoveDir, and the MOVE
// packet goes out with the next server tick (MovementManager.main), 0-111 ms later. With the toggle on it goes out
// at the key press, as long as the keys are what steers us, Safe Walk allows it, and the packet budget has room.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const W = 87;
const D = 68;
const TOGGLE = "sendMovementInstantly";

async function playing(enable: string[] = []) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10]);
    game.update();
    game.update();
    // The helper replays; instant sending is for live play only (a replay's ticks come from the recording).
    game.Client.mode = "normal";
    game.sent.length = 0;
    return game;
}

const press = (keyCode: number) => document.dispatchEvent(new KeyboardEvent("keydown", { keyCode, bubbles: true }));
const release = (keyCode: number) => document.dispatchEvent(new KeyboardEvent("keyup", { keyCode, bubbles: true }));
const moves = () => game!.sent.filter(p => p.type === "9");

describe("Send Movement Instantly", () => {
    it("off (default): a key press is only sent with the next tick", async () => {
        await playing();
        press(D);
        expect(moves()).toHaveLength(0);

        game!.update();
        expect(moves().map(m => m.args[0])).toEqual([0]);
    });

    it("on: sends the new direction at the key press, and the next tick doesn't send it again", async () => {
        await playing([TOGGLE]);
        press(D);
        expect(moves().map(m => m.args[0])).toEqual([0]);
        const sentAt = moves()[0]!.tick;

        game!.update();
        game!.update();
        expect(moves()).toHaveLength(1);
        expect(sentAt).toBe(game!.tick - 2); // between ticks, before the tick that would have sent it
    });

    it("on: a second key turns the direction at once, and releasing everything stops at once", async () => {
        await playing([TOGGLE]);
        press(D);
        press(W);
        expect(moves().map(m => m.args[0])).toEqual([0, -0.79]);

        release(D);
        release(W);
        // Releasing D first leaves W (straight up), then nothing held: stop.
        expect(moves().map(m => m.args[0])).toEqual([0, -0.79, -1.57, null]);
    });

    it("on: holding a key sends it once, not on every key repeat", async () => {
        await playing([TOGGLE]);
        for (let i = 0; i < 10; i++) press(D);
        expect(moves()).toHaveLength(1);
    });

    it("on: leaves movement to a module that steers this tick (auto push), sending nothing early", async () => {
        await playing([TOGGLE]);
        const { default: AutoPusher } = await import("@core/mod/combat/core/AutoPusher");
        AutoPusher.autoPushing = true;
        AutoPusher.moveDir = 2;
        press(D);
        expect(moves()).toHaveLength(0);
        AutoPusher.autoPushing = false;
    });

    it("on: waits for the next tick as before when the packet budget has no room", async () => {
        await playing([TOGGLE]);
        const { default: PacketTracker } = await import("@core/utils/PacketTracker");
        const request = vi.spyOn(PacketTracker, "request").mockReturnValue(0);
        press(D);
        expect(request).toHaveBeenCalledWith("MOVE", 1);
        expect(moves()).toHaveLength(0);

        request.mockRestore();
        game!.update();
        expect(moves().map(m => m.args[0])).toEqual([0]);
    });

    for (const safeWalk of [true, false]) it(`on: ${safeWalk ? "Safe Walk still stops us instead of walking into a spike" : "without Safe Walk the same press walks straight in"}`, async () => {
        game = await startGame({ enable: safeWalk ? [TOGGLE, "safeWalk"] : [TOGGLE] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.setLoadout([5], [0, 3, 6, 10]);
        game.spawn({ sid: 2, x: 1600, y: 1000 });
        const { LIST_ID_MAP } = await import("@constants/items");
        game.addObjects([{ sid: 500, x: 1075, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: 2 }]);
        game.update();
        game.update();
        game.Client.mode = "normal";
        game.sent.length = 0;

        press(D); // straight into the enemy's spike
        // Safe Walk turns the step into a stop (null); without it, the step goes out as pressed.
        expect(moves().map(m => m.args[0]).filter(dir => dir !== null)).toEqual(safeWalk ? [] : [0]);
    });

    it("on: sends nothing while dead or watching a replay", async () => {
        await playing([TOGGLE]);
        game!.Client.mode = "replay";
        press(D);
        expect(moves()).toHaveLength(0);
    });
});
