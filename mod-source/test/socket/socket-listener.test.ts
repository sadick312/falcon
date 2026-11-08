// A2: SocketListener's packet handlers that no other test reaches: ping timing, alliances and teams, players leaving,
// age, chat, kill chat, leaderboard, death and auto respawn, building wiggles, custom packets, and odd packets
// (unknown sids, packets before we spawned, packets with missing data).
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;

async function spawned(options: Parameters<typeof startGame>[0] = {}) {
    game = await startGame(options);
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.spawn({ sid: ENEMY, x: 1200, y: 1000 });
    const { default: SocketListener } = await import("@core/socket/SocketListener");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { default: Menu } = await import("@menu/Menu");
    return { SocketListener, PlayerManager, Menu, h: game.handlers, Client: game.Client };
}

const byId = (id: string) => document.getElementById(id)!;

describe("ping", () => {
    it("measures the round trip and waits for the reply before pinging again", async () => {
        const { SocketListener, h, Client } = await spawned();
        game!.sent.length = 0;

        SocketListener.pingSocket();
        SocketListener.pingSocket(); // still waiting: skipped
        vi.advanceTimersByTime(42);
        h["0"]();

        expect(game!.sent.filter(s => s.type === "0")).toHaveLength(1);
        expect(Client.pingTime).toBe(42);
        expect(byId("ping-display").innerText).toMatch(/^Ping: 42 ms/);
    });

    it("pings again after 5 s without a reply", async () => {
        const { SocketListener } = await spawned();
        game!.sent.length = 0;

        SocketListener.pingSocket();
        vi.advanceTimersByTime(5_001);
        SocketListener.pingSocket();

        expect(game!.sent.filter(s => s.type === "0")).toHaveLength(2);
    });

    it("ignores a reply nobody asked for", async () => {
        const { h, Client } = await spawned();
        Client.pingTime = 77;
        h["0"]();
        expect(Client.pingTime).toBe(77);
    });
});

describe("hooking a socket", () => {
    it("doesn't hook the same socket twice", async () => {
        const { SocketListener, Client, h } = await spawned();
        const before = h.D;
        SocketListener.hookEvents(Client.socket);
        expect(h.D).toBe(before);
    });
});

describe("alliances and teams", () => {
    it("loads the clans from SET_INIT_DATA and adds new ones", async () => {
        const { h, Client } = await spawned();
        h.A({ teams: [{ sid: "red", owner: 7 }] });
        h.g({ sid: "blue", owner: ENEMY });

        expect(Client.alliances.map(a => a.sid)).toEqual(["red", "blue"]);
        expect([...Client.allianceMap.get("red")!]).toEqual([7]);
        expect([...Client.allianceMap.get("blue")!]).toEqual([ENEMY]);
    });

    it("moves us from our old clan to the new one on SET_PLAYER_TEAM", async () => {
        const { h, Client } = await spawned();
        h["3"]("red", true);
        expect(Client.player.team).toBe("red");
        expect(Client.player.isOwner).toBe(true);
        expect(Client.allianceMap.get("red")!.has(ME)).toBe(true);

        h["3"]("blue", false);
        expect(Client.allianceMap.has("red")).toBe(false); // we were its only member
        expect(Client.allianceMap.get("blue")!.has(ME)).toBe(true);
    });

    it("redraws the clan menu while it's open", async () => {
        const { h, Client } = await spawned();
        byId("alliance-holder").style.display = "flex";
        h.g({ sid: "blue", owner: ENEMY });
        h["4"](["blue", ENEMY, "p2"]);
        h["3"]("blue", false);
        h["1"]("blue");
        expect(Client.alliances).toEqual([]);
    });

    it("deletes a clan, and ignores deleting one it never saw", async () => {
        const { h, Client } = await spawned();
        h.A({ teams: [{ sid: "red", owner: 7 }, { sid: "blue", owner: 8 }] });

        h["1"]("red");
        h["1"]("ghost");

        expect(Client.alliances.map(a => a.sid)).toEqual(["blue"]);
        expect(Client.allianceMap.has("red")).toBe(false);
    });

    it("queues clan join requests", async () => {
        const { h, Client } = await spawned();
        h["2"](ENEMY, "p2");
        expect(Client.allianceNotifications).toEqual([{ sid: ENEMY, name: "p2" }]);
    });

    it("treats a non-list alliance player packet as no members", async () => {
        const { h, Client } = await spawned();
        h["4"]("garbage");
        expect(Client.alliancePlayers).toEqual([]);
        game!.update(); // the next tick reads the list
    });
});

describe("players leaving", () => {
    it("removes a player who leaves, and their clan when they were its last member", async () => {
        const { h, Client, PlayerManager } = await spawned();
        h.g({ sid: "blue", owner: ENEMY });
        PlayerManager.get(ENEMY)!.team = "blue";

        h.E(`id${ENEMY}`);

        expect(PlayerManager.get(ENEMY)).toBeFalsy();
        expect(Client.allianceMap.has("blue")).toBe(false);
    });

    it("ignores a leave for a player it never saw", async () => {
        const { h, PlayerManager } = await spawned();
        h.E("nobody");
        expect(PlayerManager.players.handler.all).toHaveLength(2);
    });
});

