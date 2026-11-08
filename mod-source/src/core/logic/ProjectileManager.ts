import EntityHandler from "@constants/EntityHandler";
import { getWeapon, WEAPON_ID_MAP, WEAPON_VARIANT_MAP } from "@constants/items";
import Player from "@entities/Player";
import Projectile from "@entities/Projectile";
import SimulationProjectile from "@entities/SimulationProjectile";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import GameEventTracker from "@core/mod/utils/GameEventTracker";
import { tickState } from "@core/TickState";
import PacketMap from "@root/utils/socket/PacketMap";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";
import withinDist from "@utils/geometry/withinDist";
import inRange from "@utils/math/inRange";
import { BOOST_TICK_MAX_DIST_SQ, BOOST_TICK_MIN_DIST_SQ } from "@constants/world";

export default class ProjectileManager {
    static simulationProjectiles = new EntityHandler<SimulationProjectile>();
    static projectiles = new EntityHandler<Projectile>();

    static update() {
        const projectiles = this.simulationProjectiles.all;

        for (let i = 0, len = projectiles.length; i < len; i++) {
            const projectile = projectiles[i];
            if (projectile?.active) projectile.update();
        }
    }

    private static bulletPositionBuffer = { x: 0, y: 0 };
    private static turretPositionBuffer = { x: 0, y: 0 };

    /** 1.8.2 projectile speeds: hunting bow 1.6, crossbow 2.5, repeater crossbow 2, musket 3.6. */
    private static readonly WEAPON_SPEEDS: [number, number][] = [
        [WEAPON_ID_MAP.HUNTING_BOW, 1.6],
        [WEAPON_ID_MAP.CROSSBOW, 2.5],
        [WEAPON_ID_MAP.REPEATER_CROSSBOW, 2],
        [WEAPON_ID_MAP.MUSKET, 3.6]
    ];

    /** Marksman Cap's aMlt: the server sends speed × 1.3 for its wearer. */
    private static readonly MARKSMAN_SPEED_MULT = 1.3;

    /** Which projectile weapon fired at this speed (plain or with Marksman Cap). Unknown speeds count as a musket. */
    private static weaponFromSpeed(speed: number) {
        for (const [id, base] of this.WEAPON_SPEEDS) {
            if (Math.abs(speed - base) < 1e-6 || Math.abs(speed - base * this.MARKSMAN_SPEED_MULT) < 1e-6) return id;
        }

        // Marksman Cap shots used to fall through to this and be taken for a musket.
        return WEAPON_ID_MAP.MUSKET;
    }

    /**
     * The server reuses a projectile's sid once that projectile is gone, sometimes before we have marked our copy
     * inactive. EntityHandler.add ignores a sid it already has, so re-init the existing entry instead of adding;
     * otherwise the new projectile would be dropped and the old one tracked in its place.
     */
    private static setSimulationProjectile(sid: number, indx: number, x: number, y: number, dir: number, speed: number, range: number, layer: number, ownerSID: number) {
        const simProj = this.simulationProjectiles.get(sid);

        if (simProj) {
            simProj.init(indx, x, y, dir, speed, range, layer, ownerSID);
        } else {
            this.simulationProjectiles.add(new SimulationProjectile(sid, indx, x, y, dir, speed, range, layer, ownerSID));
        }
    }

