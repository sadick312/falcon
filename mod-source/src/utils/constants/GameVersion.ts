/**
 * Which game client version the page runs, and what that means for Falcon.
 *
 * Falcon replaces the page's bundle and talks to the game server itself, so the codes a client's
 * bundle.js uses ("33", "sp", "ch" on v1.6.9) never reach Falcon. What matters is:
 * - the wire protocol the server speaks (moomodding.io runs one server for every client version and
 *   speaks the v1.8.2 protocol; each version's hackfix.js translates for its old bundle), and
 * - what the page's hackfix.js does to window.WebSocket, which Falcon has to get around.
 *
 * Verified on 2026-10-29 against sandbox.moomodding.io/1.6.9/bundle.js, /1.8.2/assets/index-*.js
 * and both hackfix.js files. See docs/VERSION-SUPPORT.md for the tables and how to re-check them.
 */

export type ClientVersion = "1.9.0" | "1.8.2" | "1.6.9";

/** How the server frames packets. Both are converted to the v1.9.0 layout the handlers parse. */
export type WireProtocol =
    /** sandbox.moomoo.io: mixKey-encrypted, split player updates, dir * 100. */
    | "v1.9.0"
    /** moomodding.io: plain msgpack, flat player/ai arrays, plain radians. Converted by LegacyPacketAdapter. */
    | "v1.8.2";

export interface VersionProfile {
    version: ClientVersion;
    wire: WireProtocol;
    /** The page's hackfix.js rewrites packet codes in WebSocket.prototype.send (v1.6.9 only). */
    hackfixTranslatesPackets: boolean;
    /** Packet codes the page's own bundle uses, canonical (v1.9.0) code -> bundle code. Reference only: Falcon never sends these. */
    bundleCodes: { clientToServer: Record<string, string>; serverToClient: Record<string, string> };
    /** Menu item id -> reason. Listed features are switched off and locked in the menu on this version. */
    unsupportedFeatures: Record<string, string>;
}

/** v1.6.9 bundle codes, read from its socket handler map and its send() calls. Same table as its hackfix.js. */
const V169_CODES = {
    clientToServer: {
        M: "sp", D: "2", "9": "33", e: "rmd", F: "c", z: "5", H: "6", K: "7",
        L: "8", N: "9", b: "10", P: "11", Q: "12", c: "13c", "6": "ch", S: "14", "0": "pp"
    },
    serverToClient: {
        A: "id", B: "d", C: "1", D: "2", E: "4", a: "33", G: "5", H: "6", I: "a", J: "aa",
        K: "7", L: "8", M: "sp", N: "9", O: "h", P: "11", Q: "12", R: "13", S: "14", T: "15",
        U: "16", V: "17", X: "18", Y: "19", Z: "20", g: "ac", "1": "ad", "2": "an", "3": "st",
        "4": "sa", "5": "us", "6": "ch", "7": "mm", "8": "t", "9": "p", "0": "pp"
    }
};

const SAME_CODES = { clientToServer: {}, serverToClient: {} };

export const VERSION_PROFILES: Record<ClientVersion, VersionProfile> = {
    "1.9.0": {
        version: "1.9.0",
        wire: "v1.9.0",
        hackfixTranslatesPackets: false,
        bundleCodes: SAME_CODES,
        unsupportedFeatures: {}
    },
    "1.8.2": {
        version: "1.8.2",
        wire: "v1.8.2",
        hackfixTranslatesPackets: false,
        bundleCodes: SAME_CODES,
        unsupportedFeatures: {}
    },
    "1.6.9": {
        version: "1.6.9",
        wire: "v1.8.2",
        hackfixTranslatesPackets: true,
        bundleCodes: V169_CODES,
        unsupportedFeatures: {}
    }
};

export interface DetectedVersion {
    profile: VersionProfile;
    /** The version string the page reported, which may have no profile of its own (e.g. "1.7.4"). */
    reported: string;
    /** Where the version came from, for the log line. */
    source: string;
    /** false when Falcon fell back to a profile it has not been checked against. */
    verified: boolean;
}

const VERSION_PATTERN = /\/(\d+\.\d+\.\d+(?:\.\d+)?)\/(?:bundle\.js|hackfix\.js|assets\/)/;
const BASE_PATTERN = /<base\s+href=["']\/(\d+\.\d+\.\d+(?:\.\d+)?)\/["']/i;

/** The official page's HTML: the loaders keep it in window.oldHTML before swapping the document. */
function pageHTML(): string {
    const oldHTML = (window as any).oldHTML;
    return typeof oldHTML === "string" ? oldHTML : document.documentElement.outerHTML;
}

function readCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
}

/** Finds the client version moomodding.io served, most reliable source first. */
function detectMoomoddingVersion(): { reported: string; source: string } | null {
    const html = pageHTML();

    const base = html.match(BASE_PATTERN);
    if (base) return { reported: base[1], source: "<base href>" };

    const script = html.match(VERSION_PATTERN);
    if (script) return { reported: script[1], source: "bundle path" };

    // The launcher stores the chosen version in this cookie; the page is served from it.
    const cookie = readCookie("moo_version");
    if (cookie) return { reported: cookie, source: "moo_version cookie" };

    if ((window as any).__mooHackfixActive_169) return { reported: "1.6.9", source: "hackfix flag" };

    return null;
}

export function detectVersion(isMoomodding: boolean): DetectedVersion {
    if (!isMoomodding) {
        return { profile: VERSION_PROFILES["1.9.0"], reported: "1.9.0", source: "host", verified: true };
    }

    const found = detectMoomoddingVersion();
    const reported = found?.reported ?? "unknown";
    const profile = VERSION_PROFILES[reported as ClientVersion];

    if (profile && profile.version !== "1.9.0") {
        return { profile, reported, source: found!.source, verified: true };
    }

    // Every moomodding.io version shares the v1.8.2 server, so its profile is the safe fallback.
    // Only the 1.6.9 hackfix rewrites packets, and Falcon's socket bypasses hackfix either way.
    return { profile: VERSION_PROFILES["1.8.2"], reported, source: found?.source ?? "none", verified: false };
}
