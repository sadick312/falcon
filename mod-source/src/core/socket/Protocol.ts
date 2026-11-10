/**
 * Decides which MooMoo network protocol the client speaks.
 *
 * - "legacy" (1.8.2, e.g. sandbox.moomodding.io): plain msgpack `[type, data]`,
 *   no encryption, no captcha, `io-init` only carries the socket id.
 * - "modern" (1.9.x, sandbox.moomoo.io): encrypted + signed packets, turnstile captcha.
 *
 * Picked automatically from the page's host so the same bundle works on both.
 */
export interface LegacyServer {
    id: string;
    key: string;
    region: string;
    name: string;
    display_name: string;
    ip: string;
    port?: number;
    scheme?: string;
    playerCount: number;
    playerCapacity: number;
    isPrivate?: boolean;
}

declare global {
    interface Window {
        MOOMODDING_SERVERS?: LegacyServer[];
    }
}

export default class Protocol {
    static readonly isLegacy: boolean = !location.hostname.endsWith("moomoo.io");

    /** Server list that moomodding embeds in its page (falls back to fetching the page). */
    static async getLegacyServers(): Promise<LegacyServer[]> {
        if (Array.isArray(window.MOOMODDING_SERVERS)) return window.MOOMODDING_SERVERS;

        try {
            const html = await (await fetch("/", { cache: "no-store" })).text();
            const match = html.match(/MOOMODDING_SERVERS\s*=\s*(\[.*?\]);/s);
            if (match) {
                window.MOOMODDING_SERVERS = JSON.parse(match[1]);
                return window.MOOMODDING_SERVERS!;
            }
        } catch (e) {
            console.error("[Falcon] Could not load server list:", e);
        }

        return [];
    }

    static getLegacyWsUrl(server: LegacyServer) {
        const scheme = server.scheme || (location.protocol === "https:" ? "wss" : "ws");
        const port = server.port ? `:${server.port}` : (scheme === "wss" ? "" : ":3000");
        return `${scheme}://${server.ip}${port}`;
    }
}
