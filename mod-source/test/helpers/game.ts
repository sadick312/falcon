// A scripted game for feature tests: real client in replay mode (fresh modules, fake timers), driven with the
// same server packets a v1.8.2 game sends after LegacyPacketAdapter. Tests set up a situation and check what
// the mod tried to send.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { vi } from "vitest";

const gamePage = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", "index.html"), "utf8");

export const TICK_MS = 111;
export const ME = 1;

type Handlers = Record<string, (...args: unknown[]) => void>;

export interface PlayerState {
    sid: number;
    x: number;
    y: number;
    /** Facing, in radians. */
    dir?: number;
    weaponIndex?: number;
    weaponVariant?: number;
    buildIndex?: number;
    team?: string | null;
    skinIndex?: number;
    tailIndex?: number;
}

/** [sid, x, y, dir, scale, type, itemId, ownerSid], as in LOAD_GAME_OBJECT. Natural objects have no item or owner. */
export interface ObjectState {
    sid: number;
    x: number;
    y: number;
    itemId?: number;
    owner?: number;
    scale?: number;
    type?: number;
    dir?: number;
}

export interface Sent { tick: number; type: string; args: unknown[] }

export interface StartOptions {
    /** Menu toggles to turn on. Every other toggle is turned off, so a test sees one feature at a time. */
    enable?: string[];
    /** Other menu values to set, by id. */
    settings?: Record<string, unknown>;
}

export async function startGame(options: StartOptions = {}) {
    vi.resetModules();
    document.documentElement.innerHTML = gamePage;
    localStorage.clear();
    vi.useFakeTimers({ now: 0, toFake: ["performance", "Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame"] });
    vi.spyOn(console, "log").mockImplementation(() => { });

    await import("@core/socket/SocketListener");
    const { default: items } = await import("@constants/items");
    // Loader.prepareUI's hotbar elements, without the icons.
    const actionBar = document.getElementById("action-bar")!;
    for (let i = 0; i < items.weapons.length + items.list.length; i++) {
        const item = document.createElement("div");
        item.id = `action-bar-item-${i}`;
        if (i >= 19 && i <= 38) {
            const count = document.createElement("div");
            count.id = `item-count-${i}`;
            item.appendChild(count);
        }
        actionBar.appendChild(item);
    }

    const { default: Menu } = await import("@menu/Menu");
    await Menu.init();
    const enabled = new Set(options.enable ?? []);
    for (const [id, item] of Object.entries(Menu.itemMap)) {
        if (typeof item.status === "boolean") item.status = enabled.has(id);
    }
    for (const [id, value] of Object.entries(options.settings ?? {})) Menu.itemMap[id].status = value;

    const { default: Client } = await import("@core/Client");
    Client.mode = "replay";
    await Client.connect();

    const socket = Client.socket as unknown as { handlers: Handlers; sendMsg: (type: string, ...args: unknown[]) => void };
    const handlers = socket.handlers;
    const sent: Sent[] = [];
    let tick = 0;
    socket.sendMsg = (type, ...args) => { sent.push({ tick, type, args }); };

    const players = new Map<number, PlayerState>();

    const game = {
        Client,
        Menu,
        handlers,
        sent,
        get tick() { return tick; },

        /** Spawns a player (ADD_PLAYER). The first one with sid ME is us. */
        spawn(state: PlayerState, name = `p${state.sid}`) {
            players.set(state.sid, { ...state });
            handlers.D([`id${state.sid}`, state.sid, name, state.x, state.y, state.dir ?? 0, 100, 100, 35, 0], state.sid === ME);
        },

        /** UPDATE_ITEMS: our weapons and buildings. */
        setLoadout(weapons: number[], items: number[]) {
            handlers.V(weapons, true);
            handlers.V(items, false);
        },

        /** LOAD_GAME_OBJECT for the given objects. */
        addObjects(objects: ObjectState[]) {
            const flat: unknown[] = [];
            for (const o of objects) {
                const item = o.itemId === undefined ? undefined : items.list[o.itemId];
                flat.push(o.sid, o.x, o.y, o.dir ?? 0, o.scale ?? item?.scale ?? 100, o.type ?? (item ? null : 0), o.itemId ?? null, o.owner ?? null);
            }
            handlers.H(flat);
        },

        setHealth(sid: number, health: number) {
            handlers.O(sid, health);
        },

        /**
         * One server tick: advance 111 ms, then UPDATE_PLAYERS with `changes` merged into the players' last state.
         * Players are listed in `order` (default: spawn order); a lower index updates first on the server.
         */
        update(changes: Partial<PlayerState>[] = [], order?: number[]) {
            for (const change of changes) Object.assign(players.get(change.sid!)!, change);
            vi.advanceTimersByTime(TICK_MS);
            tick++;

            const positions: unknown[] = [];
            const attributes: unknown[] = [];
            for (const sid of order ?? [...players.keys()]) {
                const p = players.get(sid)!;
                positions.push(p.sid, p.x, p.y, Math.round((p.dir ?? 0) * 100));
                attributes.push(p.sid, p.buildIndex ?? -1, p.weaponIndex ?? 0, p.weaponVariant ?? 0, p.team ?? null, 0, p.skinIndex ?? 0, p.tailIndex ?? 0, 0, 0);
            }
            handlers.a(positions, attributes, []);
        },

        /** Packets sent during the last `ticks` updates. */
        sentInLast(ticks = 1) {
            return sent.filter(s => s.tick > tick - ticks);
        },

        done() {
            vi.useRealTimers();
            vi.restoreAllMocks();
        }
    };

    return game;
}

export type Game = Awaited<ReturnType<typeof startGame>>;
