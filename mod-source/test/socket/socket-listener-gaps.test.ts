// A2: the SocketListener paths socket-listener.test.ts doesn't reach: the 1 s ping loop on a live socket (and that
// it stops on close or when a new socket takes over), saving the .fpl packet log (!plog and on death), and the
// store, upgrade, floating-text, clan-menu and Moostafa-attack handlers.
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
    return { SocketListener, h: game.handlers, Client: game.Client };
}

const byId = (id: string) => document.getElementById(id)!;

describe("the ping loop on a live socket", () => {
    /** A socket that passes `instanceof Socket` (so hookEvents starts the 1 s ping loop) without a real connection. */
    async function liveSocket() {
        const { default: Socket } = await import("@core/socket/Socket");
        const socket = Object.create(Socket.prototype) as { on: () => void; sendMsg: ReturnType<typeof vi.fn> };
        socket.on = () => { };
        socket.sendMsg = vi.fn();
        return socket;
    }

    const replied = (listener: object) => { (listener as { awaitingPong: boolean }).awaitingPong = false; };

    it("pings at once, then every second once the reply came, and stops when the socket closes", async () => {
        const { SocketListener } = await spawned();
        const socket = await liveSocket();
        SocketListener.hookEvents(socket as never);
        expect(socket.sendMsg).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1_000); // no reply yet: the loop waits
        expect(socket.sendMsg).toHaveBeenCalledTimes(1);

        replied(SocketListener);
        vi.advanceTimersByTime(1_000);
        expect(socket.sendMsg).toHaveBeenCalledTimes(2);

        SocketListener.stopPinging(); // what Socket's onclose does (socketHooks.onClose)
        replied(SocketListener);
        vi.advanceTimersByTime(10_000);
        expect(socket.sendMsg).toHaveBeenCalledTimes(2);
    });

    it("stops the old socket's ping loop when a new socket is hooked", async () => {
        const { SocketListener } = await spawned();
        const first = await liveSocket();
        const second = await liveSocket();
        SocketListener.hookEvents(first as never);
        SocketListener.hookEvents(second as never);

        for (let i = 0; i < 3; i++) {
            replied(SocketListener);
            vi.advanceTimersByTime(1_000);
        }

        expect(first.sendMsg).toHaveBeenCalledTimes(1);
        expect(second.sendMsg).toHaveBeenCalledTimes(4);
        SocketListener.stopPinging();
    });

    it("doesn't ping before any socket is hooked", async () => {
        const { SocketListener } = await spawned();
        SocketListener.isInitialized = false;
        game!.sent.length = 0;
        SocketListener.pingSocket();
        expect(game!.sent).toHaveLength(0);
    });
});

describe("saving the packet log (.fpl)", () => {
    const LOG = new Uint8Array([1, 2, 3]);

    async function exporter(enable: string[] = []) {
        const parts = await spawned({ enable });
        const { default: PacketRecorder } = await import("@services/packet-recorder/PacketRecorder");
        const compile = vi.spyOn(PacketRecorder, "compileBinaryLog").mockReturnValue(LOG);
        // A live game: the export is skipped while watching a replay (FakeSocket).
        (parts.SocketListener as unknown as { socket: object }).socket = {};
        const revokeUrl = vi.fn();
        Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fpl"), revokeObjectURL: revokeUrl });
        const downloads: string[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            downloads.push(this.download);
        });
        return { ...parts, compile, revokeUrl, downloads };
    }

    it("downloads m_log_<date>_<time>.fpl on !plog and frees the blob a second later", async () => {
        const { SocketListener, downloads, revokeUrl } = await exporter();
        SocketListener.exportPacketLog(true);

        const time = (new Date(0).toTimeString().split(" ")[0] ?? "").replace(/:/g, "-");
        expect(downloads).toEqual([`m_log_1970-01-01_${time}.fpl`]);
        expect(document.querySelector("a[download]")).toBeNull(); // the temporary link is removed again
        expect(revokeUrl).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1_000);
        expect(revokeUrl).toHaveBeenCalledWith("blob:fpl");
    });

    it("saves nothing when nothing was recorded", async () => {
        const { SocketListener, compile, downloads } = await exporter();
        compile.mockReturnValue(undefined as never);
        SocketListener.exportPacketLog(true);
        expect(downloads).toEqual([]);
    });

    it("never saves while watching a replay", async () => {
        const { SocketListener, Client, downloads } = await exporter();
        (SocketListener as unknown as { socket: unknown }).socket = Client.socket; // the replay's FakeSocket
        SocketListener.exportPacketLog(true);
        expect(downloads).toEqual([]);
    });

    it("saves d_log_*.fpl one second after death when Improvement Logging is off", async () => {
        const { h, downloads } = await exporter();
        h.P();
        vi.advanceTimersByTime(999);
        expect(downloads).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(downloads).toHaveLength(1);
        expect(downloads[0]).toMatch(/^d_log_.*\.fpl$/);
    });

    it("with Improvement Logging on, saves the death log only with Local Copy (!plog always saves)", async () => {
        const off = await exporter(["improvementLogging"]);
        off.h.P();
        vi.advanceTimersByTime(1_000);
        expect(off.downloads).toEqual([]);
        off.SocketListener.exportPacketLog(true);
        expect(off.downloads).toHaveLength(1);
        game!.done();

        const copy = await exporter(["improvementLogging", "improvementLoggingLCopy"]);
        copy.h.P();
        vi.advanceTimersByTime(1_000);
        expect(copy.downloads).toHaveLength(1);
    });
});

