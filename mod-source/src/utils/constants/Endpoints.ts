/**
 * Single source of truth for every MooMoo network endpoint Falcon talks to.
 *
 * If the official API changes, edit DEFAULTS below (or, without rebuilding, set the
 * `falcon-endpoint-overrides` key in localStorage to a JSON object with any of the same keys).
 *
 * NOTE: these defaults are the values the project shipped with. They have NOT been re-verified
 * against the live site. Compare them with DevTools > Network on sandbox.moomoo.io.
 */

export interface EndpointConfig {
    /** Origin of the REST API (server list + join). */
    apiOrigin: string;
    /** Origin of the official game page (serves the import map that points at the protocol module). */
    gameOrigin: string;
    serverListPath: string;
    /** Value of the `v` query param on the server list request. */
    serverListVersion: string;
    joinPath: string;
    /** Domain suffix of game servers: `{key}.{region}.{gameServerDomain}`. */
    gameServerDomain: string;
    /** Optional absolute URL of the protocol module; skips the import-map lookup when set. */
    protocolUrl: string;
    turnstileSiteKey: string;
}

const DEFAULTS: EndpointConfig = {
    apiOrigin: "https://api-sandbox2.moomoo.io",
    gameOrigin: "https://sandbox.moomoo.io",
    serverListPath: "/servers",
    serverListVersion: "1.28",
    joinPath: "/join",
    gameServerDomain: "moomoo.io",
    protocolUrl: "",
    turnstileSiteKey: "0x4AAAAAAAMYHI96GFiJzMmp"
};

const OVERRIDE_KEY = "falcon-endpoint-overrides";
const ORIGIN_KEYS: (keyof EndpointConfig)[] = ["apiOrigin", "gameOrigin", "protocolUrl"];

/** Overridden hosts must stay on *.moomoo.io over https, so a bad override can't leak the captcha token elsewhere. */
function isTrustedUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && (url.hostname === "moomoo.io" || url.hostname.endsWith(".moomoo.io"));
    } catch {
        return false;
    }
}

function loadConfig(): EndpointConfig {
    const config = { ...DEFAULTS };

    try {
        const raw = localStorage.getItem(OVERRIDE_KEY);
        if (!raw) return config;

        const overrides = JSON.parse(raw) as Partial<EndpointConfig>;
        for (const key of Object.keys(DEFAULTS) as (keyof EndpointConfig)[]) {
            const value = overrides[key];
            if (typeof value !== "string" || value === "") continue;

            if (ORIGIN_KEYS.includes(key) && !isTrustedUrl(value)) {
                console.warn(`[Falcon] Ignoring override for '${key}': must be an https *.moomoo.io URL.`);
                continue;
            }

            config[key] = value;
        }
    } catch (err) {
        console.warn("[Falcon] Could not read endpoint overrides.", err);
    }

    return config;
}

const config = loadConfig();

export const LOCAL_SERVER_HOST = "localhost:1234";

export const REQUEST_TIMEOUT_MS = 8000;
export const SERVER_LIST_RETRIES = 2;
export const SERVER_LIST_TTL_MS = 15_000;
export const HANDSHAKE_TIMEOUT_MS = 10_000;

const Endpoints = {
    config,

    serverListUrl() {
        const url = new URL(config.serverListPath, config.apiOrigin);
        url.searchParams.set("v", config.serverListVersion);
        return url.toString();
    },

    joinUrl() {
        return new URL(config.joinPath, config.apiOrigin).toString();
    },

    isLocalHost(host: string) {
        return host.includes("localhost");
    },

    /** `{key}.{region}.moomoo.io` */
    gameHost(key: string, region: string) {
        return `${key}.${region}.${config.gameServerDomain}`;
    },

    socketUrl(host: string, ticket: string, buildId: string) {
        const scheme = this.isLocalHost(host) ? "ws://" : "wss://";
        return `${scheme}${host}/?token=${encodeURIComponent(`tk:${ticket}`)}&b=${buildId}`;
    }
};

export default Endpoints;
