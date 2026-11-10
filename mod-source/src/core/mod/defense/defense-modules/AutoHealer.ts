import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import DefenseSystem, { DefenseContext } from "@core/mod/defense/DefenseSystem";
import HealerUtils from "@core/mod/defense/utils/HealerUtils";
import ShameRules from "@core/mod/defense/utils/ShameRules";
import Latency from "@core/mod/utils/Latency";
import PacketTracker from "@core/utils/PacketTracker";
import ScriptConfig from "@utils/config/ScriptConfig";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";

export interface AutoHealerInternal {
    healthAfterDamage: number;
    willDieIfDoNothing: boolean;
    alreadyForcedHat: boolean;
    empDamage: number;
    healthAfterSoldier: number;
    currentHealth: number;
    expectedDamage: number;
}

export default class AutoHealer {
    /** HP we've eaten for but haven't seen confirmed by the server yet (heals take ~1 RTT to show). */
    private static pendingHeal = 0;
    /** After this time, assume the pending heal failed (e.g. Shame) and allow healing again. */
    private static pendingUntil = 0;
    private static safeHealTimer: number | null = null;

    /** Called when our own health goes up, so in-flight heals aren't counted twice. */
    static onHealConfirmed(delta: number) {
        this.pendingHeal = Math.max(0, this.pendingHeal - delta);
    }

    /** Health including heals already on their way; prevents double heals at high ping. */
    static getEffectiveHealth() {
        const player = Client.player;
        if (performance.now() > this.pendingUntil) this.pendingHeal = 0;
        return Math.min(player.maxHealth, player.health + this.pendingHeal);
    }

    /** Eats enough food to reach max health. Returns how many items were eaten. */
    private static sendHeal(maxPackets?: number) {
        const player = Client.player;
        const missing = player.maxHealth - this.getEffectiveHealth();
        if (missing <= 0) return 0;

        const foodId = player.items[0];
        const amount = HealerUtils.getFoodValue(foodId);
        let times = Math.ceil(missing / amount);
        if (typeof maxPackets === "number") times = Math.min(times, maxPackets);
        if (times <= 0) return 0;

        for (let i = 0; i < times; i++) PlacementSystem.place(foodId);

        this.pendingHeal += Math.min(missing, times * amount);
        // The result arrives ~1 RTT later, within the next server tick; add a small margin.
        this.pendingUntil = performance.now() + Latency.getRtt() + ScriptConfig.SERVER_UPDATE_SPEED + 50;
        return times;
    }

    static heal() {
        if (DefenseSystem.alreadyHealed || !Menu.getValue("autoHeal"))
            return;

        DefenseSystem.alreadyHealed = true;
        const times = this.sendHeal();
        if (times === 0) return;

        ModManager.brainState.healingUsed = times;
        ModManager.activityList.push(`autoHealing x${times}`);
    }

    /**
     * Heal without gaining shame. If it's too soon after the last hit (see ShameRules), schedule the
     * heal for the exact moment it becomes safe instead of waiting whole server ticks.
     */
    private static healIfNoShame() {
        const wait = ShameRules.msUntilSafeEat(Client.player, Latency.getLowRtt());

        if (wait <= 0) {
            this.heal();
            ModManager.brainState.healingResponse = "0shame heal";
            return;
        }

        ModManager.brainState.healingResponse = `0shame heal in ${Math.ceil(wait)}ms`;
        if (this.safeHealTimer !== null) clearTimeout(this.safeHealTimer);

        this.safeHealTimer = window.setTimeout(() => {
            this.safeHealTimer = null;
            const player = Client.player;

            if (!Client.isAlive || !player || player.clowned || !Menu.getValue("autoHeal")) return;
            // A newer hit arrived meanwhile: the next server tick will reschedule.
            if (ShameRules.msUntilSafeEat(player, Latency.getLowRtt()) > 0) return;

            const allowed = PacketTracker.request("FOOD", PacketTracker.TOTAL_FOOD);
            const times = this.sendHeal(allowed);
            if (times > 0) ModManager.activityList.push(`timedHeal x${times}`);
        }, wait + 1);
    }

    static main(ctx: DefenseContext) {
        const player = Client.player;
        ModManager.brainState.healingInternal.currentHealth = player.health;
        if (player.health <= 0 || player.clowned) return;

        // Count heals already in flight so high ping doesn't cause double heals.
        const health = this.getEffectiveHealth();
        if (health >= player.maxHealth) return;

        const healthAfterDamage = health - ctx.totalDamage;
        const willDieIfDoNothing = healthAfterDamage <= 0;
        const alreadyForcedHat = DefenseSystem.skinIndex !== STORE_HAT_MAP.IGNORE;

        ModManager.brainState.healingInternal.healthAfterDamage = healthAfterDamage;
        ModManager.brainState.healingInternal.willDieIfDoNothing = willDieIfDoNothing;
        ModManager.brainState.healingInternal.alreadyForcedHat = alreadyForcedHat;
        ModManager.brainState.healingInternal.empDamage = ctx.empDamage;
        ModManager.brainState.healingInternal.healthAfterSoldier = health - ctx.totalDamage * .75;
        ModManager.brainState.healingInternal.expectedDamage = ctx.totalDamage;

        if (willDieIfDoNothing && alreadyForcedHat) {
            if (DefenseSystem.skinIndex === STORE_HAT_MAP.SOLDIER_HELMET) {
                if (health - ctx.totalDamage * .75 <= 0) {
                    this.heal();
                    ModManager.brainState.healingResponse = "instant soldier + heal";
                    return;
                } else {
                    ModManager.brainState.healingResponse = "instant soldier + no heal";
                    return;
                }
            } else {
                this.heal();
                ModManager.brainState.healingResponse = "instant random hat + heal";
                return;
            }
        }

        if (willDieIfDoNothing) {
            if (ctx.canEMP && ctx.empDamage > 0 && healthAfterDamage + ctx.empDamage > 0 && player.skins[STORE_HAT_MAP.EMP_HELMET]) {
                DefenseSystem.skinIndex = STORE_HAT_MAP.EMP_HELMET;
                ModManager.brainState.healingResponse = "0shame emp anti";
            } else if (ctx.canSoldier && health - ctx.totalDamage * .75 > 0 && player.skins[STORE_HAT_MAP.SOLDIER_HELMET]) {
                DefenseSystem.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
                ModManager.brainState.healingResponse = "0shame soldier anti";
            } else {
                this.heal();
                ModManager.brainState.healingResponse = "instant heal";
                return;
            }
        }

        this.healIfNoShame();
    }
}