import Player from "@entities/Player";
import Menu from "@menu/Menu";
import { STORE_ACCESSORY_MAP, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerManager from "@core/logic/players/PlayerManager";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import PingTracker from "@core/mod/utils/PingTracker";
import { tickState } from "@core/TickState";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import { ChatLog } from "@menu/Menu";
import PacketMap from "@root/utils/socket/PacketMap";
import ScriptConfig from "@utils/config/ScriptConfig";
import { ANGEL_WINGS_REGEN, BULL_HEALTH_DRAIN } from "@constants/hatNumbers";

type HealthUpdatePacket = typeof PacketMap.SERVER_TO_CLIENT.UPDATE_HEALTH;

export default class HealthUpdateEvent extends MessageHandler<HealthUpdatePacket> {
    /**
     * Whether a heal of ours can be food we ate: 1.8.2 changes shame only when food is eaten, not on regen, healing
     * accessories or healing pads. The heal reaches us a tick after we eat, plus our ping. For enemies see
     * healCountsAsFood.
     */
    private static ateRecently() {
        // With "Jitter-Safe Timing", room for a heal that comes back late because the ping jumped (twice the jitter).
        const jitterRoom = 2 * PingTracker.jitterMargin(Menu.getValue("jitterSafeTiming") === true);
        const ticksOfPing = Math.ceil((PingTracker.getStablePing() + jitterRoom) / ScriptConfig.SERVER_UPDATE_SPEED);
        return tickState.tick - Client.lastAteTick <= 2 + ticksOfPing;
    }

    /**
     * Whether an enemy's heal looks like food. Food heals 20 (apple), 30 (cheese) or 40 (cookie), less only when it
     * hits full health. The rest heals less: healing pad 15, hat and accessory regen 1-6 (Angel Wings 3, Apple
     * Basket 1), cheese's slow part 10. Dark Knight's lifesteal can look like food; it can't be told apart.
     */
    static looksLikeFood(delta: number, health: number, maxHealth: number) {
        return delta >= 20 || (delta > 15 && health >= maxHealth);
    }

    /** Whether this heal changes shame: ours only if we just ate; an enemy's always, or with "Accurate Enemy Shame" only if it looks like food. */
    private healCountsAsFood(player: Player, delta: number, health: number) {
        if (player.sid === Client.mySID) return HealthUpdateEvent.ateRecently();
        if (!Menu.getValue("accurateEnemyShame")) return true;
        return HealthUpdateEvent.looksLikeFood(delta, health, player.maxHealth);
    }

    private onHeal(player: Player, delta: number, health: number) {
        // A heal that isn't food leaves shame alone and keeps the hit time: in 1.8.2 only eating clears it.
        if (player.hitTime && this.healCountsAsFood(player, delta, health)) {
            const timeSinceHit = tickState.tick - player.hitTime;
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
        const tick = tickState.tick;

        // The bull helmet drains 5 health once a second (2 with Angel Wings' +3 regen on). Any 5 damage counts as that
        // drain, whatever hat the player seems to wear, on purpose: the bull helmet usually goes on just before the
        // drain, and the server reports the drain before the player update that shows the helmet. Requiring the
        // helmet would miss our own drain (keeping the helmet on up to 9 more ticks) and lose enemies' bull timing.
        // Nothing else in 1.8.2 deals exactly 5. The 2 with Angel Wings is too common a number to count without the
        // helmet visibly on.
        const isBullDrain = delta === -BULL_HEALTH_DRAIN ||
            (delta === ANGEL_WINGS_REGEN - BULL_HEALTH_DRAIN && player.skinIndex === STORE_HAT_MAP.BULL_HELMET && player.tailIndex === STORE_ACCESSORY_MAP.ANGEL_WINGS);

        if (isBullDrain) {
            player.bullTick = tick - 1;
            if (sid === Client.mySID) HatSystem.needTick = 0;
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

        if (delta >= 0) this.onHeal(player, delta, health);
        else this.onDamage(player, sid, delta);

        player.health = health;
        if (health <= 0 && !Client.isFriendly(sid)) {
            Menu.addChatLog(new ChatLog(`${player.name} {${player.sid}} has died (${player.damages.join(",")})`, "death"));
        }
    }
}