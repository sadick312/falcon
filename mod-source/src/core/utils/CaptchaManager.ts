import Client from "@core/Client";
import Endpoints from "@constants/Endpoints";
import Socket, { MixKeyFunc } from "@core/socket/Socket";
import SocketListener from "@core/socket/SocketListener";
import ProtocolLoader from "@core/utils/ProtocolLoader";
import { fetchJson, NetworkError } from "@services/network/Http";
import { REQUEST_TIMEOUT_MS } from "@constants/Endpoints";
import { showConnectionError } from "@ui/ConnectionError";
import getElem from "@utils/dom/getElem";

declare const turnstile: Turnstile.Turnstile;

interface ServerJoinRequest {
    ticket: string;
    did: string;
    name: string;
}

export interface MooMooProtocol {
    BUILD_ID: string;
    BUILD_SALT: number;
    mixKey: MixKeyFunc;
}

export default class CaptchaManager {
    private static widgetId: string | null | undefined = null;

    /** Resolves with a Turnstile token, or rejects with a readable reason. Always cleans up the widget. */
    private static solveChallenge(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (typeof turnstile === "undefined") {
                reject(new NetworkError("captcha", "Cloudflare Turnstile script did not load (blocked or offline?)"));
                return;
            }

            this.widgetId = turnstile.render(getElem("turnstile-holder"), {
                sitekey: Endpoints.config.turnstileSiteKey,
                theme: "light",
                callback: (token) => resolve(token),
                "error-callback": (code) => reject(new NetworkError("captcha", `Turnstile error ${code}`)),
                "timeout-callback": () => reject(new NetworkError("captcha", "Challenge timed out")),
                "unsupported-callback": () => reject(new NetworkError("captcha", "Browser not supported by Turnstile"))
            });
        }).finally(() => {
            if (typeof this.widgetId === "string") {
                turnstile.remove(this.widgetId);
                this.widgetId = null;
            }
        });
    }

    private static async join(wsAddress: string, captchaToken: string): Promise<ServerJoinRequest> {
        const data = await fetchJson<Partial<ServerJoinRequest>>(Endpoints.joinUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                captcha: captchaToken,
                did: localStorage.getItem("moo_did") ?? undefined,
                host: wsAddress
            })
        }, { step: "join", timeoutMs: REQUEST_TIMEOUT_MS });

        if (typeof data?.ticket !== "string" || typeof data?.did !== "string") {
            throw new NetworkError("join", "Join response is missing 'ticket' or 'did'. The join API may have changed.");
        }

        return data as ServerJoinRequest;
    }

    static async renderChallenge(wsAddress: string) {
        // moomodding.io: no captcha, join request or protocol module. Connect with the site's token and send plain msgpack.
        if (Endpoints.handshake === "static") {
            Client.socket = new Socket(Endpoints.socketUrl(wsAddress), null);
            SocketListener.hookEvents(Client.socket);
            return;
        }

        let step: "protocol" | "captcha" | "join" = "protocol";

        try {
            // Resolve the protocol first so we don't spend a captcha / single-use ticket if it can't be found.
            const protocol = await ProtocolLoader.load();

            step = "captcha";
            const captchaToken = Endpoints.isLocalHost(wsAddress) ? "lol" : await this.solveChallenge();

            step = "join";
            const joined = await this.join(wsAddress, captchaToken);
            localStorage.setItem("moo_did", joined.did);

            Client.socket = new Socket(Endpoints.socketUrl(wsAddress, joined.ticket, protocol.BUILD_ID), protocol);
            SocketListener.hookEvents(Client.socket);
        } catch (err) {
            const failedStep = err instanceof NetworkError ? err.step as typeof step : step;
            showConnectionError(failedStep, err instanceof Error ? err.message : String(err));
        }
    }

    static reset() {
        if (!this.widgetId) return;

        turnstile.reset(this.widgetId);
        this.widgetId = null;
    }
}
