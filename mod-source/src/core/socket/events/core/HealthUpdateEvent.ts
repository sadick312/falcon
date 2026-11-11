import Player from "@constants/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerManager from "@core/logic/players/PlayerManager";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import ModManager from "@core/ModManager";
import AutoHealer from "@core/mod/defense/defense-modules/AutoHealer";
import ShameRules from "@core/mod/defense/utils/ShameRules";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import Menu, { ChatLog } from "@menu/Menu";
import drawChatLog from "@menu/utils/drawChatLog";
import PacketMap from "@root/utils/socket/PacketMap";

type HealthUpdatePacket = typeof PacketMap.SERVER_TO_CLIENT.UPDATE_HEALTH;

export default class HealthUpdateEvent extends MessageHandler<HealthUpdatePacket> {
    private onHeal(player: Player, delta: number, newHealth: number) {
        // Only eating touches shame on the server; regen (Medic Gear, healing pad, ...) doesn't.
        // Our own shame is counted when we send the eat (ShameRules.onOwnEat), not here.
        if (player.sid !== Client.mySID && player.hitTimeMs && ShameRules.isFoodHeal(delta, newHealth, player.maxHealth)) {
            const now = performance.now();

            if (ShameRules.wasShameEat(player, now)) {
                player.shameCount++;
                if (player.shameCount > 7) player.shameCount = 0; // 8th -> Shame hat, server resets count
            } else {
                player.shameCount = Math.max(0, player.shameCount - 2);
            }

            // The server clears its hit time on every eat.
            player.hitTime = 0;
            player.hitTimeMs = 0;
        }

        if (player.sid === Client.mySID) AutoHealer.onHealConfirmed(delta);
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
        player.hitTimeMs = performance.now();
        player.damages.push(d);
        if (player.visible) player.damageTaken += d;
    }

    run(sid: number, health: number) {
        const player = PlayerManager.get(sid);
        if (!player) return;

        const delta = health - player.health;

        if (delta > 0) this.onHeal(player, delta, health);
        else if (delta < 0) this.onDamage(player, sid, delta);

        player.health = health;
        if (health <= 0 && !Client.isFriendly(sid)) {
            Menu.addChatLog(new ChatLog(`${player.name} {${player.sid}} has died (${player.damages.join(",")})`, "death"));
            if (Menu.selectedTab === 5) drawChatLog();
        }
    }
}