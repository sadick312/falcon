import GameObject from "@constants/GameObject";
import { at } from "@utils/array/at";
import { getItem, ListItem } from "@constants/items";
import Player from "@entities/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import Menu from "@core/menu/Menu";
import { Point } from "@mod-types/index";
import Angle from "@placing/Angle";
import AngleGrader from "@placing/AngleGrader";
import Grader from "@placing/grader-modules/Grader";
import normalizeAngle from "@utils/angle/normalizeAngle";
import { tickState } from "@core/TickState";
import { profileEnd, profileStart } from "@services/profiler/Profiler";
import ScriptConfig from "@utils/config/ScriptConfig";
import { PLAYER_SCALE, RIVER_HALF_WIDTH } from "@constants/world";

type AngleItemContextIntervals = "open" | "raw" | "invalid" | "valid";
type AngleItemContextIndexs = `${AngleItemContextIntervals}Index`;

interface AngleItemContext {
    rawIndex: number;
    invalidIndex: number;
    validIndex: number;
    openIndex: number;

    /**
     * The open buffer is used to represent the angular footprints of objects that are about to break.
     * This is only used while in 'preplace' mode.
     */

    open: Float32Array;

    /**
     * The raw buffer that holds the raw slices of blocked angles before merging.
     */

    raw: Float32Array;

    /**
     * Buffer that holds blocked angles.
     */

    invalid: Float32Array;

    /**
     * Buffer that holds valid angles for placement.
     */

    valid: Float32Array;
}

interface FinderSampleContext {
    trapSamples: Float32Array;
    spikeSamples: Float32Array;

    trapPreplaceSamples: Float32Array;
    trapPreplaceSamplesIndex: number;

    spikePreplaceSamples: Float32Array;
    spikePreplaceSamplesIndex: number;
}

interface FinderComputeContext {
    spike: AngleItemContext;
    trap: AngleItemContext;
    samples: FinderSampleContext;
}

export interface FinderOptions {
    obj?: GameObject;
    grade?: boolean;
    replace?: boolean;
    trap?: boolean;
    spike?: boolean;
    budgetMlt?: number;
    preplace?: boolean;
    /**
     * Only for a call right after a `preplace` call for the same player, with nothing changed in between: reuses that
     * call's pass over the nearby objects instead of repeating it (see PlayerPlacementManager.update). Falls back to
     * the full pass when the two calls don't match.
     */
    reusePreplacePass?: boolean;
}

/**
 * What a `preplace` call's object pass found, for the next call (without preplace) to reuse. Objects that are not
 * about to break give that call exactly the same raw intervals; the ones about to break are kept to redo.
 */
interface ObjectPassCache {
    valid: boolean;
    player: Player | null;
    x: number;
    y: number;
    spikeItem: ListItem | null;
    trap: boolean;
    spike: boolean;
    spikeRaw: Float32Array;
    spikeRawIndex: number;
    trapRaw: Float32Array;
    trapRawIndex: number;
    willBreak: GameObject[];
}

const TWO_PI = Math.PI * 2;

function insertionSortIntervals(arr: Float32Array, n: number) {
    for (let i = 2; i < n; i += 2) {
        const currentStart = arr[i] ?? NaN;
        const currentEnd = arr[i + 1] ?? NaN;

        let j = i - 2;

        while (j >= 0 && (arr[j] ?? NaN) > currentStart) {
            arr[j + 2] = arr[j] ?? NaN;
            arr[j + 3] = arr[j + 1] ?? NaN;

            j -= 2;
        }

        arr[j + 2] = currentStart;
        arr[j + 3] = currentEnd;
    }
}

export default class AngleFinder {
    /** 1.8.2 `checkItemLocation`: a building whose centre's y is within this of the map's middle is refused. */
    private static readonly RIVER_HALF_WIDTH = RIVER_HALF_WIDTH;

    static readonly HIGHEST_ANGLE_COUNT = 140;
    static readonly CLOSEST_OBJ_DISTANCE_SQ = 20 * 20;
    static readonly CLOSEST_BLOCKER_DISTANCE_SQ = 270 * 270;
    private static readonly defaultOptions: FinderOptions = { grade: true };

