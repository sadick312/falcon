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

    static update(player: Player) {
        const placePotential = player.placePotential;
        placePotential.onMeBufferIndex = 0;
        placePotential.allBufferIndex = 0;
        placePotential.allMinX = placePotential.allMinY = Infinity;
        placePotential.allMaxX = placePotential.allMaxY = -Infinity;

        this.computeFor(player, "all", "allBufferIndex");

        // Same player and nothing changed since the call above, so this one can reuse its pass over the objects.
        this.finderOptions.preplace = false;
        this.finderOptions.reusePreplacePass = true;
        this.computeFor(player, "onMe", "onMeBufferIndex");
        this.finderOptions.reusePreplacePass = false;
        this.finderOptions.preplace = true;
    }
}