
import { at } from "@utils/array/at";
import { LIST_ID_MAP, WEAPON_ID_MAP, WEAPON_VARIANT_MAP } from "@constants/items";
import { handleAllianceUpdates } from "@core/logic/alliances";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import TextManager from "@core/logic/TextManager";
import DefenseUtils from "@core/mod/defense/utils/DefenseUtils";
import ModManager from "@core/ModManager";
import { tickState } from "@core/TickState";
import PacketReplayer from "@core/PacketReplayer";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import PacketMap, { WireValue } from "@root/utils/socket/PacketMap";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";
import inRange from "@utils/math/inRange";
import { BOOST_TICK_MAX_DIST_SQ, BOOST_TICK_MIN_DIST_SQ, BOW_INSTA_MAX_DIST_SQ, BOW_INSTA_MIN_DIST_SQ, NEARBY_ENEMY_DIST_SQ, PLAYER_DECELERATION } from "@constants/world";
import type Player from "@entities/Player";
type UpdatePlayerPacket = typeof PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS;

/** A move longer than this in one tick is a respawn or teleport, not walking: count it as standing still. */
const MAX_WALK_PER_TICK = 100;

/**
 * "Resync Predicted Speed": our predicted state starts every tick on our real position with our real speed: this
 * tick's movement, slowed by one tick of friction, the same way Player.getSimulationState works it out. Without it
 * the position was only reset on ticks that carried our attributes, and the speed never: one simulated spike bounce
 * kept "hitting" the spike every tick after (and Auto Heal ate for damage that never came).
 */
export function resyncPredictedSpeed(player: Player) {
    const dx = player.real_position.x - player.last_position.x;
    const dy = player.real_position.y - player.last_position.y;
    const state = player.next_state;

    if (player.trap || Math.abs(dx) > MAX_WALK_PER_TICK || Math.abs(dy) > MAX_WALK_PER_TICK) {
        state.velX = 0;
        state.velY = 0;
        return;
    }

    let velX = dx / ScriptConfig.SERVER_UPDATE_SPEED * PLAYER_DECELERATION;
    let velY = dy / ScriptConfig.SERVER_UPDATE_SPEED * PLAYER_DECELERATION;
    if (Math.abs(velX) <= 0.01) velX = 0;
    if (Math.abs(velY) <= 0.01) velY = 0;
    state.velX = velX;
    state.velY = velY;
}

export default class PlayerUpdateEvent extends MessageHandler<UpdatePlayerPacket> {
    private tmpSidSet = new Set();
    static lastReceive = 0;

    private preTick() {
        Client.buildingsHit = [];

        tickState.tick++;
        tickState.enemyData.nearest = null;
        tickState.enemyData.nearby.length = 0;
        tickState.enemyData.all.length = 0;
        tickState.enemyData.rangedInstaThreats = 0;
    }

