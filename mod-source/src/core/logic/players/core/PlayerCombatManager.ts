import Client from "@core/Client";
import items, { WEAPON_ID_MAP, WEAPON_VARIANT_MAP } from "@constants/items";
import Player from "@constants/Player";
import ModManager from "@core/ModManager";
import ScriptConfig from "@utils/config/ScriptConfig";

export interface WeaponFetchData {
    dmg: number;
    totalKnock: number;
    knock: number;
    reload: number;
    variant: number;
    id: number;
    recentlyHit: boolean;
}

export default class PlayerCombatManager {
    private static updatePrimary(player: Player, id: number, variant?: number, didHit: boolean = false) {
        const weaponData = player.weaponData;
        const tick = ModManager.tick;

        weaponData.primary = id;
        weaponData.primaryConfirmed = true;

        // 1.8.2 gives one upgrade per age. Katana and Great Axe use the age-8 slot, which the
        // Crossbow also needs (and Repeater/Musket require the Crossbow), so these players can at
        // most have a Hunting Bow. Assuming a Musket for them overestimated threats.
        const usesAge8Slot = id === WEAPON_ID_MAP.KATANA || id === WEAPON_ID_MAP.GREAT_AXE;
        const worstSecondary = usesAge8Slot ? WEAPON_ID_MAP.HUNTING_BOW : WEAPON_ID_MAP.MUSKET;

        // A bow/crossbow can still be upgraded to a better ranged weapon, unless age 8 is taken.
        const isNotPermanentRange = !usesAge8Slot && (weaponData.secondary === WEAPON_ID_MAP.HUNTING_BOW || weaponData.secondary === WEAPON_ID_MAP.CROSSBOW);
        const impossibleSecondary = usesAge8Slot && weaponData.secondary !== WEAPON_ID_MAP.HUNTING_BOW &&
            items.weapons[weaponData.secondary]?.projectile !== undefined;

        if (!weaponData.secondaryConfirmed || isNotPermanentRange || impossibleSecondary || id === WEAPON_ID_MAP.TOOL_HAMMER) {
            player.reloads[worstSecondary] = 1;
            weaponData.lastTickSinceSecondaryReloaded = tick;

            // Unknown secondary: assume the worst case that is still possible for this primary,
            // so defenses stay safe until the real secondary is seen.
            weaponData.secondary = worstSecondary;
            weaponData.secondaryVariant = WEAPON_VARIANT_MAP.STONE;
            weaponData.secondaryConfirmed = false;
        }

        if (typeof variant === "number") weaponData.primaryVariant = variant;
        if (didHit) weaponData.lastPrimaryTickHit = tick;
    }

    private static updateSecondary(player: Player, id: number, variant?: number, didHit: boolean = false) {
        const weaponData = player.weaponData;
        const tick = ModManager.tick;

        weaponData.secondary = id;
        weaponData.secondaryConfirmed = true;

        const isPermanentRange = id === WEAPON_ID_MAP.MUSKET || id === WEAPON_ID_MAP.REPEATER_CROSSBOW;
        const isPermanentSecondary = id === WEAPON_ID_MAP.GREAT_HAMMER || id === WEAPON_ID_MAP.WOODEN_SHIELD;

        if (!weaponData.primaryConfirmed || weaponData.primary === WEAPON_ID_MAP.TOOL_HAMMER || (weaponData.primary === WEAPON_ID_MAP.SHORT_SWORD && !(isPermanentRange || isPermanentSecondary))) {
            player.reloads[WEAPON_ID_MAP.POLEARM] = 1;
            weaponData.primary = WEAPON_ID_MAP.POLEARM;
            weaponData.primaryConfirmed = false;
            weaponData.primaryVariant = WEAPON_VARIANT_MAP.DIAMOND;
            weaponData.lastTickSincePrimaryReloaded = tick;
        }

        if (typeof variant === "number") weaponData.secondaryVariant = variant;
        if (didHit) weaponData.lastSecondaryTickHit = tick;
    }

    static update(player: Player, id: number, variant?: number, didHit: boolean = false) {
        if (id < 9) {
            this.updatePrimary(player, id, variant, didHit);
            return;
        }

        this.updateSecondary(player, id, variant, didHit);
    }

