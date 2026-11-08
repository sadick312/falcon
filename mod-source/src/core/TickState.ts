/**
 * The state ModManager keeps for one tick and many modules read: the tick count, the enemy lists, the brain state
 * (what the mod decided, for the packet log) and the activity list. It lives here, with no game-logic imports, so a
 * module that only reads it doesn't import ModManager, which imports nearly every module back. ModManager still
 * fills it in every tick, and `ModManager.tick` etc. still work (they read and write this object).
 */
import type Player from "@entities/Player";
import type { AutoHealerInternal } from "@core/mod/defense/defense-modules/AutoHealer";
import type { ISpikeTickPatternRec } from "@core/mod/defense/DefenseSystem";
import type { AutoBreakerInternal } from "@core/mod/defense/modules/AutoBreaker";
import type { Point } from "@mod-types/index";

export interface ModBrainState {
    tick: number;
    damages: number[];
    sources: string[];
    preHitChances: number;
    healingResponse: string;
    activityList: string[];
    canPlaceOnMe: boolean;
    pingTime: number;
    shameCount: number;
    packets: number;
    healingUsed: number;
    hatUsed: number;
    accUsed: number;
    modBrainRuntime: number;
    effectiveBatchWindow: number;
    realBatchWindow: number;
    breakerInternal: AutoBreakerInternal;
    healingInternal: AutoHealerInternal;
    totalDamage: number;
    isTrapped: boolean;
    wasTrapped: boolean;
    preHitStates: { sid: number, hits: number }[];
    randomHitStates: { sid: number, hits: number }[];
    latePreHitStates: { sid: number, hits: number }[];
    spikeTickPot: ISpikeTickPatternRec;
    modVersion: string;
    trapData: Point;
    trapHitState: number;
}

export interface IEnemyData {
    nearest: Player | null;
    nearby: Player[];
    all: Player[];
    angle: number;
    rangedInstaThreats: number;
}

export function createDefaultBrainState(): ModBrainState {
    return {
        tick: -1,
        modBrainRuntime: -1,
        preHitChances: -1,
        damages: [], sources: [], activityList: [],
        healingResponse: "no response",
        canPlaceOnMe: false,
        pingTime: 6967,
        hatUsed: -1,
        preHitStates: [],
        randomHitStates: [],
        latePreHitStates: [],
        accUsed: -1,
        shameCount: 67,
        totalDamage: 0,
        packets: 10000,
        isTrapped: false,
        wasTrapped: false,
        modVersion: "v1.0.0-pub",
        healingUsed: 9999,
        effectiveBatchWindow: -.5,
        realBatchWindow: -.5,
        breakerInternal: { replaceSpike: false, replaceTrap: false, trapBreakFaster: false, isConsidering: false },
        trapHitState: -1,
        healingInternal: { healthAfterDamage: -676767, willDieIfDoNothing: true, alreadyForcedHat: false, empDamage: 6967, healthAfterSoldier: Infinity, currentHealth: 0, expectedDamage: 0 },
        spikeTickPot: { amount: 1000, resetTicks: -1, resolveOccurances: 1000, hasOccuredBefore: false, currentMax: 1000, reset: false, max: 1000, lastOccured: 67 },
        trapData: { x: -1, y: -1 }
    };
}

export const tickState = {
    /** Server ticks since the page loaded (fake ticks included). Keeps counting across reconnects. */
    tick: 0,
    activityList: [] as string[],
    enemyData: {
        nearby: [],
        nearest: null,
        all: [],
        angle: 0,
        rangedInstaThreats: 0
    } as IEnemyData,
    brainState: createDefaultBrainState()
};
