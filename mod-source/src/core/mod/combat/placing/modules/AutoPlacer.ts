import { at } from "@utils/array/at";
import Player from "@entities/Player";
import Client from "@core/Client";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import { FinderOptions } from "@core/mod/combat/placing/AngleFinder";
import Timing from "@core/mod/utils/Timing";
import ModManager from "@core/ModManager";
import { tickState } from "@core/TickState";
import PlayerUpdateEvent from "@core/socket/events/core/PlayerUpdateEvent";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import Angle from "@placing/Angle";
import Placer, { PlacementTypes } from "@placing/utils/Placer";
import getDistSq from "@utils/geometry/getDistSq";

export interface PreplacementQueue {
    count: number;
    tick: number;
    placements: Preplacement[];
}

export class Preplacement {
    x: number = -111000;
    y: number = -111000;
    angle: number = -111000;
    id: number = -111000;
    scale: number = 52;
    spikeTick = false;
    appleInsta = false;
    predict = false;

    copyFrom(item: Angle) {
        this.x = item.x;
        this.y = item.y;
        this.angle = item.angle;
        this.id = item.id;
        this.spikeTick = item.spikeTick;
        this.appleInsta = item.appleInsta;
        this.scale = item.scale;
        this.predict = item.predict;
    }
}

export default class AutoPlacer extends Placer {
    private finderOptions: FinderOptions = { grade: true };
    private cachedBestAngles: Angle[] = Array.from({ length: 4 }, () => new Angle(-1, -1, -1, -1, -1));
    private cachedBestAnglesCount = 0;
    private preComputeDuration = 0;

    potentialPreplacements: PreplacementQueue = {
        tick: 0,
        count: 0,
        placements: Array.from({ length: 4 }, () => new Preplacement())
    };

    preplacementsBufferHead = 0;
    preplacements: PreplacementQueue[] = [{
        count: 0,
        tick: 0,
        placements: Array.from({ length: 4 }, () => new Preplacement())
    }, {
        count: 0,
        tick: 0,
        placements: Array.from({ length: 4 }, () => new Preplacement())
    }, {
        count: 0,
        tick: 0,
        placements: Array.from({ length: 4 }, () => new Preplacement())
    }];

    constructor() {
        super();
        this.executePreplaceBatch = this.executePreplaceBatch.bind(this);
    }

    updatePreplacement(i: number, item: Angle) {
        const preplacement = at(this.preplacements, i);
        const arr = at(preplacement.placements, preplacement.count++);
        arr.copyFrom(item);
        preplacement.tick = tickState.tick;
    }

    private executePreplaceBatch(arr: Preplacement[], count: number, originalWaitMs: number) {
        // A batch sent after a wait reserved budget for all of it (PacketTracker.use); nothing else resets that, so give it
        // back here for every path, sent or skipped. Placements actually sent are counted by the socket as usual.
        if (originalWaitMs > 0) PacketTracker.freeAfterUse("PLACE", count);
        // If we died during the wait, the server would ignore the batch, so don't spend packets on it.
        if (originalWaitMs > 0 && !Client.isAlive) return;

        for (let i = 0; i < count; i++) {
            const preplacement = arr[i];
            if (!preplacement) continue;
            if (originalWaitMs > 0 && this.shouldSkip(preplacement)) continue;
            this.place(preplacement, preplacement.predict ? PlacementTypes.PREDICTIVE : PlacementTypes.PREPLACE);
        }

        ModManager.updateDirection();
    }

    private placePreplacement(index: number) {
        const padding = Menu.getValue("prenorounding") ? 0 : .5;
        const preplacement = at(this.preplacements, index);
        const arr = preplacement.placements;
        const count = preplacement.count;
        PlacementSystem.totalPlacements += count;

        // Sent to reach the server right as its next tick starts. With "Jitter-Safe Timing", later by the ping jitter:
        // a placement that arrives late still lands (a tick later), one that arrives early fails.
        const waitMs = Timing.waitForNextTick(performance.now(), PlayerUpdateEvent.lastReceive, padding);

        if (waitMs <= 0) {
            this.executePreplaceBatch(arr, count, 0);
            return;
        }

        PacketTracker.use("PLACE", count);
        setTimeout(this.executePreplaceBatch, waitMs, arr, count, waitMs);
    }

