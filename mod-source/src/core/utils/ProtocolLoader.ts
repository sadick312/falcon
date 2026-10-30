import type { MooMooProtocol } from "@core/utils/CaptchaManager";
import Endpoints from "@constants/Endpoints";
import { NetworkError } from "@services/network/Http";

const PROTOCOL_IMPORT_NAME = "moomoo-protocol";

function importMapFrom(root: ParentNode): string | null {
    for (const script of Array.from(root.querySelectorAll<HTMLScriptElement>("script[type='importmap']"))) {
        try {
            const map = JSON.parse(script.textContent ?? "") as { imports?: Record<string, string> };
            const target = map.imports?.[PROTOCOL_IMPORT_NAME];
            if (typeof target === "string") return target;
        } catch {
            // malformed import map, try the next one
        }
    }

    return null;
}

/** The launcher stores the official page's HTML in window.oldHTML before replacing the document. */
function findProtocolPath(): string | null {
    const oldHTML = window.oldHTML;

    if (typeof oldHTML === "string") {
        const fromParsed = importMapFrom(new DOMParser().parseFromString(oldHTML, "text/html"));
        if (fromParsed) return fromParsed;

        // Fallback: tolerate markup the parser mangled.
        const match = oldHTML.match(/"moomoo-protocol"\s*:\s*"([^"]+)"/);
        if (match) return match[1];
    }

    return importMapFrom(document);
}

function isProtocol(mod: any): mod is MooMooProtocol {
    return !!mod
        && typeof mod.BUILD_ID === "string"
        && typeof mod.BUILD_SALT === "number"
        && typeof mod.mixKey === "function";
}

let cached: MooMooProtocol | undefined;

export default class ProtocolLoader {
    static async load(): Promise<MooMooProtocol> {
        if (cached) return cached;

        const override = Endpoints.config.protocolUrl;
        const path = override || findProtocolPath();

        if (!path) {
            throw new NetworkError(
                "protocol",
                `Could not find the '${PROTOCOL_IMPORT_NAME}' entry in the official page's import map. ` +
                `The page layout may have changed; set 'protocolUrl' in the falcon-endpoint-overrides setting.`
            );
        }

        const url = new URL(path, Endpoints.config.gameOrigin).toString();

        let mod: unknown;
        try {
            mod = await import(/* webpackIgnore: true */ url);
        } catch (err) {
            throw new NetworkError("protocol", `Failed to import protocol module (${url}): ${(err as Error).message}`);
        }

        if (!isProtocol(mod)) {
            throw new NetworkError("protocol", `Protocol module at ${url} no longer exports BUILD_ID, BUILD_SALT and mixKey as expected.`);
        }

        cached = mod;
        return mod;
    }
}
