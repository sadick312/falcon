/**
 * Single source of truth for every network endpoint Falcon talks to.
 *
 * Falcon runs on two sites. The profile is picked from location.hostname at startup:
 * - "moomoo-sandbox": sandbox.moomoo.io (v1.9.0). Captcha + /join ticket, mixKey-encrypted packets.
 * - "moomodding":     sandbox.moomodding.io (v1.8.2). Fixed token the site itself sends, plain msgpack.
 *
 * To change a value without rebuilding, set the `falcon-endpoint-overrides` key in localStorage
 * to a JSON object with any of the EndpointConfig keys.
 */
import { GAME_V182, GameVersion } from "@constants/gameVersion";
import readJson from "@utils/storage/readJson";

export type HostMode = "moomoo-sandbox" | "moomodding";

/**
 * "ticket": Turnstile captcha, POST /join for a ticket, protocol module + mixKey encryption.
 * "static": no join request; connect with `staticToken` and send plain msgpack.
 */
type HandshakeKind = "ticket" | "static";

type ServerListFormat = "moomoo" | "moomodding";

interface EndpointConfig {
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
    gameVersion: GameVersion;
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
        gameVersion: "1.9.0",
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
        // "1.8.2" packet layouts are converted by LegacyPacketAdapter.
        gameVersion: GAME_V182.version,
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
            staticToken: GAME_V182.socketToken
        }
    }
};

/** On a localhost test page, `falcon-host-mode` in localStorage picks the profile (e.g. "moomodding"). */
function localTestProfile(): HostProfile | null {
    if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return null;

    try {
        const mode = localStorage.getItem("falcon-host-mode") as HostMode | null;
        return mode && mode in PROFILES ? PROFILES[mode] : null;
    } catch {
        return null;
    }
}

function detectProfile(): HostProfile {
    const testProfile = localTestProfile();
    if (testProfile) return testProfile;

    const host = location.hostname;
    for (const profile of Object.values(PROFILES)) {
        if (profile.pageHosts.includes(host)) return profile;
    }

    return PROFILES["moomoo-sandbox"];
}

const profile = detectProfile();

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
        const overrides = readJson<Partial<EndpointConfig> | null>(OVERRIDE_KEY, null);
        if (!overrides || typeof overrides !== "object") return config;

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
    gameVersion: profile.gameVersion,
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
