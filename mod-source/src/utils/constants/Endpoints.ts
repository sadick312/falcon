import { detectVersion } from "@constants/GameVersion";

/**
 * Single source of truth for every network endpoint Falcon talks to.
 *
 * Falcon runs on two sites. The profile is picked from location.hostname at startup:
 * - "moomoo-sandbox": sandbox.moomoo.io (v1.9.0). Captcha + /join ticket, mixKey-encrypted packets.
 * - "moomodding":     sandbox.moomodding.io (v1.8.2 and v1.6.9 clients, one v1.8.2 server). Fixed token
 *                     the site itself sends, plain msgpack. The client version is detected from the page.
 *
 * To change a value without rebuilding, set the `falcon-endpoint-overrides` key in localStorage
 * to a JSON object with any of the EndpointConfig keys.
 */

export type HostMode = "moomoo-sandbox" | "moomodding";

/**
 * "ticket": Turnstile captcha, POST /join for a ticket, protocol module + mixKey encryption.
 * "static": no join request; connect with `staticToken` and send plain msgpack.
 */
export type HandshakeKind = "ticket" | "static";

export type ServerListFormat = "moomoo" | "moomodding";

export interface EndpointConfig {
    /** Origin of the REST API (server list + join). */
    apiOrigin: string;
    /** Origin of the official game page (serves the import map that points at the protocol module). */
    gameOrigin: string;
    serverListPath: string;
    /** Value of the `v` query param on the server list request. Empty = no param. */
    serverListVersion: string;
    joinPath: string;
    /** Domain suffix of game servers: `{key}.{region}.{gameServerDomain}`. Only used by the "moomoo" list format. */
    gameServerDomain: string;
    /** Optional absolute URL of the protocol module; skips the import-map lookup when set. */
    protocolUrl: string;
    turnstileSiteKey: string;
    /** Token sent as `?token=` by "static" handshakes. */
    staticToken: string;
}

interface HostProfile {
    mode: HostMode;
    /** Page hostnames this profile is used on. */
    pageHosts: string[];
    /** Overridden origins must be https on this domain or a subdomain of it. */
    trustedDomain: string;
    handshake: HandshakeKind;
    serverListFormat: ServerListFormat;
    defaults: EndpointConfig;
}

const PROFILES: Record<HostMode, HostProfile> = {
    "moomoo-sandbox": {
        mode: "moomoo-sandbox",
        pageHosts: ["sandbox.moomoo.io"],
        trustedDomain: "moomoo.io",
        handshake: "ticket",
        serverListFormat: "moomoo",
        defaults: {
            apiOrigin: "https://api-sandbox2.moomoo.io",
            gameOrigin: "https://sandbox.moomoo.io",
            serverListPath: "/servers",
            serverListVersion: "1.28",
            joinPath: "/join",
            gameServerDomain: "moomoo.io",
            protocolUrl: "",
            turnstileSiteKey: "0x4AAAAAAAMYHI96GFiJzMmp",
            staticToken: ""
        }
    },
    moomodding: {
        mode: "moomodding",
        pageHosts: ["sandbox.moomodding.io"],
        trustedDomain: "moomodding.io",
        handshake: "static",
        serverListFormat: "moomodding",
        defaults: {
            apiOrigin: "https://sandbox.moomodding.io",
            gameOrigin: "https://sandbox.moomodding.io",
            serverListPath: "/servers",
            serverListVersion: "",
            joinPath: "",
            gameServerDomain: "",
            protocolUrl: "",
            turnstileSiteKey: "",
            // The site's own hackfix.js answers its Turnstile stub with this fixed value; the server expects it.
            staticToken: "cf:cf_token_moomodding"
        }
    }
};

function detectProfile(): HostProfile {
    const host = location.hostname;
    for (const profile of Object.values(PROFILES)) {
        if (profile.pageHosts.includes(host)) return profile;
    }

    return PROFILES["moomoo-sandbox"];
}

const profile = detectProfile();
const detected = detectVersion(profile.mode === "moomodding");

console.log(
    `[Falcon] Client version ${detected.reported} (from ${detected.source}), ` +
    `using the v${detected.profile.version} profile, ${detected.profile.wire} wire protocol` +
    (detected.verified ? "." : ". This version is not verified; report problems with it.")
);

const OVERRIDE_KEY = "falcon-endpoint-overrides";
const ORIGIN_KEYS: (keyof EndpointConfig)[] = ["apiOrigin", "gameOrigin", "protocolUrl"];

/** Overridden hosts must stay on the profile's domain over https, so a bad override can't leak tokens elsewhere. */
function isTrustedUrl(value: string) {
    try {
        const url = new URL(value);
        const domain = profile.trustedDomain;
        return url.protocol === "https:" && (url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    } catch {
        return false;
    }
}

function loadConfig(): EndpointConfig {
    const config = { ...profile.defaults };

    try {
        const raw = localStorage.getItem(OVERRIDE_KEY);
        if (!raw) return config;

        const overrides = JSON.parse(raw) as Partial<EndpointConfig>;
        for (const key of Object.keys(config) as (keyof EndpointConfig)[]) {
            const value = overrides[key];
            if (typeof value !== "string" || value === "") continue;

            if (ORIGIN_KEYS.includes(key) && !isTrustedUrl(value)) {
                console.warn(`[Falcon] Ignoring override for '${key}': must be an https *.${profile.trustedDomain} URL.`);
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
    mode: profile.mode,
    /** Client version profile; decides the packet layout conversion and which features are available. */
    version: detected,
    handshake: profile.handshake,
    serverListFormat: profile.serverListFormat,

    serverListUrl() {
        const url = new URL(config.serverListPath, config.apiOrigin);
        if (config.serverListVersion) url.searchParams.set("v", config.serverListVersion);
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

    /** `?server=` from the page URL, e.g. "1:1" on sandbox.moomodding.io. */
    requestedServerKey() {
        return new URLSearchParams(location.search).get("server");
    },

    /** "ticket" handshakes pass the join ticket and build id; "static" ones use the profile's fixed token. */
    socketUrl(host: string, ticket?: string, buildId?: string) {
        const scheme = this.isLocalHost(host) ? "ws://" : "wss://";

        if (profile.handshake === "static" || ticket === undefined) {
            return `${scheme}${host}/?token=${encodeURIComponent(config.staticToken)}`;
        }

        return `${scheme}${host}/?token=${encodeURIComponent(`tk:${ticket}`)}&b=${buildId}`;
    }
};

export default Endpoints;