    preStart(player: Player) {
        // Its spots are used only by Auto Place and by Apple Insta's re-trap check (trapped enemy): skip otherwise.
        const nearest = tickState.enemyData.nearest;
        if (!Menu.getValue("autoPlacing") && !nearest?.trap) {
            this.cachedBestAnglesCount = 0;
            this.potentialPreplacements.count = 0;
            // The skipped search (Placer.process) also forgets recently used angles once we move 5 px a tick.
            if (getDistSq(player.real_position, player.next_position) >= 25) PlacementSystem.usedAnglesCount = 0;
            return;
        }
        const now = performance.now();
        const preplacer = !!Menu.getValue("preplacer");
        this.finderOptions.preplace = preplacer;

        const bestAngles = this.start(player, 4, this.finderOptions);
        const preplacement = this.potentialPreplacements;
        this.cachedBestAnglesCount = bestAngles.length;
        preplacement.count = 0;

        const shouldTick = tickState.tick % 2 === 0 || !Menu.getValue("twoTickPlacements");
        let offset = 0;
        let requirePadding = 0;

        for (let i = 0; i < bestAngles.length; i++) {
            const item = bestAngles[i];
            if (item === undefined) continue;
            at(this.cachedBestAngles, i).redefine(item.x, item.y, item.scale, item.angle, item.id, item.preplace, item.predict);
            if (item.preplace || item.predict) requirePadding++;
            else if (!shouldTick) offset++;
        }

        const totalActions = PacketTracker.request("PLACE", bestAngles.length - offset, requirePadding);
        for (let i = 0, len = Math.min(bestAngles.length, totalActions); i < len; i++) {
            const item = bestAngles[i];
            if (item === undefined) continue;

            if (item.preplace && !item.overlap) {
                const arr = at(preplacement.placements, preplacement.count++);
                arr.copyFrom(item);
            }
        }

        this.preComputeDuration = performance.now() - now;
    }

    execute(_player: Player) {
        const now = performance.now();
        const bestAngles = this.cachedBestAngles;
        const bestAnglesCount = this.cachedBestAnglesCount;
        let hasPreplacements = false;

        const currentIndex = this.preplacementsBufferHead;
        let requirePadding = 0;
        let offset = 0;

        at(this.preplacements, currentIndex).count = 0;
        this.preplacementsBufferHead = (this.preplacementsBufferHead + 1) % this.preplacements.length;
        const shouldTick = tickState.tick % 2 === 0 || !Menu.getValue("twoTickPlacements");

        for (let i = 0; i < bestAnglesCount; i++) {
            const item = bestAngles[i];
            if (item === undefined) continue;

            if (item.preplace || item.predict) {
                requirePadding++;
                continue;
            }

            if (!shouldTick) offset++;
        }

        const totalActions = PacketTracker.request("PLACE", bestAnglesCount - offset, requirePadding);
        for (let i = 0, len = Math.min(bestAnglesCount, totalActions); i < len; i++) {
            const item = bestAngles[i];
            if (item === undefined) continue;
            if (this.shouldSkip(item)) continue;

            if (item.preplace || item.predict) {
                hasPreplacements = true;
                this.updatePreplacement(currentIndex, item);
                continue;
            }

            // The spots were picked in preStart(); a hotkey may have placed since then, so re-check the 4-per-tick cap.
            if (shouldTick && PlacementSystem.totalPlacements < 4)
                this.place(item);
        }

        if (hasPreplacements) {
            this.placePreplacement(currentIndex);
        }

        const took = (performance.now() - now) + this.preComputeDuration;
        tickState.activityList.push("autoPlace");
        this.preComputeDuration = 0;
        this.update(took.toFixed(2));
    }
}