    static angleBuffer: Angle[] = Array.from({ length: this.HIGHEST_ANGLE_COUNT }, () => new Angle(0, 0, 0, 0, 0));

    // Each object adds 1 interval (2 if it straddles angle 0). 30 filled up in a busy base, and every object after that
    // was ignored, so blocked spots were offered as free.
    private static readonly MAX_INTERVALS = 64;
    /**
     * Farthest an object can be from the player and still block a spot: placement distance (35 + scale + offset, up to
     * ~85) + the item (~50) + the object, up to a blocker's 300, plus a little for the next position (replace/preplace).
     */
    private static readonly OBJECT_REACH = 460;

    /** Room one object (up to 2 intervals) plus the river (up to 3) need, at 2 numbers per interval. */
    private static readonly INTERVAL_HEADROOM = 10;
    private static tmpBuffer = new Float32Array(AngleFinder.MAX_INTERVALS * 2);

    private static data: FinderComputeContext = {
        spike: {
            raw: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            invalid: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            valid: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            open: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            openIndex: 0,
            rawIndex: 0,
            invalidIndex: 0,
            validIndex: 0
        },

        trap: {
            raw: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            invalid: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            valid: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            open: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            openIndex: 0,
            rawIndex: 0,
            invalidIndex: 0,
            validIndex: 0
        },

        samples: {
            trapSamples: new Float32Array(70),
            spikeSamples: new Float32Array(70),

            trapPreplaceSamples: new Float32Array(70),
            trapPreplaceSamplesIndex: 0,
            spikePreplaceSamples: new Float32Array(70),
            spikePreplaceSamplesIndex: 0
        }
    };

    private static objectPass: ObjectPassCache = {
        valid: false,
        player: null,
        x: 0,
        y: 0,
        spikeItem: null,
        trap: false,
        spike: false,
        spikeRaw: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
        spikeRawIndex: 0,
        trapRaw: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
        trapRawIndex: 0,
        willBreak: []
    };

    /**
     * Does the object pass of a call without `preplace` from the last `preplace` call's results: its raw intervals
     * plus the objects about to break, now measured from where the player is. The intervals come in a different
     * order than the full pass makes them, but they are sorted and merged next, which gives the same result for any
     * order. Returns false (and the caller does the full pass) when the cache doesn't fit this call or the full pass
     * would have hit the interval limit, whose cut-off does depend on the order.
     */
    private static reuseObjectPass(
        player: Player, playerPos: Point, spikeItem: ListItem, trapItem: ListItem,
        ctx: FinderComputeContext, isOurPlayer: boolean, options: Readonly<FinderOptions>
    ) {
        const cache = this.objectPass;
        if (!cache.valid || cache.player !== player || cache.x !== playerPos.x || cache.y !== playerPos.y) return false;
        if (cache.spikeItem !== spikeItem || cache.trap !== !!options.trap || cache.spike !== !!options.spike) return false;

        ctx.spike.raw.set(cache.spikeRaw.subarray(0, cache.spikeRawIndex));
        ctx.spike.rawIndex = cache.spikeRawIndex;
        ctx.trap.raw.set(cache.trapRaw.subarray(0, cache.trapRawIndex));
        ctx.trap.rawIndex = cache.trapRawIndex;

        const limit = AngleFinder.MAX_INTERVALS * 2 - AngleFinder.INTERVAL_HEADROOM;
        const willBreak = cache.willBreak;
        for (let i = 0, len = willBreak.length; i < len; i++) {
            if (ctx.spike.rawIndex > limit || ctx.trap.rawIndex > limit) break;
            this.computeAllIntervals(playerPos, willBreak[i]!, spikeItem, trapItem, ctx, isOurPlayer, options);
        }

        // The full pass checks the limit before each object, against a count that only grows, so it never stops
        // early exactly when the final count is within the limit.
        if (ctx.spike.rawIndex > limit || ctx.trap.rawIndex > limit) {
            ctx.spike.rawIndex = 0;
            ctx.trap.rawIndex = 0;
            return false;
        }

        return true;
    }

