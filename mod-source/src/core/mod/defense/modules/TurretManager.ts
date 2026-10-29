import Ai, { ais } from "@constants/Ai";
import GameObject from "@constants/GameObject";
import Player from "@constants/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import ModManager from "@core/ModManager";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";

export default class TurretManager {
    private static readonly TURRET_RANGE_SQ = 700 * 700;

    /**
     * The entity this turret would aim at: the closest visible AI and the closest visible enemy player
     * (no EMP Helmet), compared the same way as before. Computed once per shot instead of once per player,
     * and without sorting ais.all in place (that list keeps per-entity indexes for O(1) removal).
     */
    private static findTarget(turret: GameObject): Player | Ai | undefined {
        let closestAI: Ai | undefined;
        let closestAiDistance = Infinity;
        const allAis = ais.all;

        for (let i = 0; i < allAis.length; i++) {
            const ai = allAis[i];
            if (!ai.visible) continue;

            const dist = getDistSq(ai.real_position, turret);
            if (dist < closestAiDistance) {
                closestAiDistance = dist;
                closestAI = ai;
            }
        }

        let closestEnemy: Player | undefined;
        let closestEnemyDistance = Infinity;
        const players = PlayerManager.players.visible.all;

        for (let i = 0; i < players.length; i++) {
            const other = players[i];
            if (Client.isTeam(other, turret.ownerSID ?? -1) || other.skinIndex === STORE_HAT_MAP.EMP_HELMET) continue;

            const dist = getDistSq(other.real_position, turret);
            if (dist < closestEnemyDistance) {
                closestEnemyDistance = dist;
                closestEnemy = other;
            }
        }

        if (!isFinite(closestEnemyDistance) && !isFinite(closestAiDistance)) return undefined;
        return !isFinite(closestAiDistance) ? closestEnemy : closestEnemyDistance >= closestAiDistance ? closestEnemy : closestAI;
    }

    private static updatePlayer(player: Player, turret: GameObject, target: Player | Ai | undefined) {
        if (getDistSq(player.real_position, turret) > this.TURRET_RANGE_SQ) return;

        if (player.sid === Client.mySID) {
            if (!Client.isFriendly(turret.ownerSID ?? -1)) {
                player.turretThreats++;
            }

            return;
        }

        if (!target || target !== player) return;

        const range = 1.5 * ScriptConfig.SERVER_UPDATE_SPEED;
        const rangeSq = range * range;

        if (getDistSq(player.real_position, turret) > rangeSq) return;
        player.turretThreats++;
    }

    static updateReloads() {
        const allTurrets = ObjectManager.allTurrets.all;
        const nearby = ModManager.enemyData.nearby;
        const player = Client.player;

        for (let i = 0, len = allTurrets.length; i < len; i++) {
            const gameObject = allTurrets[i];
            if (!gameObject) continue;

            gameObject.reload++;
            if (gameObject.reload < 20) continue;
            gameObject.reload = 0;

            const target = nearby.length ? this.findTarget(gameObject) : undefined;
            this.updatePlayer(player, gameObject, target);
            for (let j = 0; j < nearby.length; j++) {
                this.updatePlayer(nearby[j], gameObject, target);
            }
        }
    }
}