    private onTick(positions: number[], attributes: WireValue[]) {
        const player = Client.player;
        PlayerStateManager.placementMap.clear();

        let placement = 0;

        // Whole records only: [sid, x, y, dir * 100].
        for (let i = 0; i + 4 <= positions.length; i += 4) {
            const sid = at(positions, i);
            const x = at(positions, i + 1);
            const y = at(positions, i + 2);
            const player = PlayerManager.get(sid);
            if (!player) continue;

            PlayerStateManager.trackPlacement(sid, placement);
            placement++;

            const lastX = player.last_position.x = player.real_position.x;
            const lastY = player.last_position.y = player.real_position.y;

            player.last_render_position.x = player.render_position.x;
            player.last_render_position.y = player.render_position.y;

            player.still = player.real_position.x == x && player.real_position.y == y;
            player.real_position.x = x;
            player.real_position.y = y;

            if (player.sid === Client.mySID && (PacketReplayer.slowTime !== 0 || PacketReplayer.quickTime)) {
                player.render_position.x = player.real_position.x;
                player.render_position.y = player.real_position.y;
                CameraManager.camX = player.real_position.x;
                CameraManager.camY = player.real_position.y;
            }

            const realX = player.real_position.x;
            const realY = player.real_position.y;
            player.next_position.x = realX * 2 - lastX;
            player.next_position.y = realY * 2 - lastY;

            // The classic reset of next_state's position happens below, but only for players whose attributes came
            // in this tick, which isn't every tick: in between, the prediction stayed frozen where it last was.
            if (player.sid === Client.mySID && Menu.getValue("resyncPredictedSpeed")) {
                player.next_state.x = realX;
                player.next_state.y = realY;
                resyncPredictedSpeed(player);
            }

            player.d1 = player.d2;
            player.d2 = at(positions, i + 3) / 100;
            player.deltaTime = 0;

            PlayerManager.players.visible.add(player);
            player.forcePos = Client.mode === "replay" && PacketReplayer.slowTime !== 0 ? true : !player.visible;
            player.stateUpdate.position = true;
            player.visible = true;
        }

        for (let i = 0; i < attributes.length; i += 10) {
            const player = PlayerManager.get(attributes[i]);
            if (!player) continue;

            player.buildIndex = attributes[i + 1];
            player.weaponIndex = attributes[i + 2];
            player.weaponVariant = attributes[i + 3];

            const newTeam = attributes[i + 4];
            handleAllianceUpdates(player, newTeam);

            player.isLeader = attributes[i + 5];
            if (player.skinIndex !== STORE_HAT_MAP.SHAME) player.lastSkinIndex = player.skinIndex;
            player.skinIndex = attributes[i + 6];

            player.tailIndex = attributes[i + 7];
            player.iconIndex = attributes[i + 8];
            player.zIndex = attributes[i + 9];

            player.next_state.sid = player.sid;
            player.next_state.x = player.real_position.x;
            player.next_state.y = player.real_position.y;
            player.stateUpdate.attribute = true;
            PlayerManager.players.visible.add(player);

            if (!player.clowned && player.skinIndex === STORE_HAT_MAP.SHAME) player.startShameTimer();
            player.clowned = player.skinIndex === STORE_HAT_MAP.SHAME;
        }

        if (!player) return;

        if (player.team) {
            const allianceBucket = Client.allianceMap.get(player.team);
            const len = Client.alliancePlayers.length;
            if (!allianceBucket) return;

            allianceBucket.clear();
            allianceBucket.add(Client.mySID);

            for (let i = 0; i < len; i += 2) {
                const sid = Client.alliancePlayers[i] as number;
                allianceBucket.add(sid);
            }
        } else {
            Client.alliancePlayers.length = 0;
        }
    }

