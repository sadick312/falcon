import { ListItem } from "@constants/items";
import Player from "@entities/Player";
import ObjectManager from "@core/logic/ObjectManager";
import getDir from "@utils/angle/getDir";
import getDist from "@utils/geometry/getDist";
import IntervalHelper, { Interval } from "@utils/geometry/IntervalHelper";
import { PLAYER_SCALE } from "@constants/world";
import { at } from "@utils/array/at";

export default class ObjectUtils {
    private static readonly MAX_INTERVALS = 64;
    public static readonly spikeArcBuffer: Interval[] = Array.from({ length: ObjectUtils.MAX_INTERVALS }, () => [0, 0]);
    public static spikeArcBufferLength = 0;

    private static readonly swapBuffer: Interval[] = Array.from({ length: ObjectUtils.MAX_INTERVALS }, () => [0, 0]);

    static getSpikeBounceArc(builder: Player, victim: Player, item: ListItem, ignoreSID?: number): number {
        const builderPos = builder.real_position;
        const victimPos = victim.real_position;

        const dist = getDist(builderPos, victimPos);
        const builderToVictim = getDir(victimPos, builderPos);

        const placementRadius = PLAYER_SCALE + item.scale + (item.placeOffset ?? 0);
        const hitBoxScale = item.scale + PLAYER_SCALE;

        if (dist > placementRadius + hitBoxScale) {
            ObjectUtils.spikeArcBufferLength = 0;
            return 0;
        }

        const num = (placementRadius * placementRadius) + (dist * dist) - (hitBoxScale * hitBoxScale);
        const den = 2 * dist * placementRadius;

        let cosVal = num / den;
        if (cosVal < -1) cosVal = -1;
        else if (cosVal > 1) cosVal = 1;

        const theta = Math.acos(cosVal);
        const minAngle = builderToVictim - theta;
        const maxAngle = builderToVictim + theta;

        const firstArc = at(ObjectUtils.spikeArcBuffer, 0);
        firstArc[0] = minAngle;
        firstArc[1] = maxAngle;
        ObjectUtils.spikeArcBufferLength = 1;

        const closeObjects = ObjectManager.pool.closeObjects;
        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            if (!gameObject || ignoreSID === gameObject.sid) continue;

            const blockedCount = IntervalHelper.computeInterval(builderPos, gameObject, item);
            if (blockedCount === 0) continue;

            for (let j = 0; j < blockedCount; j++) {
                if (ObjectUtils.spikeArcBufferLength === 0) break;

                const currentCount = ObjectUtils.spikeArcBufferLength;
                for (let k = 0; k < currentCount; k++) {
                    const from = at(ObjectUtils.spikeArcBuffer, k);
                    const to = at(ObjectUtils.swapBuffer, k);
                    to[0] = from[0];
                    to[1] = from[1];
                }

                const blocked = at(IntervalHelper.computeBuffer, j);
                const bStart = blocked[0];
                const bEnd = blocked[1];

                ObjectUtils.spikeArcBufferLength = IntervalHelper.subtractInterval(currentCount, bStart, bEnd, ObjectUtils.swapBuffer);

                // subtractInterval writes into IntervalHelper.intervalBuffer: copy the open arcs back, so the next
                // building subtracts from what is left and callers read the result here.
                for (let k = 0; k < ObjectUtils.spikeArcBufferLength; k++) {
                    const from = at(IntervalHelper.intervalBuffer, k);
                    const to = at(ObjectUtils.spikeArcBuffer, k);
                    to[0] = from[0];
                    to[1] = from[1];
                }
            }
        }

        return ObjectUtils.spikeArcBufferLength;
    }
}