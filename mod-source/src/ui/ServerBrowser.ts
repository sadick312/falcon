import Client from "@core/Client";
import Endpoints, { REQUEST_TIMEOUT_MS, SERVER_LIST_RETRIES, SERVER_LIST_TTL_MS } from "@constants/Endpoints";
import { fetchJson, NetworkError } from "@services/network/Http";
import { showConnectionNotice } from "@ui/ConnectionError";
import { mainMenu } from "@ui/Loader";
import getElem from "@utils/dom/getElem";

export const serverBrowserPage = getElem<"div">("server-browser-page");
const connectToServerBtn = getElem<"button">("connection-server-btn");
const refreshServersBtn = getElem<"button">("refresh-server-browser-btn");
const serverBrowser = getElem<"div">("server-browser");
const serverBrowserLoadingText = getElem<"div">("server-browser-loading-text");
const cancelServerBrowser = getElem<"button">("cancel-server-browser-btn");

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

const regionDescriptions = {
    eu: ["frank", "skibidi", "most active server somehow"],
    na: ["we eat shit", "miami tryhards", "wtf", "A server located in usa miami florida, home to the world's most zero-latency humans alive."],
    sea: ["no one plays here"]
};

export default class ServerBrowser {
    private static cache?: { at: number; data: MooMooPublicServer[] };
    private static inflight?: Promise<MooMooPublicServer[]>;

    private static isServer(entry: any): entry is MooMooPublicServer {
        return !!entry
            && typeof entry.key === "string"
            && typeof entry.region === "string"
            && typeof entry.name === "string"
            && typeof entry.playerCount === "number";
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

        return servers;
    }

    /** Cached for SERVER_LIST_TTL_MS; concurrent callers share one request. Throws NetworkError on failure. */
    static async getData(force = false): Promise<MooMooPublicServer[]> {
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

    static selectedOption: MooMooPublicServer | undefined;
    static selectionIndex = -1;

    private static appendOption(serverData: MooMooPublicServer, index: number) {
        const button = document.createElement("button");
        button.id = `server-option-button-${index}`;
        button.classList.add("server-browser-option");

        const icon = document.createElement("div");
        icon.innerHTML = `<i class="material-symbols-outlined" style="color: var(--generic-white); font-size: 64px;">globe</i>`;

        const labelHolder = document.createElement("div");
        labelHolder.classList.add("server-browser-option-label-holder");

        const regionName = document.createElement("div");
        regionName.style = `color: var(--generic-white); font-size: 19px;`;
        regionName.innerText = `${serverData.regionName} ${serverData.name}`;

        const regionDescription = document.createElement("div");
        const descriptions = regionDescriptions[serverData.region];
        regionDescription.style = `text-align: left; max-width: 500px; color: var(--generic-white-2); font-size: 12px;`;
        regionDescription.innerText = descriptions[Math.floor(descriptions.length * Math.random())];

        const playerCountLabel = document.createElement("div");
        playerCountLabel.classList.add("server-browser-option-player-count");
        playerCountLabel.innerHTML = `<span>${serverData.playerCount}</span>/40`;

        labelHolder.append(regionName, regionDescription);
        button.append(icon, labelHolder, playerCountLabel);

        button.onclick = () => {
            if (this.selectionIndex >= 0 && this.selectionIndex === index) {
                this.selectionIndex = index;
                this.selectedOption = serverData;
                connectToServerBtn.click();
                return;
            }

            if (this.selectionIndex >= 0) {
                getElem(`server-option-button-${this.selectionIndex}`).classList.remove("active");
            }

            this.selectionIndex = index;
            this.selectedOption = serverData;
            connectToServerBtn.classList.remove("disabled");
            getElem(`server-option-button-${index}`).classList.add("active");
        };

        serverBrowser.appendChild(button);
    }

    private static async render(force = false) {
        this.selectionIndex = -1;
        this.selectedOption = undefined;
        connectToServerBtn.classList.add("disabled");

        serverBrowserLoadingText.style.display = "flex";
        for (let i = 1; i < serverBrowser.children.length; i++) {
            serverBrowser.children[i].remove();
            i--;
        }

        let data: MooMooPublicServer[];
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

        serverBrowserLoadingText.style.display = "none";
        refreshServersBtn.classList.remove("disabled");
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

    /** true / false when known, undefined when the list couldn't be fetched. */
    static async doesExist(serverKey: string): Promise<boolean | undefined> {
        const [key, region] = serverKey.split(":");

        try {
            const data = await this.getData();
            return data.some(e => e.key === key && e.region === region);
        } catch (err) {
            showConnectionNotice("server-list", this.errorMessage(err));
            return undefined;
        }
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