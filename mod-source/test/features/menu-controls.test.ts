// Features #61 Menu controls (toggle, slider, select, number, group, paragraph, label, body) and #62 Chat log
// (drawChatLog): a toggle click flips its setting, saves it and runs its update hook; the chat log shows the last 500
// entries as text, adding one row at a time while the console tab is open.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

describe("Menu controls", () => {
    it("flip and save a toggle on click", async () => {
        game = await startGame({ enable: ["autoSaveSettings"] });
        const { default: Menu, menuContent } = await import("@menu/Menu");
        const item = menuContent.combat.find(i => i.type === "toggle" && i.id)!;
        const container = document.createElement("div");
        Menu.renderItems([item], container);
        const before = !!item.status;
        container.querySelector<HTMLElement>(".menuToggle .menuToggle")!.click();
        expect(Menu.getValue(item.id)).toBe(!before);
        expect(JSON.parse(localStorage.getItem("falcon-settings")!)[item.id]).toBe(!before);
    });
});

describe("Chat log", () => {
    it("keeps the last 500 entries, as text", async () => {
        game = await startGame();
        const { default: Menu, ChatLog } = await import("@menu/Menu");
        const { addChatLog } = await import("@menu/utils/drawChatLog");
        Menu.chatLogs.length = 0;
        for (let i = 0; i < 510; i++) addChatLog(new ChatLog(`<b>${i}</b>`));
        expect(Menu.chatLogs.length).toBe(500);
        expect(Menu.chatLogs[0].msg).toBe("<b>10</b>");
    });
});