    private static resetCtx(ctx: FinderComputeContext) {
        ctx.trap.rawIndex = 0;
        ctx.trap.invalidIndex = 0;
        ctx.trap.openIndex = 0;
        ctx.trap.validIndex = 0;

        ctx.spike.rawIndex = 0;
        ctx.spike.invalidIndex = 0;
        ctx.spike.openIndex = 0;
        ctx.spike.validIndex = 0;

        ctx.samples.spikePreplaceSamplesIndex = 0;
        ctx.samples.trapPreplaceSamplesIndex = 0;
    }

    private static computeInterval(playerPos: Point, obj: GameObject, item: ListItem, interval: Float32Array, index: number, isOurPlayer: boolean, isPreplace?: boolean) {
        const itemScale = item.scale;
        const placementOffset = PLAYER_SCALE + itemScale + (item.placeOffset ?? 0);
        const placeDistanceSq = placementOffset * placementOffset;

        const objScale = (obj.blocker ? obj.blocker : obj.getScale(.6, obj.isItem)) + (isOurPlayer ? .01 : -.05);

        const totalRadius = itemScale + objScale;
        const totalRadiusSq = totalRadius * totalRadius;

        // getDistSq, getDir and normalizeAngle written out in this function: it runs for every nearby object and item,
        // and the numbers those calls returned were allocated.
        const dx = playerPos.x - obj.x;
        const dy = playerPos.y - obj.y;
        const distanceSq = dx * dx + dy * dy;
        const maxReach = placementOffset + totalRadius;

        if (distanceSq > maxReach * maxReach) return index;

        const distance = Math.sqrt(distanceSq);

        if (isOurPlayer && isPreplace) {
            const ourPlayer = Client.player;

            if (ourPlayer.trap && obj.sid === ourPlayer.trap.sid) {
                interval[index++] = 0;
                interval[index++] = Math.PI * 2;
                return index;
            }
        }

        if ((obj.blocker && distanceSq < AngleFinder.CLOSEST_BLOCKER_DISTANCE_SQ) || distanceSq < AngleFinder.CLOSEST_OBJ_DISTANCE_SQ) {
            interval[index++] = 0;
            interval[index++] = Math.PI * 2;
            return index;
        }

        const num = placeDistanceSq + distanceSq - totalRadiusSq;
        const den = 2 * distance * placementOffset;

        let cosVal = num / den;
        if (cosVal < -1) cosVal = -1;
        if (cosVal > 1) cosVal = 1;

        const thetha = Math.acos(cosVal);

        const dir = Math.atan2(obj.y - playerPos.y, obj.x - playerPos.x);
        const start = ((dir - thetha) % TWO_PI + TWO_PI) % TWO_PI;
        const end = ((dir + thetha) % TWO_PI + TWO_PI) % TWO_PI;

        if (start > end) {
            interval[index++] = start;
            interval[index++] = Math.PI * 2;

            interval[index++] = 0;
            interval[index++] = end;
        } else {
            interval[index++] = start;
            interval[index++] = end;
        }

        return index;
    }

    /**
     * The directions in which the item's centre would land in the river band. 1.8.2 refuses a placement when
     * `|y - MAP_SIZE / 2| <= 362`: a band, not a circle, and the building's own size doesn't count.
     */
    private static computeRiverInterval(playerPos: Point, item: ListItem, interval: Float32Array, index: number, isOurPlayer: boolean) {
        const offset = PLAYER_SCALE + item.scale + (item.placeOffset ?? 0);
        const halfWidth = AngleFinder.RIVER_HALF_WIDTH + (isOurPlayer ? .01 : -.05);
        const center = ScriptConfig.MAP_SIZE / 2;

        // The centre lands at y = playerPos.y + offset * sin(angle); blocked while sin(angle) is in [low, high].
        let low = (center - halfWidth - playerPos.y) / offset;
        let high = (center + halfWidth - playerPos.y) / offset;
        if (low > 1 || high < -1) return index;

        if (low <= -1 && high >= 1) {
            interval[index++] = 0;
            interval[index++] = Math.PI * 2;
            return index;
        }

        if (low < -1) low = -1;
        if (high > 1) high = 1;

        const a = Math.asin(low);
        const b = Math.asin(high);

        // sin is in [low, high] on [a, b] (right half) and on [π - b, π - a] (left half). These two meet when low or
        // high is at -1 or 1, and the merge step joins them.
        index = this.addArc(interval, index, a, b);
        index = this.addArc(interval, index, Math.PI - b, Math.PI - a);
        return index;
    }

