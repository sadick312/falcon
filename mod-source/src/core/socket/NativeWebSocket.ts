/**
 * An untouched WebSocket class for Falcon's socket to extend.
 *
 * moomodding.io's hackfix.js still runs under Quick Inject's "Bundle Replacement" (only bundle.js is
 * blocked), and it patches the page's WebSocket:
 * - v1.8.2 and v1.6.9 replace window.WebSocket with a function that returns a plain native socket.
 *   `class Socket extends WebSocket` then gets that plain object as `this`, without Socket's methods.
 * - v1.6.9 also patches WebSocket.prototype.send to rename packet codes for its old bundle, which
 *   turns Falcon's MOVE ("9") into leave clan, SEND_CHAT ("6") into upgrade and STORE ("c") into hit.
 *
 * When either patch is present, the class comes from a hidden same-origin iframe, whose globals
 * hackfix never touched. The iframe stays in the document: its sockets close if it is removed.
 */

function isNative(fn: unknown) {
    return typeof fn === "function" && /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(fn));
}

export function isWebSocketPatched(win: Window = window) {
    const ws = (win as any).WebSocket;
    return !isNative(ws) || !isNative(ws?.prototype?.send);
}

function fromCleanFrame(): typeof WebSocket | null {
    try {
        const frame = document.createElement("iframe");
        frame.style.display = "none";
        frame.setAttribute("aria-hidden", "true");
        document.documentElement.appendChild(frame);

        const clean = frame.contentWindow as (Window & typeof globalThis) | null;
        if (!clean || isWebSocketPatched(clean)) return null;

        return clean.WebSocket;
    } catch (err) {
        console.warn("[Falcon] Could not create a clean WebSocket frame.", err);
        return null;
    }
}

function resolveWebSocket(): typeof WebSocket {
    if (!isWebSocketPatched()) return WebSocket;

    const clean = fromCleanFrame();
    if (clean) {
        console.log("[Falcon] The page patched WebSocket (hackfix.js); using an unpatched one.");
        return clean;
    }

    console.error("[Falcon] The page patched WebSocket and no clean copy was found. Packets may be rewritten.");
    return WebSocket;
}

const NativeWebSocket = resolveWebSocket();
export default NativeWebSocket;
