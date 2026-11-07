import Endpoints, { HostMode } from "@constants/Endpoints";
import { GAME_V182, SUPPORTED_GAME_VERSION } from "@constants/gameVersion";

/** The game version the original page was built for, from its `<base href="/x.y.z/">` or `app_version = 'x.y.z'`. */
export function readGameVersion(pageHtml: string): string | null {
    const fromBase = pageHtml.match(/<base\s+href=["']\/(\d+\.\d+\.\d+)\/["']/i);
    if (fromBase?.[1]) return fromBase[1];

    const fromScript = pageHtml.match(/app_version\s*=\s*["'](\d+\.\d+\.\d+)["']/);
    return fromScript?.[1] ?? null;
}

/**
 * Logs whether the game page Falcon replaced runs the version it supports. Only on sandbox.moomodding.io, the site
 * that serves a specific old version; the loaders save the page in window.oldHTML before replacing it.
 * Returns the version found, or null.
 */
export function checkGameVersion(pageHtml: string | undefined = window.oldHTML, mode: HostMode = Endpoints.mode): string | null {
    if (mode !== "moomodding") return null;

    const version = typeof pageHtml === "string" ? readGameVersion(pageHtml) : null;

    if (version === null) {
        console.warn(`[Falcon] Could not read the game version from the page (expected ${GAME_V182.pageBasePath}). Falcon supports MooMoo.io v${SUPPORTED_GAME_VERSION}.`);
    } else if (version !== SUPPORTED_GAME_VERSION) {
        console.warn(`[Falcon] This page runs MooMoo.io v${version}, but Falcon supports v${SUPPORTED_GAME_VERSION}. Packets or items may have changed, so expect errors. Version-specific values are in mod-source/src/utils/constants/gameVersion.ts.`);
    } else {
        console.info(`[Falcon] Game version v${version} (supported).`);
    }

    return version;
}