    static updateReloads(player: Player, delta: number) {
        const tick = ModManager.tick;
        const weaponData = player.weaponData;
        const weaponIndex = player.weaponIndex;
        const lastHit = player.weaponIndex < 9 ? weaponData.lastPrimaryTickHit : weaponData.lastSecondaryTickHit;

        if (player.buildIndex === -1 && tick - lastHit > 1) {
            const wpn = items.weapons[weaponIndex];

            weaponData.lastPrimaryReload = player.reloads[weaponData.primary];
            weaponData.lastSecondaryReload = player.reloads[weaponData.secondary];
            const wasReloaded = player.reloads[weaponIndex] === 1;

            player.reloads[weaponIndex] = Math.min(
                1,
                player.reloads[weaponIndex] + (delta / player.getReloadTime(weaponIndex))
            );

            if (player.reloads[weaponIndex] === 1 && !wasReloaded) {
                if (weaponIndex < 9) weaponData.lastTickSincePrimaryReloaded = tick;
                else weaponData.lastTickSinceSecondaryReloaded = tick;
            }
        }

        if (tick - weaponData.lastTurretTickHit > 1) player.reloads[53] = Math.min(
            1,
            player.reloads[53] + (delta / ScriptConfig.TURRET_GEAR_RELOAD)
        );
    }

    // holy 20 data objects should be enough, if somehow a module uses it all, then holy shit coding wtf these are suppose to be short-lived
    private static dataBufferHead = 0;
    private static weaponFetchDataBuffer: WeaponFetchData[] = [
        this.createFetchData(), this.createFetchData(), this.createFetchData(), this.createFetchData(),
        this.createFetchData(), this.createFetchData(), this.createFetchData(), this.createFetchData(),
        this.createFetchData(), this.createFetchData(), this.createFetchData(), this.createFetchData(),
        this.createFetchData(), this.createFetchData(), this.createFetchData(), this.createFetchData(),
        this.createFetchData(), this.createFetchData(), this.createFetchData(), this.createFetchData()
    ];

    private static createFetchData(): WeaponFetchData {
        return { dmg: 0, totalKnock: 0, knock: 0, reload: 0, variant: 0, id: 0, recentlyHit: false };
    }

    /** Resources for one shot (bow/crossbow: wood, musket: 10 stone). Full price = safe worst case. */
    static canAffordShot(player: Player, weaponId: number) {
        const req = items.weapons[weaponId].req;
        if (!req) return true;
        return ((player as unknown as Record<string, number>)[req[0]] ?? 0) >= req[1];
    }

    static fetch(player: Player, group: 0 | 1 | 2): WeaponFetchData {
        const data = this.weaponFetchDataBuffer[this.dataBufferHead];
        this.dataBufferHead = (this.dataBufferHead + 1) % this.weaponFetchDataBuffer.length;

        const tick = ModManager.tick;

        const weaponData = player.weaponData;
        const id = group === 0 ? weaponData.primary : weaponData.secondary;
        const weapon = items.weapons[id];

        const variant = group === 0 ? weaponData.primaryVariant : weaponData.secondaryVariant;
        const reload = player.getReload(group);
        const hasProjectile = weapon.projectile !== undefined;

        const lastHitTick = group === 2 ? weaponData.lastTurretTickHit :
            group === 0 ? weaponData.lastPrimaryTickHit : weaponData.lastSecondaryTickHit;
        const recentlyHit = tick - lastHitTick <= 2;

        const dmg = weapon.dmg * (hasProjectile ? 1 : ScriptConfig.WEAPON_VARIANTS[variant].val);
        const knock = weapon.knock ?? 0;
        const totalKnock = knock + .3;

        data.dmg = dmg;
        data.id = group === 2 ? 53 : id;
        data.knock = knock;
        data.totalKnock = totalKnock;
        data.recentlyHit = recentlyHit;
        data.reload = reload;
        data.variant = variant;

        // Our own bow/musket can't fire without ammo (1.8.2 checks it before every shot, even on
        // sandbox servers which just don't take it away): treat it as not reloaded so combos skip it.
        // Musket recoil (rec 0.35) only pushes the shooter and shows up in our next position update.
        if (group !== 2 && hasProjectile && player.sid === Client.mySID && !this.canAffordShot(player, id)) {
            data.reload = 0;
        }

        return data;
    }
}