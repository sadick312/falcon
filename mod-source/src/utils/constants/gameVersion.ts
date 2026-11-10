/**
 * Everything specific to the MooMoo.io game version Falcon supports on sandbox.moomodding.io.
 * When the site updates the game, compare its client script with these values first; the rest of Falcon
 * reads them from here. Game data (items, hats, map size, speeds) is the same as in other versions and
 * stays in items.ts, store.ts and scriptConfiguration.json.
 */

/** Game client versions Falcon knows. "1.9.0" is the official sandbox.moomoo.io. */
export type GameVersion = "1.9.0" | "1.8.2";

/** The version sandbox.moomodding.io runs and Falcon is checked against. */
export const SUPPORTED_GAME_VERSION = "1.8.2" satisfies GameVersion;

export const GAME_V182 = {
    version: "1.8.2",

    /**
     * Where the version shows on the game page: the page serves its files from /1.8.2/ via
     * `<base href="/1.8.2/">` (and sets `app_version = '1.8.2'` in an inline script).
     */
    pageBasePath: "/1.8.2/",

    /**
     * The site's current page (since early Nov 2026) has neither marker: `<base href="/">` and the game in
     * `/assets/bundle.js` ("MooModding.io - Deobfuscated Readable Client Bundle"). Checked on 10 Nov 2026: it speaks
     * this same 1.8.2 protocol (same 17 sent and 36 received packet letters, 13 values per player, 7 per animal,
     * plain msgpack) and has the same items, hats and timings, so that page counts as 1.8.2.
     */
    pageScript: "/assets/bundle.js",

    /** `?token=` on the game socket. The site's hackfix.js answers its Turnstile stub with this; the server expects it. */
    socketToken: "cf:cf_token_moomodding",

    /** Values per player in UPDATE_PLAYERS ("a"): sid, x, y, dir, then ATTRIBUTE_COUNT attributes. */
    playerStride: 13,
    /** buildIndex, weaponIndex, weaponVariant, team, isLeader, skinIndex, tailIndex, iconIndex, zIndex. */
    attributeCount: 9,
    /** Values per animal in LOAD_AI ("I"): sid, index, x, y, dir, health, nameIndex. */
    aiStride: 7,

    /** io-init's 4th value when the server wants shuffled packet ids and signed packets. */
    cipherMode: 1,
    /** The client's fixed salt for the cipher's table seeds (it has no protocol module). */
    cipherTableSalt: 1,

    /**
     * The client's packet lists, in its own order (its `bo` and `To` arrays). The cipher shuffles these, so length
     * and order must match the game exactly. They are the v1.9.0 lists without T, R, A, V (sent) and W, F (received).
     */
    clientToServer: ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"],
    serverToClient: [
        "A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R",
        "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"
    ]
} as const;
