import { LOCAL_SERVER_HOST } from "@constants/Endpoints";
import GameObject from "@constants/GameObject";
import Player from "@entities/Player";
import PlayerManager from "@core/logic/players/PlayerManager";
import { PlayerSimulationState } from "@core/mod/simulation/SimulationStates";
import { endPreviousSession } from "@core/GameSession";
import FakeSocket from "@core/socket/FakeSocket";
import Socket from "@core/socket/Socket";
import SocketListener from "@core/socket/SocketListener";
import CaptchaManager from "@core/utils/CaptchaManager";
import PacketTracker from "@core/utils/PacketTracker";
import { AllianceDataType, AllianceNotifi, Point } from "@mod-types/index";
import { PlacementType } from "@placing/utils/Placer";
import TaskScheduler from "@services/event-timer/TaskScheduler";
import { resetScreenSize } from "@ui/Hook";
import { loadingCirclePage, mainMenu, respawnPage } from "@ui/Loader";
import ServerBrowser, { GameServer, serverBrowserPage } from "@ui/ServerBrowser";
import ScriptConfig from "@utils/config/ScriptConfig";
import getElem from "@utils/dom/getElem";

export class Marker {
    active = true;
    life = ScriptConfig.SERVER_UPDATE_SPEED;

    constructor(
        public x: number,
        public y: number,
        public dir: number,
        public id: number,
        public type: PlacementType
    ) {
    }

    redefine(x: number, y: number, dir: number, id: number, type: PlacementType) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.id = id;
        this.type = type;
        this.life = ScriptConfig.SERVER_UPDATE_SPEED;
    }
}

const gameInformationMetadata = getElem("game-information-metadata");

export const pingDisplay = getElem<"div">("ping-display");
export const deathText = getElem("death-text");

export default class Client {
    static socket: Socket | FakeSocket;
    static player: Player;

    static mySID: number = -1;
    /** True from our ADD_PLAYER until KILL_PLAYER. Client.player keeps pointing at us while we're dead. */
    static isAlive = false;

    /**
     * The tick we last sent a food use (select food + hit). 1.8.2 only changes shame when food is eaten, so our own
     * shame is counted only for heals that follow this, not for regen, healing accessories or healing pads.
     */
    static lastAteTick = -Infinity;

    static lastDeath: Point;
    static lastMoveDir: number | null;

    static alliancePlayers: (string | number)[] = [];
    static alliances: AllianceDataType[] = [];
    static allianceNotifications: AllianceNotifi[] = [];
    static markers: Marker[] = [];
    static buildingsHit: GameObject[] = [];

    static weaponIndex = 0;

    static allianceMap = new Map<string, Set<number>>();
    static mode: "replay" | "normal" = "normal";
    static upgradesObtained = new Set<number>();

    /** Connects to `server`, else the server picked in the browser, else the local dev server. */
    static async connect(server?: GameServer) {
        loadingCirclePage.style.display = "none";
        serverBrowserPage.style.display = "none";
        respawnPage.style.display = "flex";
        mainMenu.style.display = "none";

        // Connecting again in the same page: drop the old socket and everything learned from its server.
        endPreviousSession();

        // Without the packet budget every placement request is refused, so replays (and the replay benchmark)
        // would never show Falcon's placements.
        PacketTracker.init();

        if (this.mode === "replay") {
            this.socket = new FakeSocket();
            resetScreenSize();
            SocketListener.hookEvents(this.socket);
            return;
        }

        const selection = server ?? ServerBrowser.selectedOption;
        const wsAddress = selection?.host ?? LOCAL_SERVER_HOST;

        if (selection) ServerBrowser.saveRecent(selection);

        gameInformationMetadata.innerText = `region: ${selection?.region ?? "local"} | NAME: ${selection?.name ?? "n/a"}`;
        TaskScheduler.init();
        CaptchaManager.renderChallenge(wsAddress);
    }

    static isFriendly(sid: number) {
        return this.mySID === sid || (Client.player?.team && this.alliancePlayers.includes(sid));
    }

    static isTeam(player: Player | PlayerSimulationState, sid: number) {
        if (player.sid === sid) return true;

        const owner = PlayerManager.get(sid);

        if (!owner) return false;
        if (player.team === null || owner.team === null) {
            return player.sid === owner.sid;
        }

        return this.allianceMap.get(owner.team)?.has(player.sid) ?? false;
    }

    static pingTime: number = 0;
    static minimapData: number[] = [];
    static placementTime = ["0", "0", "0", "0", "0"];
    static placementTimeHead = 0;
}