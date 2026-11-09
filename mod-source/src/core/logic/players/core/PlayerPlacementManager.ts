import { at } from "@utils/array/at";
import { getItem, WEAPON_ID_MAP } from "@constants/items";
import Player from "@entities/Player";
import Client from "@core/Client";
import PotentialObjectManager from "@core/logic/PotentialObjectManager";
import AngleFinder, { FinderOptions } from "@placing/AngleFinder";
import withinDist from "@utils/geometry/withinDist";
import { PLAYER_SCALE } from "@constants/world";

type PlacementArrs = "onMe" | "all";
type PlacementBuffers = `${PlacementArrs}BufferIndex`;

export default class PlayerPlacementManager {
    private static finderOptions: FinderOptions = { spike: true, preplace: true };

    private static computeFor(player: Player, arrType: PlacementArrs, bufType: PlacementBuffers) {
        const myPlayer = Client.player;
        const myPos = myPlayer.real_position;

        const count = AngleFinder.compute(player, this.finderOptions);
        const buffer = AngleFinder.angleBuffer;

        if (count === 0) return;

        const spikeItem = getItem(9);
        const spikeScale = spikeItem.scale;
        const totalScale = spikeScale + PLAYER_SCALE;
        const placeScale = totalScale + (spikeItem.placeOffset ?? 0);
        const placePotential = player.placePotential;
        const arr = placePotential[arrType];

        placePotential.range = placeScale;
        placePotential.objectScale = spikeScale;

        for (let i = 0; i < count; i++) {
            const item = buffer[i];
            if (item === undefined) continue;

            if (arrType === "onMe") {
                if (withinDist(myPos, item, PLAYER_SCALE + item.scale))
                    at(arr, placePotential[bufType]++).redefine(item.x, item.y, item.scale, item.angle, item.id);

                continue;
            }

            at(arr, placePotential[bufType]++).redefine(item.x, item.y, item.scale, item.angle, item.id);
            if (item.x < placePotential.allMinX) placePotential.allMinX = item.x;
            if (item.x > placePotential.allMaxX) placePotential.allMaxX = item.x;
            if (item.y < placePotential.allMinY) placePotential.allMinY = item.y;
            if (item.y > placePotential.allMaxY) placePotential.allMaxY = item.y;

            if (player.weaponData.primary !== WEAPON_ID_MAP.TOOL_HAMMER && !item.preplace) {
                PotentialObjectManager.add(item.x, item.y, player.sid);
            }
        }
    }

    /**
     * Whether any of the player's spike spots can touch us. Every spot the Angle Finder offers sits `offset` from the
     * player (PLAYER_SCALE + spike + placeOffset), and "onMe" keeps a spot closer than PLAYER_SCALE + spike to us, so
     * from farther than the two added together none can (+1 so rounding can't skip a spot right at the edge).
     */
    private static canPlaceOnMe(player: Player) {
        const spikeItem = getItem(player.items[2] ?? NaN);
        const offset = PLAYER_SCALE + spikeItem.scale + (spikeItem.placeOffset ?? 0);
        const reach = offset + PLAYER_SCALE + spikeItem.scale + 1;
        return withinDist(player.real_position, Client.player.real_position, reach);
    }

    static update(player: Player) {
        const placePotential = player.placePotential;
        placePotential.onMeBufferIndex = 0;
        placePotential.allBufferIndex = 0;
        placePotential.allMinX = placePotential.allMinY = Infinity;
        placePotential.allMaxX = placePotential.allMaxY = -Infinity;

        this.computeFor(player, "all", "allBufferIndex");

        // The second call keeps only the spots that touch us, and most enemies are too far away for any to.
        if (!this.canPlaceOnMe(player)) {
            AngleFinder.invalidateReuse();
            return;
        }

        // Same player and nothing changed since the call above, so this one can reuse its pass over the objects.
        this.finderOptions.preplace = false;
        this.finderOptions.reusePreplacePass = true;
        this.computeFor(player, "onMe", "onMeBufferIndex");
        this.finderOptions.reusePreplacePass = false;
        this.finderOptions.preplace = true;
    }
}