    /** Adds the arc from `start` to `end` (end >= start, less than a full turn) as one or two intervals in [0, 2π]. */
    private static addArc(interval: Float32Array, index: number, start: number, end: number) {
        const from = normalizeAngle(start);
        const to = from + (end - start);

        if (to > Math.PI * 2) {
            interval[index++] = from;
            interval[index++] = Math.PI * 2;
            interval[index++] = 0;
            interval[index++] = to - Math.PI * 2;
        } else {
            interval[index++] = from;
            interval[index++] = to;
        }

        return index;
    }

    private static mergeRawInterval(
        itemCtx: AngleItemContext,
        sourceInterval: AngleItemContextIntervals, sourceIntervalIndex: AngleItemContextIndexs,
        destInterval: AngleItemContextIntervals, destIntervalIndex: AngleItemContextIndexs
    ) {
        const tmpBuffer = this.tmpBuffer;
        const sourceCount = itemCtx[sourceIntervalIndex];

        if (sourceCount < 2) return;
        insertionSortIntervals(itemCtx[sourceInterval], itemCtx[sourceIntervalIndex]);

        const source = itemCtx[sourceInterval];

        let currentStart = source[0] ?? NaN;
        let currentEnd = source[1] ?? NaN;
        let writeIdx = 0;

        for (let i = 2; i < sourceCount; i += 2) {
            const nextStart = source[i] ?? NaN;
            const nextEnd = source[i + 1] ?? NaN;

            if (nextStart <= currentEnd) {
                currentEnd = Math.max(currentEnd, nextEnd);
            } else {
                tmpBuffer[writeIdx++] = currentStart;
                tmpBuffer[writeIdx++] = currentEnd;

                currentStart = nextStart;
                currentEnd = nextEnd;
            }
        }

        tmpBuffer[writeIdx++] = currentStart;
        tmpBuffer[writeIdx++] = currentEnd;

        for (let i = 0; i < writeIdx; i++) {
            itemCtx[destInterval][i] = tmpBuffer[i] ?? NaN;
        }

        itemCtx[destIntervalIndex] = writeIdx;
    }

    private static invertInterval(invalid: Float32Array, invalidIndex: number, valid: Float32Array) {
        if (invalidIndex === 0) {
            valid[0] = 0;
            valid[1] = Math.PI * 2;
            return 2;
        }

        let lastEnd = 0;
        let index = 0;

        for (let i = 0; i < invalidIndex; i += 2) {
            const start = invalid[i] ?? NaN;
            const end = invalid[i + 1] ?? NaN;

            if (start > lastEnd) {
                valid[index++] = lastEnd;
                valid[index++] = start;
            }

            lastEnd = Math.max(lastEnd, end);
        }

        if (lastEnd < Math.PI * 2) {
            valid[index++] = lastEnd;
            valid[index++] = Math.PI * 2;
        }

        return index;
    }

    private static readonly budgets = [16, 22, 28, 34, 40, 46, 52, 58, 64, 70];

    private static convertToBudget(unparsed: string, options: Readonly<FinderOptions>) {
        const parsed = parseInt(unparsed);
        const level = isNaN(parsed) ? 7 : parsed;
        const budgetMlt = options.budgetMlt ?? 1;

        return ((this.budgets[level - 1] ?? NaN) * budgetMlt) | 0;
    }

    private static optionalDefaultOther = new Float32Array(0);
    private static getSampleResponse = new Int32Array(2);

