import items from "@constants/items";
import Player from "@entities/Player";
import { accessoryMap, hatMap, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import MovementUtils from "@core/mod/defense/utils/MovementUtils";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import PacketMap from "@root/utils/socket/PacketMap";
import { Input } from "@ui/Hook";
import ScriptConfig from "@utils/config/ScriptConfig";
import lineInCircle from "@utils/geometry/lineInCircle";
import { isCactusObject, isInWater, PLAYER_SCALE, SNOW_SPEED, WATER_CURRENT } from "@constants/world";
import type { Hat } from "@constants/store";

export default class MovementManager {
    private static lastMoveDir: number | null = null;
    static sentMovePacket = false;

    /** 1.8.2 clears the server's moveDir when a player spawns, so the next direction must be sent again. */
    static onSpawn() {
        this.lastMoveDir = null;
    }

    private static move(moveDir: number | null) {
        if (moveDir === this.lastMoveDir) return;
        this.lastMoveDir = moveDir;
        this.sentMovePacket = true;
        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.MOVE, moveDir);
    }

    /** 1.8.2's ground multiplier for a hat where the player stands: snow (unless cold-immune) and water (unless water-immune). */
    static terrainSpeedMult(player: Player, skin: Hat | undefined) {
        const pos = player.real_position;
        let mult = pos.y <= ScriptConfig.SNOW_BIOME_TOP ? (skin?.coldM ? 1 : SNOW_SPEED) : 1;
        if (isInWater(pos.y, player.zIndex)) mult *= skin?.watrImm ? .75 : .33;
        return mult;
    }

    /**
     * Where `moveDir` takes the player by the next tick. With `withTerrain`, 1.8.2's snow and water slowdowns and the
     * river current are included (Safe Walk); without, it's plain ground (SpikeGrader's use).
     */
    static project(
        player: Player,
        moveDir: number,
        includeDecel?: boolean,
        customData?: [skinIndex: number | undefined, tailIndex: number | undefined, weaponIndex: number | undefined],
        withTerrain = false
    ) {
        if (typeof customData === "undefined") customData = [undefined, undefined, undefined];
        const skinIndex = customData[0] ?? player.skinIndex;
        const tailIndex = customData[1] ?? player.tailIndex;
        const weaponIndex = customData[2] ?? player.weaponIndex;
        const delta = ScriptConfig.SERVER_UPDATE_SPEED;

        const wpn = items.weapons[weaponIndex];
        const skin = hatMap.get(skinIndex)!;
        const tail = accessoryMap.get(tailIndex)!;

        const spdMult = (player.buildIndex >= 0 ? .5 : 1) * (wpn?.spdMult || 1) *
            (skin ? (skin.spdMult || 1) : 1) *
            (tail ? (tail.spdMult || 1) : 1) *
            (withTerrain ? this.terrainSpeedMult(player, skin) : 1);

        const realPos = player.real_position;
        const momentumX = player.next_position.x - realPos.x;
        const momentumY = player.next_position.y - realPos.y;

        const accelDist = ScriptConfig.PLAYER_SPEED * spdMult * delta * delta;
        // The river pushes east like a second acceleration (× 0.4 with a water-immune hat).
        const current = withTerrain && isInWater(realPos.y, player.zIndex) ? WATER_CURRENT * (skin?.watrImm ? .4 : 1) * delta * delta : 0;
        const accelX = Math.cos(moveDir) * accelDist + current;
        const accelY = Math.sin(moveDir) * accelDist;

        let travelX: number;
        let travelY: number;

        if (includeDecel) {
            const frictionMult = MovementUtils.getFrictionMult(accelX, accelY, delta);

            travelX = momentumX + accelX * frictionMult;
            travelY = momentumY + accelY * frictionMult;
        } else {
            travelX = momentumX + accelX;
            travelY = momentumY + accelY;
        }

        return { x: realPos.x + travelX, y: realPos.y + travelY };
    }

    static getMoveDir(peek = false) {
        const action = AttackManager.currentAttackAction;

        if (action && action.reason === "oneTick") {
            const mode = action.tickMode!;
            const ang = ModManager.enemyData.angle;
            return mode === "away" ? ang + Math.PI : mode === "stop" ? null : ang;
        }

        if (AttackManager.oneTicker.tapMode) {
            return AttackManager.oneTicker.getMoveDir(peek);
        }

        if (AutoPusher.autoPushing) {
            return AutoPusher.moveDir;
        }

        return Client.lastMoveDir;
    }

    /** Hats Safe Walk considers: the Hat System's movement hats (booster, winter cap, flipper) and the one we wear. */
    private static readonly SPEED_HATS = [STORE_HAT_MAP.BOOSTER_HAT, STORE_HAT_MAP.WINTER_CAP, STORE_HAT_MAP.FLIPPER_HAT];

    /**
     * The hat that moves us fastest where we stand, so the projection is the farthest we could get: booster hat on
     * plain ground, winter cap in the snow, flipper hat in the water.
     */
    private static fastestHat(player: Player) {
        let best = player.skinIndex;
        let bestMult = -1;

        for (const id of [...this.SPEED_HATS, player.skinIndex]) {
            // Booster hat always counts, as before (Safe Walk assumed it whether owned or not); the others only if owned.
            if (id !== player.skinIndex && id !== STORE_HAT_MAP.BOOSTER_HAT && !player.skins[id]) continue;
            const skin = hatMap.get(id);
            const mult = (skin?.spdMult || 1) * this.terrainSpeedMult(player, skin);
            if (mult > bestMult) {
                best = id;
                bestMult = mult;
            }
        }

        return best;
    }

    private static checkAngleCollision(moveDir: number) {
        const closeObjects = ObjectManager.pool.closeObjects;
        const player = Client.player;

        const decentGear: [number, number, number] = [
            this.fastestHat(player),
            player.tailIndex,
            player.weaponIndex
        ];

        const realPos = player.real_position;
        const project = this.project(player, moveDir, false, decentGear, true);
        const finalProjection = this.project(player, moveDir, true, decentGear, true);
        const shouldIgnoreMyTeleports = Menu.getValue("safeWalkIgnoreMyTps");
        const safeWalkIgnoreAllyBoostPads = Menu.getValue("safeWalkIgnoreAllyBoostPads");

        for (let i = 0; i < closeObjects.length; i++) {
            const gameObject = closeObjects[i];

            const isEnemy = !Client.isFriendly(gameObject.ownerSID ?? -1);
            const isSpike = gameObject.dmg;
            const isBoostPad = gameObject.boostSpeed && (safeWalkIgnoreAllyBoostPads ? isEnemy : true);
            const isCactus = isCactusObject(gameObject);

            const isDangerousObject = isCactus || (isSpike && isEnemy);
            const isTeleport = gameObject.teleport && (shouldIgnoreMyTeleports ? isEnemy : true);

            if (!isBoostPad && !isTeleport && !isDangerousObject)
                continue;

            const scale = PLAYER_SCALE + gameObject.getScale();
            const projectCollision = lineInCircle(realPos, project, gameObject, scale);
            const finalProjectCollision = lineInCircle(realPos, finalProjection, gameObject, scale);

            if (projectCollision || finalProjectCollision) {
                return true;
            }
        }

        return false;
    }

    static main() {
        let moveDir = this.getMoveDir();
        this.sentMovePacket = false;

        try {
            if (typeof moveDir !== "number") return;
            if (!Menu.getValue("safeWalk")) return;
            if (Input.keys["ShiftLeft"]) return;

            const activityList = ModManager.activityList;
            const isBlocked = this.checkAngleCollision(moveDir);
            if (!isBlocked) return;

            activityList.push("moveStop");
            moveDir = null;
        } finally {
            this.move(moveDir);
        }
    }
}