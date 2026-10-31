import Client from "@core/Client";
import Endpoints, { REQUEST_TIMEOUT_MS, SERVER_LIST_RETRIES, SERVER_LIST_TTL_MS } from "@constants/Endpoints";
import { fetchJson, NetworkError } from "@services/network/Http";
import { showConnectionNotice } from "@ui/ConnectionError";
import { mainMenu } from "@ui/Loader";
import getElem from "@utils/dom/getElem";
import readJson from "@utils/storage/readJson";

export const serverBrowserPage = getElem<"div">("server-browser-page");
const connectToServerBtn = getElem<"button">("connection-server-btn");
const refreshServersBtn = getElem<"button">("refresh-server-browser-btn");
const serverBrowser = getElem<"div">("server-browser");
const serverBrowserLoadingText = getElem<"div">("server-browser-loading-text");
const cancelServerBrowser = getElem<"button">("cancel-server-browser-btn");

/** Entry from api-sandbox2.moomoo.io/servers. */
interface MooMooPublicServer {
    key: string;
    name: string;
    playerCapacity: 40;
    playerCount: number;
    regionName: string;
    auth: boolean;
    region: "eu" | "sea" | "na";
    version: string;
}

/** Entry from sandbox.moomodding.io/servers. `key` looks like "1:1" and `ip` is the websocket host. */
interface MooModdingServer {
    key: string;
    region: string;
    name: string;
    display_name: string;
    ip: string;
    port: number;
    playerCount: number;
    playerCapacity: number;
}

/** Server list entry in one shape for both sites. */
export interface GameServer {
    key: string;
    region: string;
    name: string;
    label: string;
    playerCount: number;
    capacity: number;
    /** Websocket host, e.g. "s1.moomodding.io" or "{key}.{region}.moomoo.io". */
    host: string;
}

const regionDescriptions: Record<string, string[]> = {
    eu: ["frank", "skibidi", "most active server somehow"],
    na: ["we eat shit", "miami tryhards", "wtf", "A server located in usa miami florida, home to the world's most zero-latency humans alive."],
    sea: ["no one plays here"]
};

const RECENT_SERVER_KEY = "falcon-recent-server";

const PING_TIMEOUT_MS = 3000;
/** Same limit the disclaimer gives for decent performance. */
const GOOD_PING_MS = 80;
const OK_PING_MS = 150;

export default class ServerBrowser {
    private static cache?: { at: number; data: GameServer[] };
    /** Bumped on every render so pings from an older list don't write into a newer one. */
    private static renderId = 0;
    private static inflight?: Promise<GameServer[]>;

    private static isServer(entry: unknown): entry is MooMooPublicServer | MooModdingServer {
        const e = entry as Record<string, unknown> | null | undefined;
        return !!e
            && typeof e.key === "string"
            && typeof e.region === "string"
            && typeof e.name === "string"
            && typeof e.playerCount === "number"
            && (Endpoints.serverListFormat !== "moomodding" || typeof e.ip === "string");
    }

    private static normalize(entry: MooMooPublicServer | MooModdingServer): GameServer {
        if (Endpoints.serverListFormat === "moomodding") {
            const server = entry as MooModdingServer;
            const port = typeof server.port === "number" && server.port !== 443 ? `:${server.port}` : "";

            return {
                key: server.key,
                region: server.region,
                name: server.name,
                label: server.display_name || `${server.region}:${server.name}`,
                playerCount: server.playerCount,
                capacity: typeof server.playerCapacity === "number" ? server.playerCapacity : 0,
                host: `${server.ip}${port}`
            };
        }

        const server = entry as MooMooPublicServer;
        return {
            key: server.key,
            region: server.region,
            name: server.name,
            label: `${server.regionName} ${server.name}`,
            playerCount: server.playerCount,
            capacity: 40,
            host: Endpoints.gameHost(server.key, server.region)
        };
    }

