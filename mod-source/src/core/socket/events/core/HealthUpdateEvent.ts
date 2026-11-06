import Player from "@entities/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerManager from "@core/logic/players/PlayerManager";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import PingTracker from "@core/mod/utils/PingTracker";
import ModManager from "@core/ModManager";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import { ChatLog } from "@menu/Menu";
import { addChatLog } from "@menu/utils/drawChatLog";
import PacketMap from "@root/utils/socket/PacketMap";
import ScriptConfig from "@utils/config/ScriptConfig";

type HealthUpdatePacket = typeof PacketMap.SERVER_TO_CLIENT.UPDATE_HEALTH;

export default class HealthUpdateEvent extends MessageHandler<HealthUpdatePacket> {
    /**
     * Whether a heal of ours can be food we ate: 1.8.2 changes shame only when food is eaten, not on regen, healing
     * accessories or healing pads. The heal reaches us a tick after we eat, plus our ping. Enemies' heals all count,
     * since we can't tell what they ate.
     */
    private static ateRecently() {
        const ticksOfPing = Math.ceil(PingTracker.getStablePing() / ScriptConfig.SERVER_UPDATE_SPEED);
        return ModManager.tick - Client.lastAteTick <= 2 + ticksOfPing;
    }

    private onHeal(player: Player, delta: number) {
        if (player.hitTime && (player.sid !== Client.mySID || HealthUpdateEvent.ateRecently())) {
            const timeSinceHit = ModManager.tick - player.hitTime;
            player.hitTime = 0;

            if (timeSinceHit <= 1) {
                player.shameCount++;
                if (player.shameCount > 7) player.shameCount = 0;
            } else {
                player.shameCount = Math.max(0, player.shameCount - 2);
            }
        }

        if (player.visible) player.healthHealed += delta;
    }

    private onDamage(player: Player, sid: number, delta: number) {
        const tick = ModManager.tick;

        if (player.skinIndex === STORE_HAT_MAP.BULL_HELMET) {
            if (player.tailIndex === 13) {
                if (delta === -2) {
                    player.bullTick = tick - 1;

                    if (sid === Client.mySID) {
                        HatSystem.needTick = 0;
                    }
                }
            } else {
                if (delta === -5) {
                    player.bullTick = tick - 1;

                    if (sid === Client.mySID) {
                        HatSystem.needTick = 0;
                    }
                }
            }
        }

        if (delta === -5) {
            player.bullTick = tick - 1;

            if (sid === Client.mySID) {
                HatSystem.needTick = 0;
            }
        }

        const d = Math.abs(delta);
        player.hitTime = tick;
        player.damages.push(d);
        if (player.visible) player.damageTaken += d;
    }

    run(sid: number, health: number) {
        const player = PlayerManager.get(sid);
        if (!player) return;

        const delta = health - player.health;

        if (delta >= 0) this.onHeal(player, delta);
        else this.onDamage(player, sid, delta);

        player.health = health;
        if (health <= 0 && !Client.isFriendly(sid)) {
            addChatLog(new ChatLog(`${player.name} {${player.sid}} has died (${player.damages.join(",")})`, "death"));
        }
    }
}