    private static getSample(
        container: Float32Array,
        intervals: Float32Array, intervalIndex: number,
        totalWidth: number,
        budget: number
    ) {
        let index = 0;

        for (let i = 0; i < intervalIndex; i += 2) {
            const sampleStart = intervals[i] ?? NaN;
            const sampleEnd = intervals[i + 1] ?? NaN;

            const trueWidth = sampleEnd - sampleStart;
            const ratio = trueWidth / totalWidth;
            const count = Math.max(0, (ratio * budget) | 0);

            if (sampleEnd < sampleStart) continue;
            if (count <= 0) continue;

            if (count === 1) {
                container[index++] = (sampleStart + sampleEnd) / 2;
            } else {
                const shrunkenWidth = sampleEnd - sampleStart;
                const step = shrunkenWidth / (count - 1);

                for (let j = 0; j < count; j++) {
                    container[index++] = sampleStart + (step * j);
                }
            }
        }

        return index;
    }

    private static getSamples(
        samples: Float32Array,
        valid: Float32Array, validIndex: number,
        budget: number,
        preplaceSamples?: Float32Array,
        other?: Float32Array, otherIndex?: number
    ) {
        otherIndex = otherIndex ?? 0;
        other = other ?? this.optionalDefaultOther;
        preplaceSamples = preplaceSamples ?? this.optionalDefaultOther;

        if (validIndex < 2 && otherIndex < 2) return;

        let validWidth = 0;
        let preplaceWidth = 0;

        for (let i = 0; i < validIndex; i += 2) {
            validWidth += (valid[i + 1] ?? NaN) - (valid[i] ?? NaN);
        }

        for (let i = 0; i < otherIndex; i += 2) {
            preplaceWidth += (other[i + 1] ?? NaN) - (other[i] ?? NaN);
        }

        const totalWidth = validWidth + preplaceWidth;

        if (totalWidth <= 0) {
            this.resetSampleResponse();
            return;
        }

        const validBudget = ((validWidth / totalWidth) * budget) | 0;
        const preplaceBudget = budget - validBudget;

        const index = this.getSample(samples, valid, validIndex, validWidth, validBudget);
        const preplaceIndex = this.getSample(preplaceSamples, other, otherIndex, preplaceWidth, preplaceBudget);

        this.getSampleResponse[0] = index;
        this.getSampleResponse[1] = preplaceIndex;
    }

    private static grade(
        playerPos: Point,
        samples: Float32Array, samplesIndex: number,
        item: ListItem, currentIdx: number,
        isPreplacement: boolean, options: Readonly<FinderOptions>
    ) {
        const scale = item.scale;
        const offset = PLAYER_SCALE + scale + (item.placeOffset ?? 0);

        for (let i = 0; i < samplesIndex; i++) {
            const ang = samples[i];
            if (ang === undefined) continue;
            const x = playerPos.x + Math.cos(ang) * offset;
            const y = playerPos.y + Math.sin(ang) * offset;

            at(this.angleBuffer, currentIdx).redefine(x, y, scale, ang, item.id, isPreplacement);
            if (options.grade) AngleGrader.grade(currentIdx, options);
            currentIdx++;
        }

        return currentIdx;
    }

    private static gradeAll(
        playerPos: Point,
        spikeItem: ListItem,
        samples: FinderSampleContext, spikeSamplesIndex: number, trapSamplesIndex: number,
        options: Readonly<FinderOptions>
    ) {
        const trapItem = getItem(15);

        // Every angle sits at most this far from the player, so a spike or trap farther than this plus its own size
        // can't be in range of any of them (Grader.prepare's 15 + item + object). Pick those once for all angles.
        const previousCandidates = Grader.candidates;
        if (options.grade) {
            const reachOf = (item: ListItem) => PLAYER_SCALE + item.scale + (item.placeOffset ?? 0) + 15 + item.scale;
            // The same list AngleGrader hands prepare(), so what each candidate is to each enemy can be worked out here.
            Grader.setCandidates(playerPos, Math.max(reachOf(trapItem), reachOf(spikeItem)), tickState.enemyData.nearby);
        }

        try {
            this.gradeAllAngles(playerPos, spikeItem, trapItem, samples, spikeSamplesIndex, trapSamplesIndex, options);
        } finally {
            Grader.candidates = previousCandidates;
        }
    }

