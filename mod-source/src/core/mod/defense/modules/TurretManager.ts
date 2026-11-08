import { ais } from "@entities/Ai";
import GameObject from "@constants/GameObject";
import Player from "@entities/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import { tickState } from "@core/TickState";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";

export default class TurretManager {
    private static readonly TURRET_RANGE_SQ = 700 * 700;

    private static updatePlayer(player: Player, turret: GameObject) {
        if (getDistSq(player.real_position, turret) > this.TURRET_RANGE_SQ) return;

        if (player.sid === Client.mySID) {
            if (!Client.isFriendly(turret.ownerSID ?? -1)) {
                player.turretThreats++;
            }

            return;
        }

        // Plain loops: this sorted the shared animal list in place on every shot, which left its entries' list
        // positions stale (and allocated two arrays per turret and player).
        const allAis = ais.all;
        let closestAI: (typeof allAis)[number] | undefined;
        let closestAiDistance = Infinity;
        for (let i = 0; i < allAis.length; i++) {
            const distSq = getDistSq(allAis[i].real_position, turret);
            if (distSq < closestAiDistance) {
                closestAiDistance = distSq;
                closestAI = allAis[i];
            }
        }

        const visible = PlayerManager.players.visible.all;
        let closestEnemy: Player | undefined;
        let closestEnemyDistance = Infinity;
        for (let i = 0; i < visible.length; i++) {
            const enemy = visible[i];
            if (Client.isTeam(enemy, turret.ownerSID ?? -1) || enemy.skinIndex === STORE_HAT_MAP.EMP_HELMET) continue;

            const distSq = getDistSq(enemy.real_position, turret);
            if (distSq < closestEnemyDistance) {
                closestEnemyDistance = distSq;
                closestEnemy = enemy;
            }
        }
        // The closer one is the target (this used to pick the player when the animal was closer).
        const closest = !isFinite(closestAiDistance) ? closestEnemy : closestEnemyDistance <= closestAiDistance ? closestEnemy : closestAI;

        if (!isFinite(closestEnemyDistance) && !isFinite(closestAiDistance)) return;
        if (!closest) return;
        if (closest !== player) return;

        const range = 1.5 * ScriptConfig.SERVER_UPDATE_SPEED;
        const rangeSq = range * range;

        if (getDistSq(player.real_position, turret) > rangeSq) return;
        player.turretThreats++;
    }

    static updateReloads() {
        const allTurrets = ObjectManager.allTurrets.all;
        const nearby = tickState.enemyData.nearby;
        const player = Client.player;

        for (let i = 0, len = allTurrets.length; i < len; i++) {
            const gameObject = allTurrets[i];
            if (!gameObject) continue;

            gameObject.reload++;
            if (gameObject.reload < 20) continue;
            gameObject.reload = 0;

            this.updatePlayer(player, gameObject);
            for (let j = 0; j < nearby.length; j++) {
                this.updatePlayer(nearby[j], gameObject);
            }
        }
    }
}