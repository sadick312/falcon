import Player from "@entities/Player";
import Angle from "@core/mod/combat/placing/Angle";
import { PreplacementQueue } from "@core/mod/combat/placing/modules/AutoPlacer";
import { Replacement } from "@placing/modules/AutoReplacer";
import getAngleDist from "@utils/angle/getAngleDist";
import withinDist from "@utils/geometry/withinDist";

export default class PlacerUtils {
    private static sevenSlotIds = new Set([17, 18, 19, 21, 22]);

    static placeSevenSlot(player: Player) {
        const tpId = player.items[5] ?? NaN;

        if (!this.sevenSlotIds.has(tpId)) {
            return player.items[6] ?? NaN;
        }

        return tpId;
    }

    static filterWithoutOverlap(bestAngles: Angle[], currentAngle: Angle) {
        const isNewImportant = currentAngle.kill.size > 0 || currentAngle.pitSpike.size > 0 || currentAngle.spikePush.size > 0;

        for (let i = 0, len = bestAngles.length; i < len; i++) {
            const item = bestAngles[i];
            if (item === undefined) continue;
            const isOverlapping = withinDist(item, currentAngle, item.scale + currentAngle.scale);

            const isImportant = item.kill.size > 0 || item.pitSpike.size > 0 || item.spikePush.size > 0;
            const isOverlappingImportant = isNewImportant && isImportant;

            if (isOverlapping || isOverlappingImportant) {
                return true;
            }
        }

        return false;
    }

    static checkForPreplacements(preplacements: PreplacementQueue[], currentAngle: Angle, currentTick: number) {
        for (let i = 0, len = preplacements.length; i < len; i++) {
            const preplacement = preplacements[i];
            if (preplacement === undefined) continue;
            if (currentTick - preplacement.tick > 1) continue;

            for (let j = 0; j < preplacement.count; j++) {
                const item = preplacement.placements[j];
                if (item === undefined) continue;
                const scale = item.scale;

                const isOverlapping = withinDist(item, currentAngle, scale + currentAngle.scale);
                if (isOverlapping) return true;
            }
        }

        return false;
    }

    static filterWithOverlap(bestAngles: Angle[], currentAngle: Angle) {
        const isNewImportant = currentAngle.kill.size > 0 || currentAngle.pitSpike.size > 0 || currentAngle.spikePush.size > 0;

        for (let i = 0, len = bestAngles.length; i < len; i++) {
            const item = bestAngles[i];
            if (item === undefined) continue;

            const isImportant = item.kill.size > 0 || item.pitSpike.size > 0 || item.spikePush.size > 0;
            const isOverlapping = withinDist(item, currentAngle, item.scale + currentAngle.scale);
            const withinOverlapThreshold = getAngleDist(item.angle, currentAngle.angle) < 0.3;

            const isOverlappingImportant = isNewImportant && isImportant;

            if (withinOverlapThreshold || (isOverlapping && isImportant) || isOverlappingImportant) {
                return true;
            }
        }

        return false;
    }

    static checkPreplacementOverlap(bestAngles: Angle[], currentAngle: Angle) {
        for (let i = 0, len = bestAngles.length; i < len; i++) {
            const item = bestAngles[i];
            if (!item || (!item.preplace && !item.predict)) continue;

            const isOverlapping = withinDist(item, currentAngle, item.scale + currentAngle.scale);
            if (isOverlapping) return true;
        }

        return false;
    }

    static filterOverlapWithReplacements(replacements: Replacement[], currentAngle: Angle, currentTick: number) {
        for (let i = 0, len = replacements.length; i < len; i++) {
            const replacement = replacements[i];
            if (replacement === undefined) continue;
            if (currentTick - replacement.tick > 2) continue;

            const isOverlapping = withinDist(replacement, currentAngle, replacement.scale + currentAngle.scale);
            if (isOverlapping) return true;
        }

        return false;
    }
}