    private static gradeAllAngles(
        playerPos: Point,
        spikeItem: ListItem, trapItem: ListItem,
        samples: FinderSampleContext, spikeSamplesIndex: number, trapSamplesIndex: number,
        options: Readonly<FinderOptions>
    ) {
        let currentIdx = 0;
        const trapSamples = samples.trapSamples;
        const spikeSamples = samples.spikeSamples;

        currentIdx = this.grade(
            playerPos,
            trapSamples, trapSamplesIndex,
            trapItem, currentIdx,
            false, options
        );

        currentIdx = this.grade(
            playerPos,
            spikeSamples, spikeSamplesIndex,
            spikeItem, currentIdx,
            false, options
        );

        if (options.preplace) {
            const trapPreplaceSamples = samples.trapPreplaceSamples;
            const spikePreplaceSamples = samples.spikePreplaceSamples;

            const trapPreplacementsIndex = samples.trapPreplaceSamplesIndex;
            const spikePreplaceSamplesIndex = samples.spikePreplaceSamplesIndex;

            currentIdx = this.grade(
                playerPos,
                trapPreplaceSamples, trapPreplacementsIndex,
                trapItem, currentIdx,
                true, options
            );

            this.grade(
                playerPos,
                spikePreplaceSamples, spikePreplaceSamplesIndex,
                spikeItem, currentIdx,
                true, options
            );
        }
    }

    private static computeAllIntervals(
        playerPos: Point, gameObject: GameObject,
        spikeItem: ListItem, trapItem: ListItem,
        ctx: FinderComputeContext, isOurPlayer: boolean, options: Readonly<FinderOptions>
    ) {
        if (gameObject.willBreak && options.preplace) {
            if (!options.trap) ctx.spike.openIndex = this.computeInterval(playerPos, gameObject, spikeItem, ctx.spike.open, ctx.spike.openIndex, isOurPlayer, true);
            if (!options.spike) ctx.trap.openIndex = this.computeInterval(playerPos, gameObject, trapItem, ctx.trap.open, ctx.trap.openIndex, isOurPlayer, true);
            return;
        }

        if (!options.trap) ctx.spike.rawIndex = this.computeInterval(playerPos, gameObject, spikeItem, ctx.spike.raw, ctx.spike.rawIndex, isOurPlayer);
        if (!options.spike) ctx.trap.rawIndex = this.computeInterval(playerPos, gameObject, trapItem, ctx.trap.raw, ctx.trap.rawIndex, isOurPlayer);
    }

    private static shrinkInterval(
        ctx: AngleItemContext,
        shrinkenInterval: AngleItemContextIntervals, shrinkenIntervalIndex: AngleItemContextIndexs,
        shrinkerInterval: AngleItemContextIntervals, shrinkerIntervalIndex: AngleItemContextIndexs
    ) {
        let count = ctx[shrinkenIntervalIndex];
        const tmpBuffer = this.tmpBuffer;

        for (let i = 0; i < ctx[shrinkerIntervalIndex]; i += 2) {
            const invStart = ctx[shrinkerInterval][i] ?? NaN;
            const invEnd = ctx[shrinkerInterval][i + 1] ?? NaN;

            let index = 0;

            for (let j = 0; j < count; j += 2) {
                let openStart = ctx[shrinkenInterval][j] ?? NaN;
                let openEnd = ctx[shrinkenInterval][j + 1] ?? NaN;

                const isIntervalsNotOverlapping = invEnd <= openStart || invStart >= openEnd;
                const isInvalidBiggerThanOpen = invStart <= openStart && invEnd >= openEnd;
                const isInvalidBisectingOpen = invStart > openStart && invEnd < openEnd;

                if (isIntervalsNotOverlapping) {
                    tmpBuffer[index++] = openStart;
                    tmpBuffer[index++] = openEnd;
                } else if (isInvalidBiggerThanOpen) {
                    continue;
                } else if (isInvalidBisectingOpen) {
                    tmpBuffer[index++] = openStart;
                    tmpBuffer[index++] = invStart;
                    tmpBuffer[index++] = invEnd;
                    tmpBuffer[index++] = openEnd;
                } else {
                    if (invStart <= openStart) openStart = invEnd;
                    else if (invEnd >= openEnd) openEnd = invStart;

                    if (openEnd > openStart) {
                        tmpBuffer[index++] = openStart;
                        tmpBuffer[index++] = openEnd;
                    }
                }
            }

            for (let k = 0; k < index; k++) ctx[shrinkenInterval][k] = tmpBuffer[k] ?? NaN;
            count = index;
        }

        ctx[shrinkenIntervalIndex] = count;
    }