    static add(x: number, y: number, dir: number, range: number, speed: number, indx: number, layer: number, sid: number) {
        const tick = tickState.tick;
        const visiblePlayers = PlayerManager.players.visible.all;
        const bulletPosition = this.bulletPositionBuffer;
        const turretPosition = this.turretPositionBuffer;

        bulletPosition.x = x - Math.cos(dir) * 70;
        bulletPosition.y = y - Math.sin(dir) * 70;

        turretPosition.x = x;
        turretPosition.y = y;

        let source: Player | null = null;
        let isTurret = false;

        for (const player of visiblePlayers) {
            const secondary = getWeapon(player.weaponData.secondary);
            const realPosition = player.real_position;
            const nextPosition = player.next_position;

            if (speed === 1.5 && (withinDist(realPosition, turretPosition, 35) || withinDist(nextPosition, turretPosition, 35))) {
                source = player;
                isTurret = true;
                break;
            } else if (secondary && typeof secondary.projectile == "number" && withinDist(realPosition, bulletPosition, 35)) {
                source = player;
                break;
            }
        }

        let assigned = false;

        if (source) {
            // Pattern recognition asks whether this player attacked; the packet itself doesn't say who fired.
            GameEventTracker.updateTracker(source.sid, PacketMap.SERVER_TO_CLIENT.ADD_PROJECTILE);
            this.setSimulationProjectile(sid, indx, x, y, dir, speed, range, layer, source.sid);

            if (!Client.isFriendly(source.sid) && !isTurret) {
                source.projFired++;

                if (source.projFired > 1) {
                    DefenseSystem.isBeingBowInstaed = true;
                }

                setTimeout(() => {
                    source.projFired--;
                }, ScriptConfig.SERVER_UPDATE_SPEED * 4);
            }

            if (isTurret) {
                source.reloads[53] = 0;
                source.weaponData.lastTurretTickHit = tick;
            } else {
                const weaponID = this.weaponFromSpeed(speed);

                if (!Client.isFriendly(source.sid)) {
                    const isDiaPolearm = source.weaponData.primary === WEAPON_ID_MAP.POLEARM && source.weaponData.primaryVariant >= WEAPON_VARIANT_MAP.DIAMOND;
                    const isUsingOneTickSecondary = weaponID === WEAPON_ID_MAP.CROSSBOW || weaponID === WEAPON_ID_MAP.REPEATER_CROSSBOW;
                    const distanceSq = getDistSq(source.real_position, Client.player.real_position);
                    const rangedThreats = tickState.enemyData.rangedInstaThreats > 0;

                    if (isDiaPolearm && inRange(distanceSq, BOOST_TICK_MIN_DIST_SQ, BOOST_TICK_MAX_DIST_SQ) && rangedThreats && isUsingOneTickSecondary) {
                        DefenseSystem.isBeingBowInstaed = true;
                        DefenseSystem.forceSoldierTicks += 3;
                        source.ignoreDamageConsideration = true;
                    }
                }

                PlayerCombatManager.startReload(source, weaponID);
                source.weaponData.secondary = weaponID;
                source.weaponData.secondaryConfirmed = true;
                source.weaponData.lastSecondaryTickHit = tick;
            }

            assigned = true;
        } else if (speed === 1.5) {
            const allTurrets = ObjectManager.allTurrets.all;

            for (let i = 0, len = allTurrets.length; i < len; i++) {
                const gameObject = allTurrets[i];
                if (gameObject === undefined) continue;
                if (getDistSq(turretPosition, gameObject) > 5) continue;

                // We saw this turret fire: restart its shot counter (TurretManager), which otherwise only counts from
                // when the turret was first seen.
                gameObject.reload = 0;

                // turret object always has ownerSID defined (at least it should)
                this.setSimulationProjectile(sid, indx, x, y, dir, speed, range, layer, gameObject.ownerSID!);

                assigned = true;
                break;
            }
        }

        // did not assign source to projectile so just assume it is enemy
        if (!assigned) {
            this.setSimulationProjectile(sid, indx, x, y, dir, speed, range, layer, -1);
        }

        // Same as setSimulationProjectile: re-init a reused sid even while the old projectile still looks active.
        const hadProj = this.projectiles.get(sid);
        if (hadProj) {
            hadProj.init(x, y, dir, range, speed, layer, indx);
        } else {
            const proj = new Projectile(x, y, dir, range, speed, sid, layer, indx);
            this.projectiles.add(proj);
        }
    }

    static remove(sid: number, range: number) {
        const proj = this.projectiles.get(sid);
        const simProj = this.simulationProjectiles.get(sid);

        if (proj) proj.range = range;
        if (simProj) simProj.active = false;
    }
}