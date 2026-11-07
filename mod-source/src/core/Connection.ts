import { LOCAL_SERVER_HOST } from "@constants/Endpoints";
import Client, { deathText } from "@core/Client";
import { endPreviousSession } from "@core/GameSession";
import FakeSocket from "@core/socket/FakeSocket";
import { respawnMainCard } from "@core/socket/Socket";
import SocketListener from "@core/socket/SocketListener";
import CaptchaManager from "@core/utils/CaptchaManager";
import PacketTracker from "@core/utils/PacketTracker";
import TaskScheduler from "@services/event-timer/TaskScheduler";
import { reconnect as reconnectButton } from "@ui/ConnectionError";
import { enterGameBtn, resetScreenSize } from "@ui/Hook";
import { loadingCirclePage, mainMenu, respawnPage } from "@ui/Loader";
import ServerBrowser, { GameServer, serverBrowserPage } from "@ui/ServerBrowser";
import getElem from "@utils/dom/getElem";

// Connecting and reconnecting: the screens, the socket and the session reset. Kept out of Client so Client is plain
// game state that the UI and the socket code can import without Client importing them back. Loading this module puts
// connect and reconnect on Client (Loader and the server browser load it; so must anything else that connects).

const gameInformationMetadata = getElem("game-information-metadata");
const disconnectedPage = getElem("disconnected-page");

/** Connects to `server`, else the server picked in the browser, else the local dev server. */
async function connect(server?: GameServer) {
    loadingCirclePage.style.display = "none";
    serverBrowserPage.style.display = "none";
    respawnPage.style.display = "flex";
    mainMenu.style.display = "none";

    // Connecting again in the same page: drop the old socket and everything learned from its server.
    endPreviousSession();

    // Without the packet budget every placement request is refused, so replays (and the replay benchmark)
    // would never show Falcon's placements.
    PacketTracker.init();

    if (Client.mode === "replay") {
        Client.socket = new FakeSocket();
        resetScreenSize();
        SocketListener.hookEvents(Client.socket);
        return;
    }

    const selection = server ?? ServerBrowser.selectedOption;
    const wsAddress = selection?.host ?? LOCAL_SERVER_HOST;
    Client.lastServer = selection;

    if (selection) ServerBrowser.saveRecent(selection);

    gameInformationMetadata.innerText = `region: ${selection?.region ?? "local"} | NAME: ${selection?.name ?? "n/a"}`;
    TaskScheduler.init();
    CaptchaManager.renderChallenge(wsAddress);
}

/**
 * The Reconnect button: connects to the same server again without reloading the page. Replays have no server,
 * so there it still reloads.
 */
function reconnect() {
    if (Client.mode === "replay") {
        location.reload();
        return;
    }

    // Back to the respawn card with Enter Game greyed out until the new socket opens (Socket.onOpen enables it).
    disconnectedPage.style.display = "none";
    deathText.style.display = "none";
    respawnMainCard.style.display = "flex";
    enterGameBtn.classList.add("disabled");

    Client.connect(Client.lastServer);
}

Client.connect = connect;
Client.reconnect = reconnect;
reconnectButton.run = () => Client.reconnect();
