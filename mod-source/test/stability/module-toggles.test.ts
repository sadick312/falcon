// Every menu toggle must be safe to flip at runtime, mid-game. Replays the scripted sample fight
// (mod-source/bench/recordings/sample-synthetic.fpl) through the real client with toggles on, off and
// flipped halfway, and fails on any handler error or console.error. The one-toggle-at-a-time sweep is opt-in
// (STABILITY_SWEEP=1); STABILITY_RECORDING and STABILITY_TIMEOUT pick another recording and its time limit.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Decoder } from "@msgpack/msgpack";
import { describe, expect, it, vi } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
// STABILITY_RECORDING=<file.fpl> runs the same checks on another recording (e.g. sample-busy.fpl or a real !plog).
const recording = process.env.STABILITY_RECORDING ?? path.join(here, "..", "..", "bench", "recordings", "sample-synthetic.fpl");
const gamePage = fs.readFileSync(path.join(here, "..", "..", "..", "public", "index.html"), "utf8");

interface Packet { time: number; type: string; data: unknown[] }

/** PacketRecorder.compileBinaryLog layout: f64 time, i32 length, msgpack [type, data], i32 length + brain state. */
function readRecording(): Packet[] {
    const bytes = fs.readFileSync(recording);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new Decoder();
    const packets: Packet[] = [];

    for (let offset = 0; offset + 12 <= bytes.length;) {
        const time = view.getFloat64(offset, true);
        const length = view.getInt32(offset + 8, true);
        offset += 12;
        const [type, data] = decoder.decode(bytes.subarray(offset, offset + length)) as [string, unknown[]];
        offset += length + 4 + view.getInt32(offset + length, true);
        packets.push({ time, type, data: Array.isArray(data) ? data : [] });
    }

    const start = packets.find(p => p.time > 0)?.time ?? 0;
    for (const p of packets) p.time = p.time === 0 ? 0 : p.time - start;
    return packets;
}

type MenuApi = { itemMap: Record<string, { status: unknown }>; setValue(id: string, value: boolean): void };

/** Settings that act outside the game (downloads, saving, fake latency) and don't belong in this sweep. */
const SKIPPED = new Set(["autoSaveSettings", "improvementLogging", "improvementLoggingLCopy", "artificialPing"]);

/**
 * Replays the recording in fresh modules. `setup` runs before the first packet, `midway` halfway through.
 * Returns every error: thrown by a handler, or logged with console.error.
 */
async function replay(setup: (menu: MenuApi, toggles: string[]) => void, midway?: (menu: MenuApi, toggles: string[]) => void) {
    vi.resetModules();
    document.documentElement.innerHTML = gamePage;
    vi.useFakeTimers({ now: 0, toFake: ["performance", "Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame"] });

    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => { errors.push(args.map(a => a instanceof Error ? a.stack : String(a)).join(" ")); });
    vi.spyOn(console, "log").mockImplementation(() => { });
    vi.spyOn(console, "warn").mockImplementation(() => { });

    try {
        await import("@core/socket/SocketListener");
        const { default: items } = await import("@constants/items");
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
        const menu = Menu as unknown as MenuApi;
        const toggles = Object.keys(menu.itemMap).filter(id => typeof menu.itemMap[id].status === "boolean" && !SKIPPED.has(id));

        const { default: Client } = await import("@core/Client");
        Client.mode = "replay";
        await import("@core/Connection");
        await Client.connect();

        const socket = Client.socket as unknown as { handlers: Record<string, (...args: unknown[]) => void> };
        const packets = readRecording();
        const half = Math.floor(packets.length / 2);

        try {
            setup(menu, toggles);
        } catch (err) {
            errors.push(`setup: ${err instanceof Error ? err.stack : String(err)}`);
        }

        let now = 0;
        for (let i = 0; i < packets.length; i++) {
            const packet = packets[i];
            if (packet.time > now) {
                vi.advanceTimersByTime(packet.time - now);
                now = packet.time;
            }

            if (i === half && midway) {
                try {
                    midway(menu, toggles);
                } catch (err) {
                    errors.push(`midway toggle: ${err instanceof Error ? err.stack : String(err)}`);
                }
            }

            try {
                socket.handlers[packet.type]?.(...packet.data);
            } catch (err) {
                errors.push(`packet '${packet.type}': ${err instanceof Error ? err.stack : String(err)}`);
            }
        }

        return { errors, toggles };
    } finally {
        vi.useRealTimers();
        vi.restoreAllMocks();
    }
}

const setAll = (value: boolean) => (menu: MenuApi, toggles: string[]) => {
    for (const id of toggles) menu.setValue(id, value);
};

/** First line of each distinct error, so a repeated per-tick error shows once. */
const distinct = (errors: string[]) => [...new Set(errors.map(e => e.split("\n").slice(0, 2).join(" | ")))];

describe("menu toggles at runtime", () => {
    it("runs a fight with every module on", async () => {
        const { errors } = await replay(setAll(true));
        expect(distinct(errors)).toEqual([]);
    });

    it("runs a fight with every module off", async () => {
        const { errors } = await replay(setAll(false));
        expect(distinct(errors)).toEqual([]);
    });

    it("survives every module being switched off, then on, mid-fight", async () => {
        const { errors } = await replay(setAll(true), (menu, toggles) => {
            setAll(false)(menu, toggles);
            setAll(true)(menu, toggles);
        });
        expect(distinct(errors)).toEqual([]);
    });

    // One replay per toggle (about 45 s on the default recording), so it only runs when asked for:
    // STABILITY_SWEEP=1 npx vitest run mod-source/test/stability
    it.runIf(process.env.STABILITY_SWEEP === "1")("survives each module being flipped on its own mid-fight", async () => {
        const failures: Record<string, string[]> = {};
        const { toggles } = await replay(() => { });

        for (const id of toggles) {
            const { errors } = await replay(() => { }, (menu) => {
                menu.setValue(id, !menu.itemMap[id].status);
            });
            if (errors.length) failures[id] = distinct(errors);
        }

        expect(failures).toEqual({});
    }, Number(process.env.STABILITY_TIMEOUT ?? 300_000));
});
