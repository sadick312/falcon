// A3: connecting again in the same page (no reload) must start from a clean game state. Sids are only unique per
// server, so anything left from the old connection would be mixed up with the new server's players and buildings.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;

/** A game with something in every list: players, buildings, a projectile, an animal, an alliance, queued state. */
async function playedGame() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.spawn({ sid: ENEMY, x: 1200, y: 1000, weaponIndex: 5 });
    game.addObjects([{ sid: 500, x: 1100, y: 1100, itemId: 6, owner: ENEMY }, { sid: 501, x: 900, y: 900 }]);
    game.update();
    game.handlers.X(1100, 1000, 0, 500, 1.6, 0, 1, 77);
    game.handlers.I([7, 0, 1300, 1300, 0, 500, 0, 0], []);
    game.handlers.g({ sid: "clan", owner: ME });
    game.handlers["4"](["clan", ME, "me"]);
    game.handlers["7"]([1, 2, 3, 4]);

    const { ais } = await import("@entities/Ai");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { default: ObjectManager } = await import("@core/logic/ObjectManager");
    const { default: ProjectileManager } = await import("@core/logic/ProjectileManager");
    const { default: TextManager } = await import("@core/logic/TextManager");
    const { default: ModManager } = await import("@core/ModManager");
    return { ais, PlayerManager, ObjectManager, ProjectileManager, TextManager, ModManager };
}

describe("reconnecting without a page reload", () => {
    it("forgets the old server's players, buildings, projectiles, animals and alliances", async () => {
        const m = await playedGame();
        const { Client } = game!;
        m.TextManager.add(0, 0, 5, 0);

        // The state is really there before reconnecting (so the checks below can fail).
        expect(m.PlayerManager.players.handler.all.length).toBe(2);
        expect(m.ObjectManager.getObject(500)).toBeTruthy();
        expect(m.ProjectileManager.projectiles.all.length).toBe(1);
        expect(m.ais.all.length).toBe(1);
        expect(Client.allianceMap.size).toBeGreaterThan(0);

        await Client.connect();

        expect(m.PlayerManager.players.handler.all).toHaveLength(0);
        expect(m.PlayerManager.players.visible.all).toHaveLength(0);
        expect(m.ObjectManager.getObject(500)).toBeFalsy();
        expect(m.ObjectManager.getObject(501)).toBeFalsy();
        expect(m.ObjectManager.allTurrets.all).toHaveLength(0);
        expect(m.ProjectileManager.projectiles.all).toHaveLength(0);
        expect(m.ProjectileManager.simulationProjectiles.all).toHaveLength(0);
        expect(m.ais.all).toHaveLength(0);
        expect(m.TextManager.texts.size).toBe(0);

        expect(Client.player).toBeUndefined();
        expect(Client.mySID).toBe(-1);
        expect(Client.isAlive).toBe(false);
        expect(Client.alliances).toEqual([]);
        expect(Client.alliancePlayers).toEqual([]);
        expect(Client.allianceMap.size).toBe(0);
        expect(Client.minimapData).toEqual([]);
        expect(m.ModManager.enemyData.all).toHaveLength(0);
        expect(m.ModManager.enemyData.nearest).toBeNull();
    });

    it("hooks the packet handlers to the new socket, so the new game plays normally", async () => {
        const m = await playedGame();
        const { Client } = game!;
        const oldSocket = Client.socket;

        await Client.connect();
        const newSocket = Client.socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> };
        expect(newSocket).not.toBe(oldSocket);

        // ADD_PLAYER for us on the new server, with a sid the old server used for the enemy.
        newSocket.handlers.D([`id${ENEMY}`, ENEMY, "me again", 3000, 3000, 0, 100, 100, 35, 0], true);

        expect(Client.mySID).toBe(ENEMY);
        expect(Client.player.real_position.x).toBe(3000);
        expect(m.PlayerManager.players.handler.all).toHaveLength(1);
    });

    it("keeps the first connection unchanged (nothing to reset)", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000 });
        expect(game.Client.player.sid).toBe(ME);
    });
});

describe("the replaced socket (Socket.dispose)", () => {
    const originalWebSocket = globalThis.WebSocket;

    class FakeNativeWebSocket {
        static readonly CONNECTING = 0;
        static readonly OPEN = 1;
        readyState = 1;
        binaryType = "blob";
        sent: unknown[] = [];
        closeCalls = 0;
        constructor(public url: string) { }
        send(data: unknown) { this.sent.push(data); }
        close() { this.closeCalls++; this.readyState = 3; }
    }

    async function openSocket() {
        vi.resetModules();
        globalThis.WebSocket = FakeNativeWebSocket as unknown as typeof WebSocket;
        localStorage.setItem("falcon-host-mode", "moomodding");
        await import("@core/socket/SocketListener");
        const { default: Socket } = await import("@core/socket/Socket");
        const { default: PacketBatcher } = await import("@core/utils/PacketBatcher");
        const batched: string[] = [];
        vi.spyOn(PacketBatcher, "add").mockImplementation((type) => { batched.push(type); });
        const socket = new Socket("wss://s1.moomodding.io/?token=x", null);
        const { encode } = await import("@msgpack/msgpack");
        const receive = (message: unknown) => socket.onmessage!({ data: encode(message).slice().buffer } as MessageEvent);
        return { socket, batched, receive, native: socket as unknown as FakeNativeWebSocket };
    }

    afterEach(() => {
        globalThis.WebSocket = originalWebSocket;
    });

    it("closes the connection and ignores its late packets", async () => {
        const { socket, batched, receive, native } = await openSocket();
        receive(["io-init", ["id"]]);
        receive(["O", [5, 80]]);
        expect(batched).toEqual(["O"]);

        socket.dispose();
        receive(["O", [5, 60]]);

        expect(native.closeCalls).toBe(1);
        expect(batched).toEqual(["O"]);
        expect(socket.isDisposed).toBe(true);
    });

    it("shows no disconnect screen when its close event arrives", async () => {
        const { socket } = await openSocket();
        socket.onopen!(new Event("open"));
        socket.onmessage!({ data: new Uint8Array([0x92, 0xa7, ...new TextEncoder().encode("io-init"), 0x91, 0xa2, 0x69, 0x64]).buffer } as MessageEvent);
        const page = document.getElementById("disconnected-page")!;
        page.style.display = "none";

        socket.dispose();
        socket.onclose!(new CloseEvent("close", { code: 1000 }));

        expect(page.style.display).toBe("none");
    });

    it("sends nothing after it was replaced", async () => {
        const { socket, native } = await openSocket();
        socket.dispose();
        native.readyState = 1; // even if the browser hasn't finished closing it
        socket.sendMsg("6", "hello");
        expect(native.sent).toHaveLength(0);
    });

    it("is safe to dispose twice", async () => {
        const { socket, native } = await openSocket();
        socket.dispose();
        socket.dispose();
        expect(native.closeCalls).toBe(1);
    });
});