    private postTick(hidden: number[]) {
        let smallestDistance = Infinity;
        this.tmpSidSet.clear();

        const players = PlayerManager.players.handler.all;
        const stackedText = Menu.getValue("stackedText");
        const allVisible = PlayerManager.players.visible.all;
        const myPos = Client.player?.real_position;

        for (const sid of hidden) {
            const player = PlayerManager.get(sid);
            if (!player) continue;

            PlayerManager.players.visible.remove(player.sid);
            player.visible = false;
        }

        for (let i = 0; i < allVisible.length; i++) {
            const player = allVisible[i];
            if (!player) continue;

            if (player.clowned && player.skinIndex === STORE_HAT_MAP.SHAME)
                player.shameTimer -= ScriptConfig.SERVER_UPDATE_SPEED;

            // Restart the on-screen slide only for players whose position came in this tick (onTick already did, so
            // this is the same values). On a fake tick nobody's did: restarting it there pulled everyone back toward
            // their last real position, then forward again when the late update arrived (rubber-banding on a
            // jittery connection). Drawing only; no logic reads render_position or deltaTime.
            const positionUpdated = player.stateUpdate.position;
            if (positionUpdated) {
                player.last_render_position.x = player.render_position.x;
                player.last_render_position.y = player.render_position.y;
            }

            if (!player.stateUpdate.attribute) {
                if (player.skinIndex !== STORE_HAT_MAP.SHAME) player.lastSkinIndex = player.skinIndex;
            }

            PlayerCombatManager.updateReloads(player, ScriptConfig.SERVER_UPDATE_SPEED);
            player.appendHat(player.skinIndex);
            PlayerCombatManager.update(player, player.weaponIndex, player.weaponVariant);

            if (myPos && !Client.isFriendly(player.sid)) {
                tickState.enemyData.all.push(player);

                const pos = player.real_position;
                const distanceSq = getDistSq(pos, myPos);

                if (smallestDistance > distanceSq) {
                    smallestDistance = distanceSq;
                    tickState.enemyData.nearest = player;
                }

                const primaryId = player.weaponData.primary;
                const secondaryId = player.weaponData.secondary;

                const isGreatHammer = secondaryId === WEAPON_ID_MAP.GREAT_HAMMER;
                const isShield = secondaryId === WEAPON_ID_MAP.WOODEN_SHIELD;
                const isMcGrabby = secondaryId === WEAPON_ID_MAP.MC_GRABBY;
                const isKatana = primaryId === WEAPON_ID_MAP.KATANA;
                const isMusket = secondaryId === WEAPON_ID_MAP.MUSKET && player.weaponData.secondaryConfirmed;
                const isHomoWeapon = (secondaryId === WEAPON_ID_MAP.CROSSBOW || secondaryId === WEAPON_ID_MAP.REPEATER_CROSSBOW) && player.weaponData.secondaryConfirmed;
                const hasNormalHammer = primaryId === WEAPON_ID_MAP.TOOL_HAMMER;
                const canBowInsta = !hasNormalHammer && !isGreatHammer && !isShield && !isKatana && !isMcGrabby && !isMusket && !isHomoWeapon;

                const hasDiaPolearm = player.weaponData.primary === WEAPON_ID_MAP.POLEARM && player.weaponData.primaryVariant >= WEAPON_VARIANT_MAP.DIAMOND;
                const hasCorrectBow = player.weaponData.secondary === WEAPON_ID_MAP.CROSSBOW || player.weaponData.secondary === WEAPON_ID_MAP.REPEATER_CROSSBOW;
                const canBoostTick = hasDiaPolearm && hasCorrectBow && player.getReload(0) === 1 && player.getReload(1) === 1 && player.getReload(2) === 1;

                // idk if these ranges are right, just guessed pls no attack me :(
                if (canBoostTick && inRange(distanceSq, BOOST_TICK_MIN_DIST_SQ, BOOST_TICK_MAX_DIST_SQ)) {
                    tickState.enemyData.rangedInstaThreats++;
                }

                if (inRange(distanceSq, BOW_INSTA_MIN_DIST_SQ, BOW_INSTA_MAX_DIST_SQ) && canBowInsta && DefenseUtils.isInLineOfSight(player, PlayerCombatManager.fetch(player, 1))) {
                    tickState.enemyData.rangedInstaThreats++;
                }

                if (distanceSq <= NEARBY_ENEMY_DIST_SQ) {
                    player.ticksNotNearby = 0;
                    tickState.enemyData.nearby.push(player);
                } else {
                    player.ignoreDamageConsideration = false;
                    player.ticksNotNearby++;

                    if (player.ticksNotNearby >= 18) {
                        player.profilingData.preHitAttacks = 0;
                        player.profilingData.latePreHitAttacks = 0;

                        if (player.spikeId !== LIST_ID_MAP.POISON_SPIKES)
                            player.spikeId = LIST_ID_MAP.SPINNING_SPIKES;
                    }
                }
            }

            if (positionUpdated) player.deltaTime = 0;
            player.stateUpdate.attribute = false;
            player.stateUpdate.position = false;
            this.tmpSidSet.add(player.sid);
        }

        for (let i = 0, len = players.length; i < len; i++) {
            const player = players[i];
            if (!player) continue;

            if (!this.tmpSidSet.has(player.sid)) {
                player.resetReloads();
            }

            if (stackedText) {
                const healthHealed = ~~player.healthHealed;
                const damageTaken = ~~player.damageTaken;

                if (player.healthHealed > 0 && Client.mySID === player.sid)
                    TextManager.add(player.real_position.x, player.real_position.y, -healthHealed, 0);

                if (player.damageTaken > 0 && Client.mySID !== player.sid)
                    TextManager.add(player.real_position.x, player.real_position.y, damageTaken, 0);
            }

            player.healthHealed = 0;
            player.damageTaken = 0;
        }

        if (tickState.enemyData.nearest && myPos)
            tickState.enemyData.angle = getDir(tickState.enemyData.nearest.real_position, myPos);
    }

    run(positions: number[], attributes: WireValue[], hidden: number[]) {
        this.preTick();
        this.onTick(positions, attributes);
        this.postTick(hidden);

        // The mod brain runs in live games and replays alike.
        ModManager.main();

        for (const e of tickState.enemyData.all) e.damages.length = 0;
    }
}