    private static async fetchList() {
        const raw = await fetchJson<unknown>(Endpoints.serverListUrl(), {}, {
            step: "server-list",
            timeoutMs: REQUEST_TIMEOUT_MS,
            retries: SERVER_LIST_RETRIES
        });

        if (!Array.isArray(raw)) {
            throw new NetworkError("server-list", "Server list response is not an array. The API may have changed.");
        }

        const servers = raw.filter((entry) => this.isServer(entry));
        if (raw.length > 0 && servers.length === 0) {
            throw new NetworkError("server-list", "Server list entries have an unexpected shape. The API may have changed.");
        }

        return servers.map((entry) => this.normalize(entry));
    }

    /** Cached for SERVER_LIST_TTL_MS; concurrent callers share one request. Throws NetworkError on failure. */
    static async getData(force = false): Promise<GameServer[]> {
        if (!force && this.cache && Date.now() - this.cache.at < SERVER_LIST_TTL_MS) return this.cache.data;
        if (this.inflight) return this.inflight;

        this.inflight = this.fetchList()
            .then((data) => {
                this.cache = { at: Date.now(), data };
                return data;
            })
            .finally(() => { this.inflight = undefined; });

        return this.inflight;
    }

    private static errorMessage(err: unknown) {
        return err instanceof Error ? err.message : String(err);
    }

    static selectedOption: GameServer | undefined;
    static selectionIndex = -1;

    private static select(index: number, serverData: GameServer) {
        if (this.selectionIndex >= 0) {
            getElem(`server-option-button-${this.selectionIndex}`).classList.remove("active");
        }

        this.selectionIndex = index;
        this.selectedOption = serverData;
        connectToServerBtn.classList.remove("disabled");
        getElem(`server-option-button-${index}`).classList.add("active");
    }

    private static appendOption(serverData: GameServer, index: number) {
        const button = document.createElement("button");
        button.id = `server-option-button-${index}`;
        button.classList.add("server-browser-option");

        const icon = document.createElement("div");
        icon.innerHTML = `<i class="material-symbols-outlined" style="color: var(--generic-white); font-size: 64px;">globe</i>`;

        const labelHolder = document.createElement("div");
        labelHolder.classList.add("server-browser-option-label-holder");

        const regionName = document.createElement("div");
        regionName.style = `color: var(--generic-white); font-size: 19px;`;
        regionName.innerText = serverData.label;

        const regionDescription = document.createElement("div");
        const descriptions = regionDescriptions[serverData.region] ?? [serverData.host];
        regionDescription.style = `text-align: left; max-width: 500px; color: var(--generic-white-2); font-size: 12px;`;
        regionDescription.innerText = descriptions[Math.floor(descriptions.length * Math.random())];

        const playerCountLabel = document.createElement("div");
        playerCountLabel.classList.add("server-browser-option-player-count");
        const playerCount = document.createElement("span");
        playerCount.innerText = String(serverData.playerCount);
        playerCountLabel.append(playerCount, `/${serverData.capacity}`);

        const pingLabel = document.createElement("div");
        pingLabel.id = `server-ping-${index}`;
        pingLabel.classList.add("server-browser-option-ping");
        pingLabel.innerText = "... ms";
        playerCountLabel.append(pingLabel);

        labelHolder.append(regionName, regionDescription);
        button.append(icon, labelHolder, playerCountLabel);

        button.onclick = () => {
            if (this.selectionIndex >= 0 && this.selectionIndex === index) {
                this.selectionIndex = index;
                this.selectedOption = serverData;
                connectToServerBtn.click();
                return;
            }

            this.select(index, serverData);
        };

        serverBrowser.appendChild(button);
    }

    /**
     * One HTTPS round trip to the game host's /ping endpoint, in ms, or null if it doesn't answer.
     * Opens no game connection. "/" would redirect to moomodding.io and time two requests.
     */
    private static async pingHost(host: string) {
        const url = `https://${host}/ping`;

        const once = async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
            const start = performance.now();

            try {
                await fetch(url, { mode: "no-cors", cache: "no-store", signal: controller.signal });
                return performance.now() - start;
            } catch {
                return null;
            } finally {
                clearTimeout(timer);
            }
        };

