import CombatUtils from "@combat-utils/CombatUtils";
import items, { LIST_ID_MAP, WEAPON_ID_MAP } from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import CombatController from "@core/mod/combat/core/CombatController";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import PacketTracker from "@core/utils/PacketTracker";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import { tickState } from "@core/TickState";
import Menu from "@menu/Menu";
import PlacerUtils from "@placing/utils/PlacerUtils";
import { Input } from "@ui/Hook";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";

const HALF_PI = Math.PI / 2;

export default class AutoGrinder {
    static weaponIndex = 0;
    static aimDir = 0;

    private static lastTick = -1;
    private static spots: number[] = [];
    private static lastResult = false;

    /**
     * Grinds once per tick and returns whether it did. CombatController and PlacementSystem both call this each tick
     * (each to skip its own work while grinding); before, both calls placed and swung, so every placement went out twice.
     */
    static main(): boolean {
        if (tickState.tick === this.lastTick) return this.lastResult;
        this.lastTick = tickState.tick;
        this.lastResult = this.grind();
        return this.lastResult;
    }

    private static grind(): boolean {
        const player = Client.player;
        if (!Menu.getValue("autoGrind")) {
            this.weaponIndex = Client.weaponIndex;
            return false;
        }

        const tpId = PlacerUtils.placeSevenSlot(player);
        const offset = Math.PI * .45;

        const primaryLimit = parseInt(Menu.getValue("grindPrimaryLimit"));
        const secondaryLimit = parseInt(Menu.getValue("grindSecondaryLimit"));
        const hasPrimaryReached = player.weaponData.primaryVariant >= primaryLimit;

        const primaryId = player.weapons[0];
        const secondaryId = player.weapons[1];

        const haveSecondary = typeof secondaryId === "number";
        const isProjectile = haveSecondary && items.weapons[secondaryId].projectile !== undefined;
        const hasSecondaryReached = !haveSecondary || isProjectile || player.weaponData.secondaryVariant >= secondaryLimit;

        if (hasPrimaryReached && hasSecondaryReached) {
            Menu.setValue("autoGrind", false);
            return false;
        }

        let targetId = this.weaponIndex;

        if (this.weaponIndex < 9) {
            if (hasPrimaryReached && !hasSecondaryReached) {
                this.weaponIndex = secondaryId;
                targetId = secondaryId;
            }
        } else {
            if (hasSecondaryReached && !hasPrimaryReached) {
                this.weaponIndex = primaryId;
                targetId = primaryId;
            }
        }

        const rawAimDir = Input.getAttackDir();
        const aimDir = Math.round(rawAimDir / HALF_PI) * HALF_PI;
        const shouldUseSecondaryAssist = tpId === LIST_ID_MAP.TURRET && CombatUtils.isAttackPrimary(primaryId) && targetId === primaryId && secondaryId === WEAPON_ID_MAP.GREAT_HAMMER;
        this.aimDir = aimDir;

        if (shouldUseSecondaryAssist) targetId = secondaryId;
        const closeObjects = ObjectManager.pool.closeObjects;
        const secondaryHitDamage = BreakerUtils.getObjectDamage(player, 1, !player.skins[STORE_HAT_MAP.TANK_GEAR]);
        const wpnRange = items.weapons[primaryId].range - 1;
        let hasTurrets = false;

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            if (tpId !== LIST_ID_MAP.TURRET) break;
            if (!gameObject || gameObject.id !== LIST_ID_MAP.TURRET) continue;

            const tmpDir = getDir(gameObject, player.real_position);
            if (getAngleDist(aimDir, tmpDir) > ScriptConfig.GATHER_ANGLE) continue;
            if (gameObject.health > secondaryHitDamage) continue;
            if (!BreakerUtils.getObjectAttackDistance(player, gameObject, wpnRange)) continue;

            if (shouldUseSecondaryAssist) targetId = primaryId;
            hasTurrets = true;
            break;
        }

        const spots = this.spots;
        spots.length = 0;
        if (tpId === LIST_ID_MAP.TURRET) {
            if (!hasTurrets) spots.push(aimDir, aimDir + offset, aimDir - offset);
        } else {
            const Q_PI = Math.PI * .25;
            spots.push(aimDir + Q_PI, aimDir - Q_PI);
        }

        // Like the other placers, ask the packet budget first; it only says no close to the server's packet limit.
        let allowed = spots.length ? PacketTracker.request("PLACE", spots.length) : 0;
        for (let i = 0; i < spots.length && allowed > 0; i++) {
            if (PlacementSystem.checkPlace(tpId, spots[i])) allowed--;
        }

        CombatController.selectWeapon(targetId, true);
        if (player.getReload(targetId < 9 ? 0 : 1) === 1) {
            CombatController.skinIndex = STORE_HAT_MAP.TANK_GEAR;
            CombatController.hitOnce();
        }
        return true;
    }
}