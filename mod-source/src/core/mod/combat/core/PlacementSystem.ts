import { at } from "@utils/array/at";
import GameObject from "@constants/GameObject";
import { logPacket } from "@core/socket/packetLog";
import { FOOD_GROUP_ID, getItem, LIST_ID_MAP } from "@constants/items";
import Client, { Marker } from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import CombatController from "@core/mod/combat/core/CombatController";
import ModManager from "@core/ModManager";
import { tickState } from "@core/TickState";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import Angle from "@placing/Angle";
import AutoGrinder from "@placing/modules/AutoGrinder";
import AutoMiller from "@placing/modules/AutoMiller";
import AutoPlacer, { Preplacement } from "@placing/modules/AutoPlacer";
import AutoReplacer, { Replacement } from "@placing/modules/AutoReplacer";
import { PlacementType, PlacementTypes } from "@placing/utils/Placer";
import PlacerUtils from "@placing/utils/PlacerUtils";
import PacketMap from "@root/utils/socket/PacketMap";
import { Input } from "@ui/Input";
import getDistSq from "@utils/geometry/getDistSq";
import { PLAYER_SCALE } from "@constants/world";

class Placement {
    tick: number = -1000000;
    angle: number = -1000000;

    redefine(angle: number, tick: number) {
        this.angle = angle;
        this.tick = tick;
    }
}

/** What PlacementSystem.place did: sent the placement, or nothing because of the building limit or a missing item. */
export type PlaceResult = "placed" | "full" | "not-owned";

export default class PlacementSystem {
    static AutoPlacer = new AutoPlacer();
    static AutoReplacer = new AutoReplacer();

    private static placementBlock = { x: -111000, y: -111000, scale: 0, untilTick: -1 };

    static getTrapPlacementBlock(): Readonly<typeof PlacementSystem.placementBlock> {
        return this.placementBlock;
    }

    private static macro() {
        const player = Client.player;
        const angle = Input.getAttackDir();
        const keys = Input.keys;

        const activityList = tickState.activityList;

        if (keys["KeyK"] && player.items.includes(20)) {
            const totalAllowedActions = PacketTracker.request("PLACE", 4);
            const len = Math.min(4, totalAllowedActions);

            for (let i = 0; i < len; i++) {
                this.checkPlace(20, angle + (Math.PI / 2) * i);
            }

            activityList.push("macroKeyK");
        }

        const totalAllowedActions = PacketTracker.request("PLACE", 1);
        if (totalAllowedActions <= 0) return;

        // Only placements that happened count toward the 4-per-tick cap Auto Place respects (Placer); a blocked spot
        // or an item we don't have used to count too.
        if (keys["KeyH"]) {
            if (this.checkPlace(PlacerUtils.placeSevenSlot(player), angle)) this.totalPlacements++;
            activityList.push("macroKeyH");
        }

        if (keys["KeyQ"]) {
            this.place(player.items[0] ?? NaN, ModManager.getAttackDir());
            activityList.push("macroKeyQ");
        }

        if (keys["KeyF"]) {
            if (this.checkPlace(player.items[4] ?? NaN, angle)) this.totalPlacements++;
            activityList.push("macroKeyF");
        }

        if (keys["KeyV"]) {
            if (this.checkPlace(player.items[2] ?? NaN, angle)) this.totalPlacements++;
            activityList.push("macroKeyV");
        }
    }

    static blockTrapPlacement(gameObject: GameObject, ticks: number = 2) {
        this.placementBlock.x = gameObject.x;
        this.placementBlock.y = gameObject.y;
        this.placementBlock.scale = gameObject.scale;
        this.placementBlock.untilTick = Math.max(this.placementBlock.untilTick, tickState.tick + ticks);
    }

    private static bufferAngle = new Angle(0, 0, 0, 0, 0);

    /** Places item `id` at `angle` if we have it and the spot is free. Returns whether it placed. */
    static checkPlace(id: number, angle: number = Input.getAttackDir()) {
        const player = Client.player;

        if (!player.items.includes(id)) return false;

        const item = getItem(id);
        const realPos = player.real_position;

        const tmpScale = PLAYER_SCALE + item.scale + (item.placeOffset || 0);
        const tmpX = realPos.x + Math.cos(angle) * tmpScale;
        const tmpY = realPos.y + Math.sin(angle) * tmpScale;

        if (!ObjectManager.checkItem(tmpX, tmpY, item.scale, id)) return false;
        // At the building limit nothing is sent: no marker, and the caller doesn't count it as a placement.
        if (this.place(id, angle) !== "placed") return false;

        this.bufferAngle.redefine(tmpX, tmpY, item.scale, angle, id);
        this.sendMarker(this.bufferAngle, PlacementTypes.NORMAL);
        return true;
    }

