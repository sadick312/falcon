// Feature #57, UI events (updateClanMenu, updateItems, updateNotifications, updatePlayerValue, updateUpgrades): redraw
// the tribe menu (members with Kick for the owner, or tribes to join), the hotbar, tribe join requests, resources, and
// the upgrade choices (only items whose prerequisite we own; Auto Upgrade picks cookie, pit trap, greater spikes or the
// chosen 7th-slot item). Names are written as text, never as HTML.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
}

describe("UI events", () => {
    it("lists tribe members as text, with Kick only for the owner", async () => {
        await setUp();
        const { default: updateClanMenu } = await import("@core/events/updateClanMenu");
        const player = game!.Client.player;
        player.team = "abc";
        player.isOwner = true;
        game!.Client.alliancePlayers = [ME, "me", 2, "<img src=x onerror=alert(1)>"];
        updateClanMenu();
        const items = [...document.querySelectorAll("#alliance-menu .alliance-item")];
        expect(items.length).toBe(2);
        expect((items[1] as HTMLElement).innerText).toContain("<img src=x onerror=alert(1)>");
        expect(document.querySelector("#alliance-menu img")).toBeNull();
        expect(items[0].querySelector(".join-alliance-btn")).toBeNull();
        expect((items[1].querySelector(".join-alliance-btn") as HTMLElement).innerText).toBe("Kick");

        player.isOwner = false;
        updateClanMenu();
        expect(document.querySelectorAll("#alliance-menu .join-alliance-btn").length).toBe(0);
    });

    it("shows a join request and answers it", async () => {
        await setUp();
        const { default: updateNotifications } = await import("@core/events/updateNotifications");
        game!.Client.allianceNotifications.push({ sid: 7, name: "bob" });
        updateNotifications();
        const display = document.getElementById("notification-display")!;
        expect(display.style.display).toBe("flex");
        expect((display.querySelector(".notification-text") as HTMLElement).innerText).toBe("bob {7}");

        const before = game!.sent.length;
        (display.querySelectorAll(".notif-button")[1] as HTMLElement).click();
        expect(game!.sent.slice(before).map(p => [p.type, ...p.args])).toEqual([["P", 7, true]]);
        expect(display.style.display).toBe("none");
    });

    it("shows only our items and weapons on the hotbar", async () => {
        await setUp();
        const { default: items } = await import("@constants/items");
        const shown = (id: number) => document.getElementById(`action-bar-item-${id}`)!.style.display;
        expect(shown(5)).toBe("inline-block"); // polearm
        expect(shown(0)).toBe("none"); // tool hammer
        expect(shown(items.weapons.length + 15)).toBe("inline-block"); // pit trap
        expect(shown(items.weapons.length + 7)).toBe("none"); // greater spikes
    });
});
