/**
 * Stops the official MooMoo.io 1.8.2 game when it runs underneath Falcon on sandbox.moomodding.io.
 *
 * Falcon replaces the page, but replacing the HTML doesn't stop scripts that already ran. The vanilla game
 * (assets/index-*.js) runs whenever nothing blocks it: Falcon pasted into the F12 console, Quick Inject with an
 * older copy of the site's mod loader (it used to block only "bundle.js"), or a "hook" mod. Left alone it keeps
 * its own connection to the game server and redraws a detached canvas about 60 times a second.
 *
 * What the 1.8.2 files do, and how each part is stopped (checked against index-8f264913.js and hackfix.js):
 * - Socket: hackfix.js wraps window.WebSocket, and every socket made through the wrapper is stored in
 *   window.activeMooSocket, window.ws and document.ws. The game creates its socket through that wrapper (it saves
 *   window.WebSocket when it loads). Falcon's own socket extends the native class directly, so it never passes
 *   through the wrapper. We close whatever is stored there now, and turn those three slots into setters that
 *   close any socket stored later, so the game can't connect after Falcon started either.
 * - Draw loop: `function as() { ...; requestAnimFrame(as) }` looks up the global `requestAnimFrame` on every frame.
 *   We replace it with a function that schedules nothing (also if the game assigns it later), so the loop ends
 *   after at most one more frame. Falcon uses window.requestAnimationFrame, which is untouched.
 * - Anti-debug keys: the game cancels F12, Ctrl+Shift+I/J/C and Ctrl+U on window, which hides the console Falcon's
 *   troubleshooting relies on. A window capture listener stops those key presses before the game's listener sees
 *   them, so the browser handles them normally. Falcon binds none of these keys.
 *
 * The game's other timers (a 5 s server-list refresh, a 1 s UI check) stay; they're cheap and have no handle.
 *
 * The site's current page (since early Nov 2026, /assets/bundle.js, checked 10 Nov 2026) has no hackfix.js: the game
 * keeps its socket in a private module (`new window.WebSocket(address)`), so the slots above stay empty. It still
 * pings every 2.5 s (`io.send("ping")`), and every packet it sends is msgpack `[letter, data]`. So we also wrap
 * WebSocket.prototype.send: a socket that isn't Falcon's and sends a MooMoo game packet is closed and the packet
 * dropped. Other sockets on the page (anything not sending game packets) are left alone. Its draw loop still calls
 * the global requestAnimFrame, so that part works unchanged.
 */

import { GAME_V182 } from "@constants/gameVersion";

/** The minimal WebSocket surface the guard needs, so tests can pass plain objects. */
interface ClosableSocket {
    readyState: number;
    close(code?: number, reason?: string): void;
}

interface VanillaGuardOptions {
    /** Sockets Falcon owns. Never closed, even if they somehow end up in one of the slots. */
    isOwnSocket?: (socket: unknown) => boolean;
}

interface VanillaGuardResult {
    /** Vanilla sockets that were open or connecting and got closed. */
    closedSockets: number;
    /** The game's draw loop function was present (so the game had run) and is now stopped. */
    stoppedDrawLoop: boolean;
}

const CONNECTING = 0;
const OPEN = 1;

/** Normal closure; the reason shows in the game server's logs and in DevTools. */
const CLOSE_CODE = 1000;
const CLOSE_REASON = "Falcon replaced the vanilla client";

const noopAnimFrame = () => 0;

function isClosableSocket(value: unknown): value is ClosableSocket {
    return typeof value === "object" && value !== null &&
        typeof (value as ClosableSocket).close === "function" &&
        typeof (value as ClosableSocket).readyState === "number";
}

/** Keys the game blocks: F12, Ctrl+Shift+I / J / C, Ctrl+U. */
function isDevToolsShortcut(event: KeyboardEvent) {
    const key = event.keyCode;
    if (key === 123) return true;
    if (event.ctrlKey && event.shiftKey && (key === 73 || key === 74 || key === 67)) return true;
    return event.ctrlKey && !event.shiftKey && key === 85;
}

const GAME_PACKET_TYPES = new Set<number>(GAME_V182.clientToServer.map(type => type.charCodeAt(0)));

/** msgpack `[type, data]` with a one-letter packet type the game sends: 0x92 (array of 2), 0xa1 (1-char string), letter. */
export function isGamePacket(data: unknown): boolean {
    let bytes: Uint8Array;
    if (data instanceof ArrayBuffer) bytes = new Uint8Array(data, 0, Math.min(3, data.byteLength));
    else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, Math.min(3, data.byteLength));
    else return false;

    return bytes.length === 3 && bytes[0] === 0x92 && bytes[1] === 0xa1 && GAME_PACKET_TYPES.has(bytes[2] ?? -1);
}

