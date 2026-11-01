// Feature #54, Chat commands (ChatCommands): "!" commands (!help, !clear, !plog / !pl, !ping, !packets, !shame) run
// locally and are never sent; their reply shows in the chat log and over our head. "/" commands are moomodding.io
// server commands and go to the server as typed. Typing "!" or "/" lists matching commands.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    const { default: ChatCommands } = await import("@core/utils/ChatCommands");
    return ChatCommands;
}

describe("Chat commands", () => {
    it("runs ! commands locally and replies over our head", async () => {
        const ChatCommands = await setUp();
        game!.Client.player.shameCount = 3;
        expect(ChatCommands.run("!shame")).toBe(true);
        expect(game!.Client.player.chatMessages[0].msg).toBe("Shame 3/8");
        expect(ChatCommands.run("!PING")).toBe(true);
    });

    it("leaves normal chat, / commands and unknown ! words to be sent", async () => {
        const ChatCommands = await setUp();
        expect(ChatCommands.run("hello")).toBe(false);
        expect(ChatCommands.run("/bot")).toBe(false);
        expect(ChatCommands.run("!nope")).toBe(false);
    });

    it("doesn't treat JavaScript built-in names as commands", async () => {
        // "!constructor" used to find Object's constructor and throw calling `.run` on it.
        const ChatCommands = await setUp();
        expect(() => ChatCommands.run("!constructor")).not.toThrow();
        expect(ChatCommands.run("!constructor")).toBe(false);
        expect(ChatCommands.run("!toString")).toBe(false);
    });

    it("suggests matching commands", async () => {
        const ChatCommands = await setUp();
        expect(ChatCommands.suggest("!p").map(([c]) => c)).toEqual(["!plog", "!pl", "!ping", "!packets"]);
        expect(ChatCommands.suggest("/f").map(([c]) => c)).toEqual(["/fight"]);
        expect(ChatCommands.suggest("hi")).toEqual([]);
    });
});
