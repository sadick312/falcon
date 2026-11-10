import { ais } from "@constants/Ai";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import PotentialObjectManager from "@core/logic/PotentialObjectManager";
import ProjectileManager from "@core/logic/ProjectileManager";
import TextManager from "@core/logic/TextManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import CombatController from "@core/mod/combat/core/CombatController";
import LegacyAdapter from "@core/socket/LegacyAdapter";
import ModManager from "@core/ModManager";
import Socket from "@core/socket/Socket";

/**
 * Clears everything that belongs to one server session, so Falcon can reconnect or switch servers
 * without reloading the page (a reload would drop Quick Inject on moomodding, which clears the
 * pasted mod from sessionStorage on every page load).
 */
export default function resetGameState() {
    const old = Client.socket;
    if (old instanceof Socket && old.readyState <= WebSocket.OPEN) {
        old.onclose = null; // don't show the "Disconnected" screen for a deliberate switch
        old.close();
    }

    AttackManager.stopAttackAction();
    CombatController.attackState.confirm = false;
    CombatController.attackState.status = false;
    CombatController.tankSpam = false;

    PlayerManager.removeAll();
    PlayerManager.players.visible.removeAll();
    ObjectManager.removeAll();
    ais.removeAll();
    ProjectileManager.projectiles.removeAll();
    ProjectileManager.simulationProjectiles.removeAll();
    PotentialObjectManager.allObjects.length = 0;
    PotentialObjectManager.closeObjects.length = 0;
    PotentialObjectManager.onRenderObjects.length = 0;
    TextManager.texts.clear();
    LegacyAdapter.reset();
    ModManager.enemyData.nearest = null;
    ModManager.enemyData.nearby.length = 0;
    ModManager.enemyData.all.length = 0;

    Client.isAlive = false;
    Client.mySID = -1;
    (Client as { player?: unknown }).player = undefined;
    Client.alliances = [];
    Client.alliancePlayers = [];
    Client.allianceNotifications = [];
    Client.allianceMap.clear();
    Client.markers = [];
    Client.buildingsHit = [];
    Client.upgradesObtained.clear();
    Client.lastMoveDir = null;
}
