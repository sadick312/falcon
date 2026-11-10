import items from "@constants/items";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PacketReplayer from "@core/PacketReplayer";
import PacketRecorder from "@services/packet-recorder/PacketRecorder";
import { checkGameVersion } from "@core/utils/GameVersionCheck";
import { stopVanillaGame } from "@core/utils/VanillaGameGuard";
import Endpoints from "@constants/Endpoints";
import CameraManager from "@rendering/core/CameraManager";
import SpriteCache from "@rendering/core/SpriteCache";
import RenderingConfig from "@rendering/RenderingConfig";
import AllTemporaryObjects from "@ui/data/AllTemporaryObjects";
import DisclaimerDisplay from "@ui/DisclaimerDisplay";
import Hook from "@ui/Hook";
import ServerBrowser from "@ui/ServerBrowser";
import getElem from "@utils/dom/getElem";
import Menu from "../core/menu/Menu";
import RendererSystem from "../rendering/RendererSystem";
import { NATURAL_OBJECT_OWNER } from "@constants/world";

declare global {
    interface HTMLImageElement {
        isLoaded: boolean;
    }
}

export const mainMenu = getElem<"div">("main-menu");
export const gameUI = getElem<"div">("game-ui");
export const respawnPage = getElem<"div">("respawn-page");
export const loadingCirclePage = getElem<"div">("loading-page");

const singleplayerBtn = getElem<"button">("singleplayer-btn");
const multiplayerBtn = getElem<"button">("multiplayer-btn");
const packetReplayerBtn = getElem<"button">("packet-replayer-btn");

const openDiscordBtn = getElem<"button">("open-discord-btn");
const quitClientBtn = getElem<"button">("quit-client-btn");

const skinSelector = getElem("skin-selector");
const actionBar = getElem("action-bar");

const packetReplayerOptionsPage = getElem("packet-replayer-options-page");

function updateSkinColorPicker() {
    skinSelector.innerHTML = "";

    for (const [i, color] of RenderingConfig.skinColors.entries()) {
        const buttonItem = document.createElement("div");
        buttonItem.classList.add("skin-item");
        if (i == Loader.skinColor) buttonItem.classList.add("active");
        buttonItem.style.backgroundColor = color;

        buttonItem.onclick = () => {
            localStorage.setItem("moo_skin", i.toString());
            Loader.skinColor = i;
            updateSkinColorPicker();
        };

        skinSelector.appendChild(buttonItem);
    }
}

const clearAllLogsBtn = getElem<"button">("clear-all-logs-btn");
const openLogsFolderBtn = getElem<"button">("open-logs-folder-btn");
const packetReplayerFileBtn = getElem<"button">("packet-replayer-file-btn");
const packetReplayerFileInput = getElem<"input">("packet-replayer-file-input");
const packetReplayerCancelBtn = getElem<"button">("packet-replayer-cancel-btn");
const recentMultiplayerBtn = getElem<"button">("recent-multiplayer-btn");
const largestRecentMultiplayerBtn = getElem<"button">("largest-recent-multiplayer-btn");

function hookMainMenuBtns() {
    singleplayerBtn.onclick = () => {
        loadingCirclePage.style.display = "flex";
        Client.connect();
    };

    multiplayerBtn.onclick = () => {
        ServerBrowser.start();
    };

    if (!ServerBrowser.getRecent()) {
        recentMultiplayerBtn.style.display = "none";
        largestRecentMultiplayerBtn.style.display = "none";
    }

    largestRecentMultiplayerBtn.onclick = async () => {
        const { region } = ServerBrowser.getRecent()!;
        loadingCirclePage.style.display = "flex";

        const mostActiveServer = await ServerBrowser.getHighest(region);
        if (mostActiveServer) {
            ServerBrowser.selectedOption = mostActiveServer;
            Client.connect(mostActiveServer);
        } else {
            loadingCirclePage.style.display = "none";
            // null: the list loaded but the region has no server, so the button can't help. undefined: the list couldn't
            // be fetched (a notice already said so); keep the button so the player can try again.
            if (mostActiveServer === null) largestRecentMultiplayerBtn.style.display = "none";
        }
    };

    recentMultiplayerBtn.onclick = async () => {
        const { key, region } = ServerBrowser.getRecent()!;
        loadingCirclePage.style.display = "flex";

        const server = await ServerBrowser.find(key, region);
        if (server) {
            Client.connect(server);
        } else {
            loadingCirclePage.style.display = "none";
            // undefined = the list could not be fetched; keep the button so the user can retry.
            if (server === null) recentMultiplayerBtn.style.display = "none";
        }
    };

    packetReplayerBtn.onclick = () => {
        packetReplayerOptionsPage.style.display = "flex";
        mainMenu.style.display = "none";
    };

    packetReplayerCancelBtn.onclick = () => {
        packetReplayerOptionsPage.style.display = "none";
        mainMenu.style.display = "flex";
    };

    openDiscordBtn.onclick = () => {
        window.open("https://discord.gg/4KUJm7jNys", "_blank");
    };

    packetReplayerFileBtn.onclick = () => {
        packetReplayerFileInput.click();
    };

    packetReplayerFileInput.onchange = () => {
        loadingCirclePage.style.display = "flex";
        const files: FileList | null = packetReplayerFileInput.files;

        const file = files?.length === 1 ? files[0] : undefined;
        if (!file) {
            loadingCirclePage.style.display = "none";
            return;
        }

        const fileReader = new FileReader();

        fileReader.onload = () => {
            const result = fileReader.result;

            loadingCirclePage.style.display = "none";

            if (result instanceof ArrayBuffer && !PacketReplayer.start(result)) {
                alert("That file isn't a Falcon packet log (no recorded packets found).");
            }
        };

        fileReader.readAsArrayBuffer(file);
    };

    // Both came from a desktop build of Falcon. A web page can't open a folder or delete downloaded files, and these
    // only showed a loading screen that never went away; they now say where the logs are and do what a page can.
    openLogsFolderBtn.onclick = () => {
        alert("Falcon saves packet logs as .fpl files in your browser's Downloads folder.\n\n" +
            "Press Ctrl+J to open Chrome's downloads list, then click \"Show in folder\" on a log.");
    };

    clearAllLogsBtn.onclick = () => {
        PacketRecorder.clearSession();
        alert("Cleared the packet log Falcon keeps in memory.\n\n" +
            "Logs you already saved are .fpl files in your Downloads folder; delete them there.");
    };

    quitClientBtn.onclick = () => { };
}