/** Marks a WebSocket.prototype.send we already wrapped, so loading the guard twice doesn't wrap it twice. */
const WRAPPED = Symbol.for("falcon.vanillaGuard.send");

interface SendGuard {
    /** The current guard's check; replaced when the guard is installed again (fresh module, e.g. in tests). */
    onSend: (socket: WebSocket, data: unknown) => boolean;
}

/**
 * Wraps WebSocket.prototype.send once. `onSend` returns false to drop the packet. Falcon's own Socket extends the
 * same WebSocket class, so its packets pass through here too and must be let through by `onSend`.
 */
function guardSend(onSend: SendGuard["onSend"]) {
    const proto = (typeof WebSocket === "function" ? WebSocket.prototype : undefined) as
        (WebSocket & { [WRAPPED]?: SendGuard }) | undefined;
    if (!proto || typeof proto.send !== "function") return;

    const existing = proto[WRAPPED];
    if (existing) {
        existing.onSend = onSend;
        return;
    }

    const guard: SendGuard = { onSend };
    const nativeSend = proto.send;
    proto.send = function (this: WebSocket, data: Parameters<WebSocket["send"]>[0]) {
        if (!guard.onSend(this, data)) return;
        return nativeSend.call(this, data);
    };
    Object.defineProperty(proto, WRAPPED, { value: guard, configurable: true });
}

let installed: VanillaGuardResult | null = null;

/**
 * Stops the vanilla game's socket, draw loop and anti-debug keys. Safe to call more than once (later calls only
 * return the first result) and safe when the game never ran (then it only guards against it starting later).
 */
export function stopVanillaGame(options: VanillaGuardOptions = {}): VanillaGuardResult {
    if (installed) return installed;

    const isOwn = options.isOwnSocket ?? (() => false);
    const result: VanillaGuardResult = { closedSockets: 0, stoppedDrawLoop: false };
    const closed = new Set<ClosableSocket>();

    const closeIfVanilla = (value: unknown) => {
        if (!isClosableSocket(value) || isOwn(value) || closed.has(value)) return;
        if (value.readyState !== CONNECTING && value.readyState !== OPEN) return;

        closed.add(value);
        try {
            value.close(CLOSE_CODE, CLOSE_REASON);
            result.closedSockets++;
        } catch (err) {
            console.warn("[Falcon] Could not close the vanilla game's socket.", err);
        }
    };

    const guardSlot = (target: object, key: string) => {
        let current: unknown = (target as Record<string, unknown>)[key];
        closeIfVanilla(current);

        try {
            Object.defineProperty(target, key, {
                configurable: true,
                enumerable: true,
                get: () => current,
                set: (value: unknown) => {
                    current = value;
                    closeIfVanilla(value);
                }
            });
        } catch {
            // A slot someone made non-configurable: the socket in it was still closed above.
        }
    };

    guardSlot(window, "activeMooSocket");
    guardSlot(window, "ws");
    guardSlot(document, "ws");

    const win = window as unknown as Record<string, unknown>;
    result.stoppedDrawLoop = typeof win.requestAnimFrame === "function" && win.requestAnimFrame !== noopAnimFrame;
    try {
        Object.defineProperty(window, "requestAnimFrame", {
            configurable: true,
            enumerable: true,
            get: () => noopAnimFrame,
            set: () => { /* the game assigning its own loop scheduler later: keep ours */ }
        });
    } catch {
        win.requestAnimFrame = noopAnimFrame;
    }

    // The current page's game socket: closed the first time it sends (its ping comes within 2.5 s).
    guardSend((socket, data) => {
        if (isOwn(socket) || !isGamePacket(data)) return true;

        const before = result.closedSockets;
        closeIfVanilla(socket);
        if (result.closedSockets > before) {
            console.info("[Falcon] Closed the vanilla game's connection (it sent a game packet underneath Falcon).");
        }
        return false;
    });

    window.addEventListener("keydown", (event) => {
        if (isDevToolsShortcut(event)) event.stopImmediatePropagation();
    }, true);

    if (result.closedSockets || result.stoppedDrawLoop) {
        console.info(`[Falcon] Stopped the vanilla game underneath Falcon (closed ${result.closedSockets} socket(s), ` +
            `draw loop ${result.stoppedDrawLoop ? "stopped" : "not running"}).`);
    }

    installed = result;
    return result;
}
