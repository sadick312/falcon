import type GameObject from "@constants/GameObject";
import type Player from "@entities/Player";
import PlayerManager from "@core/logic/players/PlayerManager";
import type { PlayerSimulationState } from "@core/mod/simulation/SimulationStates";
import type FakeSocket from "@core/socket/FakeSocket";
import type Socket from "@core/socket/Socket";
import type { AllianceDataType, AllianceNotifi, Point } from "@mod-types/index";
import type { PlacementType } from "@placing/utils/Placer";
import type { GameServer } from "@ui/ServerBrowser";
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

function notLoaded(): never {
    throw new Error("Client.connect/reconnect are set by core/Connection.ts; import it before connecting.");
}

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
    /** The server of the last live connection (undefined for the local dev server), for the Reconnect button. */
    static lastServer: GameServer | undefined;
    static mode: "replay" | "normal" = "normal";
    static upgradesObtained = new Set<number>();

    /** Connects to `server`, else the server picked in the browser, else the local dev server. Set by core/Connection.ts. */
    static connect: (server?: GameServer) => Promise<void> = notLoaded;

    /** The Reconnect button's action: the same server again, without a page reload. Set by core/Connection.ts. */
    static reconnect: () => void = notLoaded;

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
