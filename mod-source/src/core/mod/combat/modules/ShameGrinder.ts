import CombatModule from "@combat-utils/CombatModule";
import CombatUtils from "@combat-utils/CombatUtils";
import { WEAPON_ID_MAP } from "@constants/items";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";

/**
 * Shame Grind: wears a trapped enemy down before Apple Insta.
 *
 * Apple Insta (break the trap with the great hammer, bull hit, spike where the trap was) fails when the enemy eats
 * right after the hit. So while the enemy sits in a trap, this "fakes" it: a bull hit with the primary, without
 * breaking the trap. An enemy who eats within 120 ms of being hit gains shame (1.8.2), and at 8 they wear Shame for
 * 30 s and eating doesn't heal (1.8.2's `shameTimer <= 0 && consume(...)`). It lets Apple Insta go when either:
 * - the enemy is shamed (can't heal), or
 * - the enemy stopped healing right after our hits: a fake that landed didn't raise their shame.
 * It also lets Apple Insta go after MAX_FAKES fakes, so it never stalls the kill for good.
 */
export default class ShameGrinder extends CombatModule {
    /** Fakes before giving up and letting Apple Insta try anyway. */
    static readonly MAX_FAKES = 12;
    /** Ticks after a fake before judging it: the hit, then the enemy's heal, can each take a tick to show up. */
    static readonly JUDGE_AFTER_TICKS = 2;

    private attackAction!: AttackQueue;

    /** The enemy being ground down; reset when the nearest enemy changes or leaves the trap. */
    private targetSid = -1;
    fakes = 0;
    /** True once Apple Insta may go (see the class comment). */
    finished = false;
    private lastFakeTick = -1;
    private shameAtFake = 0;
    private healthAtFake = 0;
    private landed = false;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();
        this.attackAction.grade = 2;
        this.attackAction.cost = 1;
    }

    override reset() {
        this.forget(-1);
    }

    private forget(sid: number) {
        this.targetSid = sid;
        this.fakes = 0;
        this.finished = false;
        this.lastFakeTick = -1;
        this.landed = false;
    }

    private static isOn() {
        return !!Menu.getValue("shameGrind") && !!Menu.getValue("appleInsta") &&
            !!Menu.getValue("preplacer") && !!Menu.getValue("autoPlacing");
    }

    /** Whether Apple Insta should wait this tick because the enemy is still being ground down. */
    holdsAppleInsta() {
        if (!ShameGrinder.isOn()) return false;
        const enemy = ModManager.enemyData.nearest;
        return !!enemy && !!enemy.trap && enemy.sid === this.targetSid && !this.finished;
    }

    override update() {
        const enemy = ModManager.enemyData.nearest;

        if (!enemy || !enemy.trap) {
            if (this.targetSid !== -1) this.forget(-1);
            return;
        }

        if (enemy.sid !== this.targetSid) this.forget(enemy.sid);
        if (this.finished) return;

        if (enemy.clowned) {
            this.finished = true;
            ModManager.activityList.push("shameGrind:shamed");
            return;
        }

        if (this.lastFakeTick < 0) return;
        if (enemy.health < this.healthAtFake) this.landed = true;
        if (ModManager.tick - this.lastFakeTick < ShameGrinder.JUDGE_AFTER_TICKS) return;

        // Judge the last fake once. A fake that didn't land tells us nothing.
        const rose = enemy.shameCount > this.shameAtFake;
        if (this.landed && !rose) {
            this.finished = true;
            ModManager.activityList.push("shameGrind:stoppedHealing");
        } else if (this.fakes >= ShameGrinder.MAX_FAKES) {
            this.finished = true;
            ModManager.activityList.push("shameGrind:gaveUp");
        }

        this.lastFakeTick = -1;
        this.landed = false;
    }

    protected canExecute() {
        if (!ShameGrinder.isOn()) return false;
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (AttackManager.checkForAutoPushingStatus()) return false;
        return this.holdsAppleInsta();
    }

    protected execute() {
        const player = Client.player;
        const enemy = ModManager.enemyData.nearest!;

        // Only what the real Apple Insta needs too: the great hammer to finish with, and a ready primary in reach.
        if (player.weapons[1] !== WEAPON_ID_MAP.GREAT_HAMMER) return;
        // Waiting for the last fake to be judged.
        if (this.lastFakeTick >= 0) return;

        const primary = PlayerCombatManager.fetch(player, 0);
        if (primary.reload !== 1) return;
        if (!CombatUtils.canAttack(enemy, player, primary.id)) return;

        AttackManager.prepareBullHitSequence(this.attackAction.sequence, "shameGrind");
        AttackManager.addAttackQueue(this.attackAction);

        this.fakes++;
        this.lastFakeTick = ModManager.tick;
        this.shameAtFake = enemy.shameCount;
        this.healthAtFake = enemy.health;
        this.landed = false;
    }
}