describe("our own values", () => {
    it("updates XP and age, and forgets upgrades when we're back to age 1", async () => {
        const { h, Client } = await spawned();
        Client.upgradesObtained.add(3);

        h.T(50, 200, 4);
        expect(byId("age-display").innerHTML).toBe("age 4");
        expect(byId("age-bar").style.width).toBe("25%");
        expect(Client.upgradesObtained.size).toBe(1);

        h.T(undefined, undefined, 1);
        expect(Client.player.XP).toBe(50);
        expect(Client.upgradesObtained.size).toBe(0);
    });

    it("sends the kill chat when Kill Chat is on", async () => {
        const { h } = await spawned({ enable: ["killChat"] });
        game!.sent.length = 0;

        h.N("kills", 1);
        vi.advanceTimersByTime(750);

        expect(game!.sent.filter(s => s.type === "6").map(s => s.args[0])).toEqual(["Dumbasses Down: 1", "I'm Super Pro"]);
    });

    it("hands new upgrade points to Auto Buy", async () => {
        const { h } = await spawned();
        const { default: AutoBuyer } = await import("@core/mod/utils/AutoBuyer");
        const buy = vi.spyOn(AutoBuyer, "main").mockImplementation(() => { });

        h.N("points", 3);
        expect(buy).toHaveBeenCalledWith(3);
    });
});

describe("chat", () => {
    it("shows chat over the player, replaces /shrug, and keeps the last 3 lines", async () => {
        const { h, PlayerManager } = await spawned();
        for (const msg of ["one", "two", "three", "/shrug"]) h["6"](ENEMY, msg);

        expect(PlayerManager.get(ENEMY)!.chatMessages.map(m => m.msg)).toEqual(["¯\\_(ツ)_/¯", "three", "two"]);
    });

    it("keeps hidden (@@@@@) and empty messages out of the chat log", async () => {
        const { h, Menu } = await spawned();
        const before = Menu.chatLogs.length;
        h["6"](ENEMY, "@@@@@ secret");
        h["6"](ENEMY, "   ");
        h["6"](ENEMY, "hello");
        expect(Menu.chatLogs.length).toBe(before + 1);
    });

    it("ignores chat from an unknown player", async () => {
        const { h, Menu } = await spawned();
        const before = Menu.chatLogs.length;
        h["6"](99, "hi");
        expect(Menu.chatLogs.length).toBe(before);
    });
});

describe("leaderboard", () => {
    it("lists the top players with our own row highlighted", async () => {
        const { h } = await spawned();
        h.G([ME, "me", 1500, ENEMY, "", 20]);

        const rows = [...byId("leaderboard").querySelectorAll<HTMLElement>(".leaderboard-label")];
        expect(rows.map(r => r.innerText)).toEqual([`1. me {${ME}}`, `2. unknown {${ENEMY}}`]);
        expect(rows[0].classList.contains("is-owner")).toBe(true);
        expect(rows[1].classList.contains("is-owner")).toBe(false);
    });
});

describe("death", () => {
    it("shows the respawn card after 2 s and respawns by itself with Auto Respawn", async () => {
        const { h, Client } = await spawned({ enable: ["autoRespawn"] });
        Client.mode = "normal";
        const { enterGameBtn } = await import("@ui/enterGameBtn");
        const click = vi.spyOn(enterGameBtn, "click").mockImplementation(() => { });
        document.documentElement.setAttribute("uhohboring", "");

        h.P();
        expect(Client.isAlive).toBe(false);
        expect(byId("death-text").style.display).toBe("flex");

        vi.advanceTimersByTime(2_000);
        expect(byId("respawn-page-main-card").style.display).toBe("flex");
        expect(click).toHaveBeenCalledTimes(1);
        document.documentElement.removeAttribute("uhohboring");
    });

    it("shows the game again when we spawn in a normal game", async () => {
        const { h, Client } = await spawned();
        Client.mode = "normal";
        h.D([`id${ME}`, ME, "me", 500, 500, 0, 100, 100, 35, 0], true);

        expect(byId("game-ui").style.display).toBe("block");
        expect(byId("respawn-page").style.display).toBe("none");
        expect(byId("age-display").innerText).toBe("age 1");
    });
});

describe("buildings and projectiles", () => {
    it("wiggles a hit building and remembers it for this tick; a projectile's end clears that", async () => {
        const { h, Client } = await spawned();
        game!.addObjects([{ sid: 500, x: 1100, y: 1000, itemId: 3, owner: ME }]);
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");

        h.L(0, 500);
        h.L(0, 999); // unknown building: ignored

        expect(ObjectManager.getObject(500)!.xWiggle).toBe(10);
        expect(Client.buildingsHit).toHaveLength(1);

        h.Y(77, 0);
        expect(Client.buildingsHit).toHaveLength(0);
    });

    it("doesn't count a hit tree or rock as a building hit (they have endless health)", async () => {
        const { h, Client } = await spawned();
        game!.addObjects([{ sid: 501, x: 900, y: 900 }]);
        h.L(1, 501);
        expect(Client.buildingsHit).toHaveLength(0);
    });

    it("ignores item counts that arrive before we spawned", async () => {
        game = await startGame();
        expect(() => game!.handlers.S(1, 5)).not.toThrow();
        expect(() => game!.handlers.T(1, 2, 3)).not.toThrow();
        expect(() => game!.handlers["3"]("red", true)).not.toThrow();
    });
});

describe("custom packets", () => {
    it("adds a placement marker and updates a building's health (p)", async () => {
        const { h, Client } = await spawned();
        game!.addObjects([{ sid: 500, x: 1100, y: 1000, itemId: 3, owner: ME }]);
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        Client.markers.length = 0;

        h["falcon:marker"](10, 20, 0.5, 15, 1);
        h.p(500, 123);
        h.p(999, 1);

        expect(Client.markers).toHaveLength(1);
        expect(ObjectManager.getObject(500)!.health).toBe(123);
    });
});