        // The first request also pays for DNS and TLS, so only the later ones count.
        if (await once() === null) return null;

        const a = await once();
        const b = await once();
        if (a === null || b === null) return a ?? b;
        return Math.min(a, b);
    }

    private static async showPings(data: GameServer[], renderId: number) {
        await Promise.all(data.map(async (server, index) => {
            const ping = await this.pingHost(server.host);
            if (renderId !== this.renderId) return;

            const label = document.getElementById(`server-ping-${index}`);
            if (!label) return;

            if (ping === null) {
                label.innerText = "? ms";
                return;
            }

            label.innerText = `${Math.round(ping)} ms`;
            label.style.color = ping <= GOOD_PING_MS ? "#7bd88f" : ping <= OK_PING_MS ? "#e6c86e" : "#ff6b6b";
        }));
    }

    private static async render(force = false) {
        const renderId = ++this.renderId;
        this.selectionIndex = -1;
        this.selectedOption = undefined;
        connectToServerBtn.classList.add("disabled");

        serverBrowserLoadingText.style.display = "flex";
        for (let i = 1; i < serverBrowser.children.length; i++) {
            serverBrowser.children[i].remove();
            i--;
        }

        let data: GameServer[];
        try {
            data = [...await this.getData(force)];
        } catch (err) {
            serverBrowserLoadingText.style.display = "none";
            refreshServersBtn.classList.remove("disabled");
            showConnectionNotice("server-list", this.errorMessage(err));
            return;
        }

        data.sort((a, b) => b.playerCount - a.playerCount);

        for (let i = 0; i < data.length; i++) {
            this.appendOption(data[i], i);
        }

        // Preselect the server the page was opened with (sandbox.moomodding.io/?server=1:1).
        const requested = Endpoints.requestedServerKey();
        const requestedIndex = requested ? data.findIndex(e => e.key === requested) : -1;
        if (requestedIndex >= 0) this.select(requestedIndex, data[requestedIndex]);

        serverBrowserLoadingText.style.display = "none";
        refreshServersBtn.classList.remove("disabled");
        this.showPings(data, renderId);
    }

    static async getHighest(region: string) {
        try {
            const data = await this.getData();
            return data.filter(e => e.region === region).sort((a, b) => b.playerCount - a.playerCount)[0];
        } catch (err) {
            showConnectionNotice("server-list", this.errorMessage(err));
            return undefined;
        }
    }

    /** The server, null when it no longer exists, undefined when the list couldn't be fetched. */
    static async find(key: string, region: string): Promise<GameServer | null | undefined> {
        try {
            const data = await this.getData();
            return data.find(e => e.key === key && e.region === region) ?? null;
        } catch (err) {
            showConnectionNotice("server-list", this.errorMessage(err));
            return undefined;
        }
    }

    static saveRecent(server: GameServer) {
        localStorage.setItem(RECENT_SERVER_KEY, JSON.stringify({ mode: Endpoints.mode, key: server.key, region: server.region }));
    }

    /** Last server joined on this site, or null. Ignores entries saved on the other site or in the old "key:region:name" format. */
    static getRecent(): { key: string; region: string } | null {
        // readJson returns null for the old format or a corrupt value.
        const saved = readJson<{ mode?: unknown; key?: unknown; region?: unknown } | null>(RECENT_SERVER_KEY, null);
        if (saved?.mode === Endpoints.mode && typeof saved.key === "string" && typeof saved.region === "string") {
            return { key: saved.key, region: saved.region };
        }

        return null;
    }

    static async start() {
        mainMenu.style.display = "none";
        serverBrowserPage.style.display = "flex";

        this.render();

        connectToServerBtn.onclick = () => {
            Client.connect();
        };

        refreshServersBtn.onclick = () => {
            refreshServersBtn.classList.add("disabled");
            this.render(true);
        };

        cancelServerBrowser.onclick = () => {
            this.selectedOption = undefined;
            this.selectionIndex = -1;

            mainMenu.style.display = "flex";
            serverBrowserPage.style.display = "none";
        };
    }
}