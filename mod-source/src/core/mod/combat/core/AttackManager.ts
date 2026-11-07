import type AntiBuller from "@combat-modules/AntiBuller";
import type AppleInstakiller from "@combat-modules/AppleInstakiller";
import type OneTicker from "@combat-modules/OneTicker";
import type ShameGrinder from "@combat-modules/ShameGrinder";
import type SpikeTicker from "@combat-modules/SpikeTicker";
import items, { LIST_ID_MAP, WEAPON_ID_MAP } from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import AttackQueuePool, { AttackAction, AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import ModModule from "@core/mod/utils/ModModule";
import ModManager from "@core/ModManager";
import { SimulationResult } from "@simulation/MovementPhysicsSimulator";
import withinDist from "@utils/geometry/withinDist";

export default class AttackManager {
    static autoInstaToggle = false;
    private static _currentAttackActions: AttackAction[] = AttackQueuePool.createAttackSequence();
    private static _currentAttackAction: AttackAction | undefined;
    private static currentAttackActionHead = 3;

    private static attackQueue: Readonly<AttackQueue>[] = [];

    // Created and filled in by attackModules.ts, which ModManager loads. Creating them here made every attack module
    // and AttackManager import each other.
    static spikeTicker: SpikeTicker;
    static appleInstakiller: AppleInstakiller;
    static shameGrinder: ShameGrinder;
    static antiBuller: AntiBuller;
    static oneTicker: OneTicker;

    /** Every attack module, in the order they run (and win ties). Set by attackModules.ts. */
    static modules: ModModule[] = [];

    /** Called when we spawn, so no module acts on something it remembered from the previous life. */
    static resetModules() {
        for (const module of this.modules) module.reset();
    }

    static get currentAttackActions(): Readonly<AttackAction>[] {
        return this._currentAttackActions;
    }

    static get currentAttackAction(): Readonly<AttackAction | undefined> {
        return this._currentAttackAction;
    }

    static checkForAutoPushingStatus() {
        if (!AutoPusher.autoPushing) return false;

        const theSpike = AutoPusher.theSpike;
        const enemy = ModManager.enemyData.nearest;

        if (!enemy) return false; // shouldn't happen but to keep TS from screaming at me
        if (!theSpike) return false;
        return withinDist(enemy.real_position, theSpike, 36 + theSpike.scale);
    }

    static gradeAttackQueue(queue: AttackQueue, simResult: SimulationResult) {
        queue.grade += simResult.spikesHit;
        if (simResult.pitTrapped) queue.grade += 4;
        if (simResult.oneTicked) queue.grade = Infinity;
    }

    static addAttackQueue(queue: AttackQueue) {
        this.attackQueue.push(queue);
    }

    static prepareBullHitSequence(seq: AttackAction[], reason?: string) {
        const player = Client.player;
        const primaryId = player.weapons[0];
        const attackHat = primaryId === WEAPON_ID_MAP.DAGGERS ? STORE_HAT_MAP.SOLDIER_HELMET : STORE_HAT_MAP.BULL_HELMET;

        const firstAction = seq[0];
        const secondAction = seq[1];

        firstAction.dontUse = false;
        secondAction.dontUse = true;

        firstAction.wpnId = primaryId;
        firstAction.skinData[0] = attackHat;
        firstAction.skinData[1] = false;
        firstAction.aimType = "nearest";
        firstAction.reason = reason ?? "autoBullHit";
    }

    static isAttacking() {
        return this.currentAttackActionHead < 2;
    }

    static setAttackAction(action: AttackAction) {
        if (this.isAttacking()) return;
        this._currentAttackAction = action;
    }

    static stopAttackAction() {
        this.currentAttackActionHead = 3;
        this._currentAttackAction = undefined;
    }

    static placeIntent = {
        retrap: false,
        appleInstaIntent: false
    };

    private static probePlacements() {
        const nearestEnemy = ModManager.enemyData.nearest;
        this.placeIntent.retrap = false;
        this.placeIntent.appleInstaIntent = false;

        if (!nearestEnemy) return;
        if (!nearestEnemy.trap) return;

        const spikeCollisionScale = items.list[Client.player.items[2]].scale + 34;
        const preplacement = PlacementSystem.AutoPlacer.potentialPreplacements;

        for (let i = 0; i < preplacement.count; i++) {
            const item = preplacement.placements[i];
            const itemData = items.list[item.id];

            const isTrap = item.id === LIST_ID_MAP.PIT_TRAP;
            const isSpike = itemData.dmg;
            const isOverlapping = withinDist(item, nearestEnemy.next_position, isSpike ? spikeCollisionScale : 49);

            if (!isOverlapping) continue;
            if (isTrap) this.placeIntent.retrap = true;
            if (isSpike && item.appleInsta) this.placeIntent.appleInstaIntent = true;
        }

        const replacements = PlacementSystem.AutoReplacer.execute(Client.player, nearestEnemy.trap, true);
        if (replacements === undefined) return;

        for (let i = 0; i < replacements.length; i++) {
            const item = replacements[i];
            const isTrap = item.isTrap;
            const isSpike = item.isSpike;
            const isOverlapping = withinDist(item, nearestEnemy.next_position, isSpike ? spikeCollisionScale : 49);

            if (!isOverlapping) continue;
            if (isTrap) this.placeIntent.retrap = true;
            if (isSpike && item.appleInsta) this.placeIntent.appleInstaIntent = true;
        }
    }

    static main() {
        const attackQueue = this.attackQueue;
        const modules = this.modules;
        const modulesLength = modules.length;
        attackQueue.length = 0;

        this.probePlacements();
        for (let i = 0; i < modulesLength; i++) {
            modules[i].init();
            modules[i].update();
        }

        for (let i = 0; i < modulesLength; i++) {
            modules[i].run();
        }

        if (attackQueue.length) {
            // The highest grade wins (One Tick: Infinity; gradeAttackQueue adds spike and pit bonuses); on a tie, the
            // module listed first. It used to always take attackQueue[0] and ignore the grades.
            let bestQueue = attackQueue[0];
            for (let i = 1; i < attackQueue.length; i++) {
                if (attackQueue[i].grade > bestQueue.grade) bestQueue = attackQueue[i];
            }

            AttackQueuePool.copySequenceOver(bestQueue.sequence, this._currentAttackActions)
            this.currentAttackActionHead = 0;
            bestQueue.onSelect?.();
        }

        if (this.currentAttackActionHead < 2) {
            this._currentAttackAction = this.currentAttackActions[this.currentAttackActionHead];
            if (this._currentAttackAction.dontUse) this._currentAttackAction = undefined;
        } else {
            this._currentAttackAction = undefined;
        }

        this.currentAttackActionHead++;
    }
}