    private static resetSampleResponse() {
        this.getSampleResponse[0] = 0;
        this.getSampleResponse[1] = 0;
    }

    /** For a caller that skips the `reusePreplacePass` call it would have made: drops what that call would have. */
    static invalidateReuse() {
        this.objectPass.valid = false;
    }

    static compute(player: Player, options?: Readonly<FinderOptions>) {
        const start = __DEV__ ? profileStart() : 0;
        const count = this.computeAngles(player, options);
        if (__DEV__) profileEnd("fn.AngleFinder.compute", start);
        return count;
    }

    private static computeAngles(player: Player, options?: Readonly<FinderOptions>) {
        if (!options) options = AngleFinder.defaultOptions;
        const budget = this.convertToBudget(Menu.getValue("angleFinderLevel"), options);

        const playerPos = player.real_position;
        const playerNextPos = player.sid === Client.mySID ? player.next_state : player.next_position;
        // Everything in the 3×3 chunks around us, kept to what can reach this player's spots. This used a list cut at
        // 300 from US, which also served enemies (whose surroundings were then partly missing) and left out blockers
        // up to ~435 away.
        const closeObjects = ObjectManager.pool.closeObjects;
        const reachSq = AngleFinder.OBJECT_REACH * AngleFinder.OBJECT_REACH;

        const ctx = this.data;
        this.resetCtx(ctx);

        const spikeItem = getItem(player.items[2] ?? NaN);
        const trapItem = getItem(15);
        if (options.replace && options.preplace) return 0;

        const isOurPlayer = player.sid === Client.mySID;
        const cache = this.objectPass;
        const canReuse = options.reusePreplacePass && !options.preplace && !options.replace;
        const saveForReuse = !!options.preplace;
        const reused = !!canReuse && this.reuseObjectPass(player, playerPos, spikeItem, trapItem, ctx, isOurPlayer, options);
        // Good for the next call only: any other call in between may see objects that changed since.
        cache.valid = false;

        if (!reused) {
            if (saveForReuse) cache.willBreak.length = 0;
            let stoppedEarly = false;

            for (let i = 0, len = closeObjects.length; i < len; i++) {
                const gameObject = closeObjects[i];
                if (!gameObject || !gameObject.active || gameObject.isGhost) continue;
                // getDistSq written out: called here for every nearby object, its returned number was allocated.
                const dx = playerPos.x - gameObject.x;
                const dy = playerPos.y - gameObject.y;
                if (dx * dx + dy * dy > reachSq) continue;

                // Stop while there is still room: a Float32Array silently drops writes past its end.
                const limit = AngleFinder.MAX_INTERVALS * 2 - AngleFinder.INTERVAL_HEADROOM;
                if (ctx.spike.rawIndex > limit || ctx.trap.rawIndex > limit || ctx.spike.openIndex > limit || ctx.trap.openIndex > limit) {
                    console.log(`AngleFinder: more than ${AngleFinder.MAX_INTERVALS} blocked intervals; ignoring the remaining objects`);
                    stoppedEarly = true;
                    break;
                }

                const requireNextPosition = options.replace || (options.preplace && gameObject.willBreak);
                if (saveForReuse && gameObject.willBreak) cache.willBreak.push(gameObject);
                this.computeAllIntervals(requireNextPosition ? playerNextPos : playerPos, gameObject, spikeItem, trapItem, ctx, isOurPlayer, options);
            }

            if (saveForReuse && !stoppedEarly) {
                cache.valid = true;
                cache.player = player;
                cache.x = playerPos.x;
                cache.y = playerPos.y;
                cache.spikeItem = spikeItem;
                cache.trap = !!options.trap;
                cache.spike = !!options.spike;
                cache.spikeRaw.set(ctx.spike.raw.subarray(0, ctx.spike.rawIndex));
                cache.spikeRawIndex = ctx.spike.rawIndex;
                cache.trapRaw.set(ctx.trap.raw.subarray(0, ctx.trap.rawIndex));
                cache.trapRawIndex = ctx.trap.rawIndex;
            }
        }

        if (!options.trap) ctx.spike.rawIndex = this.computeRiverInterval(playerPos, spikeItem, ctx.spike.raw, ctx.spike.rawIndex, isOurPlayer);
        if (!options.spike) ctx.trap.rawIndex = this.computeRiverInterval(playerPos, trapItem, ctx.trap.raw, ctx.trap.rawIndex, isOurPlayer);

        if (options.preplace) {
            if (!options.trap) this.mergeRawInterval(ctx.spike, "open", "openIndex", "open", "openIndex");
            if (!options.spike) this.mergeRawInterval(ctx.trap, "open", "openIndex", "open", "openIndex");
        }

        if (!options.trap) this.mergeRawInterval(ctx.spike, "raw", "rawIndex", "invalid", "invalidIndex");
        if (!options.spike) this.mergeRawInterval(ctx.trap, "raw", "rawIndex", "invalid", "invalidIndex");

        if (options.preplace) {
            if (!options.trap) this.shrinkInterval(ctx.spike, "open", "openIndex", "invalid", "invalidIndex");
            if (!options.spike) this.shrinkInterval(ctx.trap, "open", "openIndex", "invalid", "invalidIndex");
        }

        if (!options.trap)
            ctx.spike.validIndex = this.invertInterval(ctx.spike.invalid, ctx.spike.invalidIndex, ctx.spike.valid);

        if (!options.spike)
            ctx.trap.validIndex = this.invertInterval(ctx.trap.invalid, ctx.trap.invalidIndex, ctx.trap.valid);

        if (options.preplace) {
            if (!options.trap) this.shrinkInterval(ctx.spike, "valid", "validIndex", "open", "openIndex");
            if (!options.spike) this.shrinkInterval(ctx.trap, "valid", "validIndex", "open", "openIndex");
        }

        const intervalTag = "valid";
        const intervalIndexTag = "validIndex";

        this.resetSampleResponse();

        if (!options.trap) this.getSamples(
            ctx.samples.spikeSamples,
            ctx.spike[intervalTag],
            ctx.spike[intervalIndexTag],
            budget,
            options.preplace ? ctx.samples.spikePreplaceSamples : undefined,
            options.preplace ? ctx.spike.open : undefined,
            options.preplace ? ctx.spike.openIndex : undefined
        );

        const spikeSamplesIndex = this.getSampleResponse[0] ?? NaN;
        const spikePreplaceSamplesIndex = ctx.samples.spikePreplaceSamplesIndex = this.getSampleResponse[1] ?? NaN;

        this.resetSampleResponse();

        if (!options.spike) this.getSamples(
            ctx.samples.trapSamples,
            ctx.trap[intervalTag],
            ctx.trap[intervalIndexTag],
            budget,
            options.preplace ? ctx.samples.trapPreplaceSamples : undefined,
            options.preplace ? ctx.trap.open : undefined,
            options.preplace ? ctx.trap.openIndex : undefined
        );

        const trapSamplesIndex = this.getSampleResponse[0] ?? NaN;
        const trapPreplaceSamplesIndex = ctx.samples.trapPreplaceSamplesIndex = this.getSampleResponse[1] ?? NaN;

        const gradeStart = __DEV__ ? profileStart() : 0;
        this.gradeAll(playerPos, spikeItem, ctx.samples, spikeSamplesIndex, trapSamplesIndex, options);
        if (__DEV__) profileEnd("fn.AngleFinder.graders", gradeStart);
        return spikeSamplesIndex + spikePreplaceSamplesIndex + trapSamplesIndex + trapPreplaceSamplesIndex;
    }
}