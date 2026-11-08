import items from "@constants/items";
import Client from "@core/Client";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import { tickState } from "@core/TickState";
import getDistSq from "@utils/geometry/getDistSq";

export default class AutoMiller {
    private static readonly DISTANCE_TO_MAINTAIN = 99 * 99;
    /** Straight behind us, then about 69° to each side. */
    private static readonly OFFSETS = [0, -1.20427718, 1.20427718];

    static data = {
        status: false,
        x: 0,
        y: 0
    };

    static main() {
        const player = Client.player;
        const playerPos = player.real_position;

        if (getDistSq(this.data, playerPos) > this.DISTANCE_TO_MAINTAIN) {
            if (typeof Client.lastMoveDir == "number" && this.data.status && (player.itemCounts[3] < 299 || !player.itemCounts[3])) {
                const direction = Client.lastMoveDir + Math.PI;
                const id = player.items[3];
                const item = items.list[id];
                let count = player.itemCounts[item.group.id] ?? 0;

                // Windmills share the 4-per-tick cap with the other placements; they used to go out on top of it.
                for (let i = 0; i < AutoMiller.OFFSETS.length; i++) {
                    if (PlacementSystem.totalPlacements >= 4) break;
                    // Stops at the building limit: the server's count arrives later, so pass our running count.
                    if (PlacementSystem.place(id, direction + AutoMiller.OFFSETS[i], count) !== "placed") break;

                    count++;
                    PlacementSystem.totalPlacements++;
                }

                tickState.activityList.push("autoMills");
            } else if (!(player.itemCounts[3] < 299 || !player.itemCounts[3])) {
                this.data.status = false;
            }

            this.data.x = player.real_position.x;
            this.data.y = player.real_position.y;
        }
    }
}