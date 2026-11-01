import Player from "@entities/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import ModManager from "@core/ModManager";
import withinDist from "@utils/geometry/withinDist";

export default class PlayerStateManager {
    static placementMap = new Map<number, number>();

    static trackPlacement(sid: number, place: number) {
        this.placementMap.set(sid, place);
    }

    /**
     * Whether player `a` updates before player `b` on the server this tick (see GOLD_TECH.md), or null when that's
     * unknown: fake ticks, which PacketBatcher emits when a real update is late, carry no positions, so the order is
     * empty. Callers must decide what unknown means for them instead of comparing missing values.
     */
    static updatesBefore(a: number, b: number): boolean | null {
        const spotA = this.placementMap.get(a);
        const spotB = this.placementMap.get(b);
        if (spotA === undefined || spotB === undefined) return null;
        return spotA < spotB;
    }

    static updateState() {
        const allTraps = ObjectManager.pool.allTraps;
        const enemies = ModManager.enemyData.all;
        const check = (player: Player) => {
            const lastTrapSID = player.trap?.sid;

            player.wasTrapped = !!player.trap;
            player.trap = undefined;
            player.potentialTrap = undefined;
            player.turretThreats = 0;

            for (let i = 0, len = allTraps.length; i < len; i++) {
                const gameObject = allTraps[i];

                if (!Client.isTeam(player, gameObject.ownerSID ?? -1)) {
                    if (!player.trap && withinDist(player.real_position, gameObject, player.sid === Client.mySID ? 50.5 : 50)) {
                        player.trap = gameObject;
                        gameObject.hideFromEnemy = false;

                        if (player.sid === Client.mySID) {
                            ModManager.brainState.trapData.x = gameObject.x;
                            ModManager.brainState.trapData.y = gameObject.y;
                        }
                    }

                    if (!player.trap && !player.potentialTrap && withinDist(player.next_position, gameObject, 50)) {
                        player.potentialTrap = gameObject;
                    }

                    if (player.trap || player.potentialTrap)
                        break;
                }
            }

            if (player.sid === Client.mySID && (!player.trap || lastTrapSID !== player.trap.sid)) {
                const nearby = ModManager.enemyData.nearby;
                DefenseSystem.trapHitState = 0;
                DefenseSystem.preHitChances = 0;

                for (let i = 0, len = nearby.length; i < len; i++) {
                    const enemy = nearby[i];
                    enemy.profilingData.randomHitAttacks = 0;
                }
            }
        };

        check(Client.player);
        for (const e of enemies) check(e);
    }
}