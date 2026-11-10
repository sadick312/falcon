import { ais } from "@entities/Ai";
import Player from "@entities/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import PotentialObjectManager from "@core/logic/PotentialObjectManager";
import ProjectileManager from "@core/logic/ProjectileManager";
import TextManager from "@core/logic/TextManager";
import CombatController from "@core/mod/combat/core/CombatController";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import ModManager from "@core/ModManager";
import PlayerUpdateEvent from "@core/socket/events/core/PlayerUpdateEvent";
import Socket from "@core/socket/Socket";
import SocketListener from "@core/socket/SocketListener";
import PacketBatcher from "@core/utils/PacketBatcher";
import PacketRecorder from "@services/packet-recorder/PacketRecorder";

/**
 * Puts all game state back to how it is when the page loads, so a new connection doesn't inherit the old
 * server's players, buildings, projectiles, animals, alliances or queued actions. Sids are only unique per server
 * (and per game), so stale entries would be mistaken for new ones.
 *
 * Kept: settings, the menu, the packet budget, and ModManager.tick (see ModManager.resetSession).
 */
function resetGameState() {
    PlayerManager.removeAll();
    ObjectManager.removeAll();
    ProjectileManager.projectiles.removeAll();
    ProjectileManager.simulationProjectiles.removeAll();
    ais.removeAll();
    PotentialObjectManager.removeAll();
    TextManager.texts.clear();

    PacketBatcher.reset();
    PlayerUpdateEvent.lastReceive = 0;
    PacketRecorder.clearSession();
    ModManager.resetSession();
    HatSystem.reset();
    CombatController.attackState.confirm = false;
    CombatController.attackState.status = false;

    Client.player = undefined as unknown as Player;
    Client.mySID = -1;
    Client.isAlive = false;
    Client.lastAteTick = -Infinity;
    Client.lastMoveDir = null;
    Client.weaponIndex = 0;
    Client.alliancePlayers = [];
    Client.alliances = [];
    Client.allianceNotifications = [];
    Client.allianceMap.clear();
    Client.markers.length = 0;
    Client.buildingsHit = [];
    Client.upgradesObtained.clear();
    Client.minimapData = [];
}

/**
 * Before connecting again without a page reload: retires the old socket (no disconnect screen, no late packets)
 * and resets the game state. Returns false when there was no earlier connection.
 */
export function endPreviousSession() {
    const old = Client.socket;
    if (!old) return false;

    if (old instanceof Socket) old.dispose();
    SocketListener.stopPinging();
    resetGameState();
    return true;
}
