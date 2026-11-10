import { STORE_ACCESSORY_MAP, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import DefenseSystem, { DefenseContext } from "@core/mod/defense/DefenseSystem";
import HealerUtils from "@core/mod/defense/utils/HealerUtils";
import WingsUtils from "@core/mod/defense/utils/WingsUtils";
import { tickState } from "@core/TickState";
import Menu from "@menu/Menu";
import { SOLDIER_DAMAGE_TAKEN } from "@constants/hatNumbers";

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
    /** From this shame count on, a coming Blood Wings hit replaces eating (8 locks healing for 30 s in 1.8.2). */
    static readonly BLOOD_WINGS_SHAME = 4;

    static heal() {
        if (DefenseSystem.alreadyHealed || !Menu.getValue("autoHeal"))
            return;

        const player = Client.player;
        const remainingHealth = player.maxHealth - player.health;

        const foodId = player.items[0] ?? NaN;
        const amount = HealerUtils.getFoodValue(foodId);
        const times = Math.ceil(remainingHealth / amount);

        DefenseSystem.alreadyHealed = true;
        for (let i = 0; i < times; i++) PlacementSystem.place(foodId);
        tickState.brainState.healingUsed = times;
        tickState.activityList.push(`autoHealing x${times}`);
    }

    private static healIfNoShame() {
        const player = Client.player;
        if (tickState.tick - player.hitTime <= 1)
            return;

        // Blood Wings Optimizations: at high shame, let a hit with Blood Wings (already on) heal instead of eating:
        // that healing doesn't add shame. Only for this non-lethal heal; lethal damage is handled above.
        if (
            Menu.getValue("bloodWingsOptimizations") && player.shameCount >= AutoHealer.BLOOD_WINGS_SHAME &&
            player.tailIndex === STORE_ACCESSORY_MAP.BLOOD_WINGS && WingsUtils.willHitPlayer()
        ) {
            tickState.brainState.healingResponse = "blood wings heal";
            return;
        }

        this.heal();
        tickState.brainState.healingResponse = "0shame heal";
    }

    static main(ctx: DefenseContext) {
        const player = Client.player;
        tickState.brainState.healingInternal.currentHealth = player.health;
        if (player.health === 100 || player.health <= 0 || player.clowned) return;

        const healthAfterDamage = player.health - ctx.totalDamage;
        const willDieIfDoNothing = healthAfterDamage <= 0;
        const alreadyForcedHat = DefenseSystem.skinIndex !== STORE_HAT_MAP.IGNORE;

        tickState.brainState.healingInternal.healthAfterDamage = healthAfterDamage;
        tickState.brainState.healingInternal.willDieIfDoNothing = willDieIfDoNothing;
        tickState.brainState.healingInternal.alreadyForcedHat = alreadyForcedHat;
        tickState.brainState.healingInternal.empDamage = ctx.empDamage;
        tickState.brainState.healingInternal.healthAfterSoldier = player.health - ctx.totalDamage * SOLDIER_DAMAGE_TAKEN;
        tickState.brainState.healingInternal.expectedDamage = ctx.totalDamage;

        if (willDieIfDoNothing && alreadyForcedHat) {
            // The Hat System can't put on a hat we don't own, so only count on soldier's 0.75× when we have it.
            if (DefenseSystem.skinIndex === STORE_HAT_MAP.SOLDIER_HELMET && player.skins[STORE_HAT_MAP.SOLDIER_HELMET]) {
                if (player.health - ctx.totalDamage * SOLDIER_DAMAGE_TAKEN <= 0) {
                    this.heal();
                    tickState.brainState.healingResponse = "instant soldier + heal";
                    return;
                } else {
                    tickState.brainState.healingResponse = "instant soldier + no heal";
                    return;
                }
            } else {
                this.heal();
                tickState.brainState.healingResponse = "instant random hat + heal";
                return;
            }
        }

        if (willDieIfDoNothing) {
            if (ctx.canEMP && ctx.empDamage > 0 && healthAfterDamage + ctx.empDamage > 0 && player.skins[STORE_HAT_MAP.EMP_HELMET]) {
                DefenseSystem.skinIndex = STORE_HAT_MAP.EMP_HELMET;
                tickState.brainState.healingResponse = "0shame emp anti";
            } else if (ctx.canSoldier && player.health - ctx.totalDamage * SOLDIER_DAMAGE_TAKEN > 0 && player.skins[STORE_HAT_MAP.SOLDIER_HELMET]) {
                DefenseSystem.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
                tickState.brainState.healingResponse = "0shame soldier anti";
            } else {
                this.heal();
                tickState.brainState.healingResponse = "instant heal";
                return;
            }
        }

        this.healIfNoShame();
    }
}