describe("store, upgrades, text, clans and animals", () => {
    it("marks a bought hat or accessory as owned, and an equipped one as worn (5)", async () => {
        const { h, Client } = await spawned();
        h["5"](false, 7, 0); // bought hat 7
        h["5"](true, 7, 0); // wearing it
        h["5"](false, 11, 1); // bought accessory 11
        h["5"](true, 11, 1);

        expect(Client.player.skins[7]).toBe(true);
        expect(Client.player.skinIndex).toBe(7);
        expect(Client.player.tails[11]).toBe(true);
        expect(Client.player.tailIndex).toBe(11);
    });

    it("stores granted upgrade points and offers the next age's items (U)", async () => {
        const { h, Client } = await spawned();
        h.U(1, 2);
        expect(Client.player.upgradePoints).toBe(1);
        expect(Client.player.upgrAge).toBe(2);
        expect(byId("upgrade-holder").children.length).toBeGreaterThan(0);
    });

    it("shows the server's floating numbers, unless Stacked Text draws its own (8)", async () => {
        await spawned();
        const plain = await import("@core/logic/TextManager");
        game!.handlers["8"](1000, 1000, 35, 0);
        expect(plain.default.texts.size).toBe(1);
        game!.done();

        await spawned({ enable: ["stackedText"] });
        const stacked = await import("@core/logic/TextManager");
        game!.handlers["8"](1000, 1000, 35, 0);
        expect(stacked.default.texts.size).toBe(0);
    });

    it("redraws the open clan menu when SET_INIT_DATA arrives (A)", async () => {
        const { h, Client } = await spawned();
        byId("alliance-holder").style.display = "flex";
        h.A({ teams: [{ sid: "red", owner: 7 }] });
        expect(Client.alliances.map(a => a.sid)).toEqual(["red"]);
        expect(byId("alliance-menu").querySelectorAll(".join-alliance-btn")).toHaveLength(1);
    });

    it("damages the buildings Moostafa hit on the next tick, and ignores other animals' attacks (J)", async () => {
        const { h, Client } = await spawned();
        const MOOSTAFA = 6; // its id in aiTypes
        const COW = 0;
        h.I([7, MOOSTAFA, 1200, 1100, 0, 8000, 0, 0, 8, COW, 1300, 1300, 0, 500, 0, 0], []);
        const building = { sid: 500, health: 300, maxHealth: 400 };
        Client.buildingsHit = [building as never];

        h.J(8); // the cow: nothing happens
        expect(Client.buildingsHit).toHaveLength(1);

        h.J(7);
        expect(Client.buildingsHit).toHaveLength(0);
        game!.update();
        expect(building.health).toBe(68);
    });
});