    /** The building limit `place()` enforces for this item, or undefined when it doesn't enforce one. */
    static getPlaceLimit(id: number) {
        const item = getItem(id);
        if (typeof item.group.limit !== "number" || Client.socket.isPrivateServer) return undefined;
        return item.group.sandboxLimit ?? 99;
    }

    /**
     * Sends the packets that place item `id` at `angle` (select it, then "hit"). Nothing is sent when we don't have the
     * item ("not-owned") or its group is at the building limit ("full"). `itemCount` overrides how many of the group we
     * own, for callers placing several in one tick before the server's count arrives.
     */
    static place(id: number, angle: number = Input.getAttackDir(), itemCount?: number): PlaceResult {
        const player = Client.player;
        if (!player.items.includes(id)) return "not-owned";

        const item = getItem(id);
        const limit = this.getPlaceLimit(id);
        if (limit !== undefined && (itemCount ?? player.itemCounts[item.group.id] ?? 0) + 1 > limit) return "full";

        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD, id, false);
        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_HIT, 1, angle);
        if (item.group.id === FOOD_GROUP_ID) Client.lastAteTick = tickState.tick;
        // Keep this after every placement, also when placing several in a row (Auto Mill, Auto Heal). After a successful
        // placement 1.8.2 puts the building away itself, but a refused one (blocked spot) leaves it selected, and the
        // server toggles a building off when it's selected again (tested live on moomodding.io, 9 Nov 2026). Without
        // this, the next "select + hit" after a blocked spot would swing the weapon instead of placing.
        CombatController.selectWeapon();
        return "placed";
    }

    /**
     * Markers are only marked inactive by the renderer, which doesn't run while Render Placements is off or the tab
     * is hidden. Past this many, the oldest marker is reused instead of growing the list. Far more than fit on screen.
     */
    private static readonly MAX_MARKERS = 256;
    private static oldestMarker = 0;

    static addMarkerRaw(x: number, y: number, angle: number, id: number, placementType: PlacementType) {
        const markers = Client.markers;

        for (let i = 0; i < markers.length; i++) {
            const marker = markers[i];
            if (marker === undefined) continue;

            if (marker && !marker.active) {
                marker.redefine(x, y, angle, id, placementType);
                return;
            }
        }

        if (markers.length < this.MAX_MARKERS) {
            markers.push(new Marker(x, y, angle, id, placementType));
            return;
        }

        at(markers, this.oldestMarker).redefine(x, y, angle, id, placementType);
        this.oldestMarker = (this.oldestMarker + 1) % this.MAX_MARKERS;
    }

    static addMarker(angleData: Angle | Replacement | Preplacement, placementType: PlacementType) {
        this.addMarkerRaw(angleData.x, angleData.y, angleData.angle, angleData.id, placementType);
    }

    static sendMarker(angleData: Angle | Replacement | Preplacement, placementType: PlacementType) {
        this.addMarker(angleData, placementType);

        // allows the packet replayer to show where our player wanted to place
        logPacket(
            PacketMap.CUSTOM_PACKETS.SERVER_TO_CLIENT.ADD_PLACEMENT_MARKER,
            [angleData.x, angleData.y, angleData.angle, angleData.id, placementType]
        );
    }

    static bestAngles: Angle[] = [];
    static bestAnglesSet = new Set<Angle>();
    static angleCandidates: Angle[] = [];

    static usedAngles: Placement[] = Array.from({ length: 64 }, () => new Placement());
    static usedAnglesCount = 0;
    static usedAnglesHead = 0;
    static totalPlacements = 0;

    static main() {
        const nearestEnemy = tickState.enemyData.nearest;
        const player = Client.player;

        if (player.health < 0) return;

        this.macro();

        AutoMiller.main();
        if (AutoGrinder.main()) return;

        if (Menu.getValue("autoPlacing") && nearestEnemy && player.items[4] === LIST_ID_MAP.PIT_TRAP) {
            const placementRange = parseInt(Menu.getValue("autoPlaceRange"));
            const placementRangeSq = placementRange * placementRange;
            const distanceSq = getDistSq(nearestEnemy.real_position, player.real_position);

            if (distanceSq <= placementRangeSq) {
                this.AutoPlacer.execute(player);
            }
        }
    }
}