function importTemporaryObjects() {
    const tmpObjects = AllTemporaryObjects[Math.floor(AllTemporaryObjects.length * Math.random())];
    if (!tmpObjects) return;

    CameraManager.camX = tmpObjects.player.x;
    CameraManager.camY = tmpObjects.player.y;

    for (const [i, obj] of tmpObjects.objects.entries()) {
        ObjectManager.add(i, obj.x, obj.y, obj.dir, obj.scale, obj.type ?? -1000, obj.id, true, NATURAL_OBJECT_OWNER);
    }
}

export default class Loader {
    private static toolSprites: Record<string, HTMLImageElement> = {};
    static skinColor = 0;

    private static prepareUI() {
        actionBar.innerHTML = "";

        for (let i = 0; i < items.weapons.length + items.list.length; i++) {
            const actionBarItem = document.createElement("div");
            actionBarItem.id = `action-bar-item-${i}`;
            actionBarItem.classList.add("action-bar-item");
            actionBarItem.style.display = "none";

            actionBar.appendChild(actionBarItem);
        }

        for (let i = 0; i < items.weapons.length + items.list.length; i++) {
            const weapon = items.weapons[i];
            const listItem = items.list[i - items.weapons.length];

            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = 66;

            const tmpContext = tmpCanvas.getContext("2d")!;
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));

            tmpContext.imageSmoothingEnabled = false;

            const actionElem = getElem<"div">(`action-bar-item-${i}`);
            actionElem.style.position = "relative";

            if (weapon) {
                tmpContext.rotate((Math.PI / 4) + Math.PI);

                const tmpSprite = new Image();
                tmpSprite.crossOrigin = "anonymous";
                this.toolSprites[weapon.src] = tmpSprite;

                tmpSprite.onload = () => {
                    tmpSprite.isLoaded = true;

                    const tmpPad = 1 / (tmpSprite.height / tmpSprite.width);
                    const tmpMlt = (weapon.iPad || 1);

                    tmpContext.drawImage(
                        tmpSprite,
                        -(tmpCanvas.width * tmpMlt * RenderingConfig.iconPad * tmpPad) / 2,
                        -(tmpCanvas.height * tmpMlt * RenderingConfig.iconPad) / 2,
                        tmpCanvas.width * tmpMlt * tmpPad * RenderingConfig.iconPad,
                        tmpCanvas.height * tmpMlt * RenderingConfig.iconPad
                    );

                    tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                    tmpContext.globalCompositeOperation = "source-atop";
                    tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);

                    actionElem.style.backgroundImage = `url('${tmpCanvas.toDataURL()}')`;
                };

                tmpSprite.src = `../../img/weapons/${weapon.src}.png`;
            } else if (listItem) {
                const tmpSprite = SpriteCache.getItemSprite(listItem, true);
                if (!tmpSprite) continue;
                const tmpScale = Math.min(tmpCanvas.width - RenderingConfig.iconPadding, tmpSprite.width);

                tmpContext.globalAlpha = 1;
                tmpContext.drawImage(tmpSprite, -tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);

                tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                tmpContext.globalCompositeOperation = "source-atop";
                tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);

                actionElem.style.backgroundImage = `url('${tmpCanvas.toDataURL()}')`;
            }
        }

        for (let i = 19; i <= 38; i++) {
            const itemCounts = document.createElement("div");
            itemCounts.id = `item-count-${i}`;
            itemCounts.classList.add("item-count");
            itemCounts.style.position = "absolute";
            itemCounts.innerText = "0";

            getElem(`action-bar-item-${i}`).appendChild(itemCounts);
        }
    }

    static async main() {
        // On sandbox.moomodding.io the vanilla 1.8.2 game can be running underneath (see VanillaGameGuard);
        // stop it before Falcon opens its own connection.
        if (Endpoints.mode === "moomodding") stopVanillaGame({ isOwnSocket: (socket) => socket === Client.socket });
        checkGameVersion();
        importTemporaryObjects();
        this.prepareUI();

        Menu.init();
        RendererSystem.init();
        DisclaimerDisplay.show();

        Hook();

        const moo_skin = localStorage.getItem("moo_skin");
        if (typeof moo_skin === "string" && !isNaN(parseInt(moo_skin))) {
            this.skinColor = parseInt(moo_skin);
        }

        updateSkinColorPicker();
        hookMainMenuBtns();
    }
}