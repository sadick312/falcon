// The "classic contract" of the Hat System (HatSystem.ts): which hat and which accessory it picks in each situation, in
// priority order. One test per row of the contract table, then overlaps (the higher row wins). The decision is checked
// directly, with every other input set to "nothing going on", so each test sees exactly one rule. Any change to what
// these tests expect is a change to the classic behaviour and needs the user's OK and a menu toggle (default classic).
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const IGNORE = -1;
// Hats
const SOLDIER = 6, BULL = 7, BOOSTER = 12, SPIKE_GEAR = 11, WINTER_CAP = 15, EMP = 22, BARBARIAN = 26, FLIPPER = 31, TANK = 40, TURRET = 53;
// Accessories
const MONKEY_TAIL = 11, ANGEL_WINGS = 13, BLOOD_WINGS = 18, SHADOW_WINGS = 19, CX_WINGS = 21;
// Weapons
const SWORD = 3, KATANA = 4, POLEARM = 5, DAGGERS = 7, STICK = 8;

const ENEMY = 2;

/** A game with us and one enemy far away, plus every module the Hat System reads, all set to "nothing going on". */
async function setup(options: { enable?: string[]; settings?: Record<string, unknown>; weapon?: number } = {}) {
    game = await startGame({ enable: options.enable, settings: options.settings });
    game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: options.weapon ?? POLEARM });
    game.spawn({ sid: ENEMY, x: 12000, y: 12000, weaponIndex: SWORD });
    game.setLoadout([options.weapon ?? POLEARM], [0, 3, 6, 10, 15]);
    game.update();

    const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: AutoBreaker } = await import("@core/mod/defense/modules/AutoBreaker");
    const { default: AutoPusher } = await import("@core/mod/combat/core/AutoPusher");
    const { default: WingsUtils } = await import("@core/mod/defense/utils/WingsUtils");
    const { tickState } = await import("@core/TickState");
    const { Client } = game;
    const player = Client.player;
    const enemy = (await import("@core/logic/players/PlayerManager")).default.get(ENEMY)!;

    const hs = HatSystem as unknown as {
        fetchBestHat(): number; fetchBestAccessory(): number; main(): void;
        needTick: number; sentHatPacket: boolean; stopMoveDuration: number;
    };
    const am = AttackManager as unknown as { _currentAttackAction: unknown };

    /** Every input to "nothing going on", us at (3000, 3000) moving, the enemy far away. */
    function neutral() {
        DefenseSystem.skinIndex = IGNORE;
        DefenseSystem.canPlaceOnMe = false;
        DefenseSystem.state.totalDamage = 0;
        DefenseSystem.state.spikeThreats = 0;
        DefenseSystem.state.sources.length = 0;
        am._currentAttackAction = undefined;
        AttackManager.oneTicker.tapMode = false;
        AttackManager.antiBuller.consider = false;
        CombatController.skinIndex = IGNORE;
        CombatController.mustBeSoldier = false;
        CombatController.currentMode = "none";
        AutoBreaker.allSpikesBuffer.length = 0;
        AutoPusher.theSpike = undefined;
        tickState.enemyData.nearest = null;
        tickState.enemyData.nearby.length = 0;
        tickState.enemyData.rangedInstaThreats = 0;
        tickState.activityList.length = 0;
        player.turretThreats = 0;
        player.trap = undefined;
        player.shameCount = 0;
        player.clowned = false;
        player.health = 100;
        player.tailIndex = 0;
        player.zIndex = 0;
        player.real_position.x = 3000;
        player.real_position.y = 3000;
        player.bullTick = tickState.tick + 1; // no bull tick due
        hs.needTick = 0;
        hs.stopMoveDuration = 0;
        hs.sentHatPacket = false;
        Client.lastMoveDir = 0;
        enemy.real_position.x = 12000;
        enemy.real_position.y = 12000;
        enemy.next_position.x = 12000;
        enemy.next_position.y = 12000;
        enemy.trap = undefined;
    }

    /** The enemy `dist` to our right, as the nearest enemy, holding `primary`. */
    function enemyAt(dist: number, primary = SWORD) {
        enemy.real_position.x = enemy.next_position.x = player.real_position.x + dist;
        enemy.real_position.y = enemy.next_position.y = player.real_position.y;
        enemy.weaponData.primary = primary;
        tickState.enemyData.nearest = enemy;
        tickState.enemyData.nearby.length = 0;
        tickState.enemyData.nearby.push(enemy);
    }

    /** An attack step wearing `id` (an accessory when `isAccessory`). */
    function attack(id: number, isAccessory = false, tickMode?: "to" | "away" | "stop") {
        am._currentAttackAction = { skinData: [id, isAccessory], tickMode, noAttack: true, wpnId: player.weapons[0] };
    }

    /** A bull tick is due this tick (we're shamed, and 9 ticks passed since the last health drain). */
    function bullTickDue() {
        player.shameCount = 1;
        player.bullTick = tickState.tick;
    }

    neutral();
    return {
        HatSystem: hs, DefenseSystem, CombatController, AttackManager, AutoBreaker, AutoPusher, WingsUtils, tickState, Client, player, enemy,
        neutral, enemyAt, attack, bullTickDue,
        hat: () => hs.fetchBestHat(),
        acc: () => hs.fetchBestAccessory()
    };
}

describe("Hat System classic contract: hat", () => {
    it("1. wears what the Defense System forces (soldier or EMP), over everything", async () => {
        const g = await setup();
        g.DefenseSystem.skinIndex = SOLDIER;
        expect(g.hat()).toBe(SOLDIER);
        expect(g.tickState.activityList).toContain("forceSoldier");

        g.neutral();
        g.DefenseSystem.skinIndex = EMP;
        expect(g.hat()).toBe(EMP);
        expect(g.tickState.activityList).toContain("forceEMP");
    });

    it("2. wears the running attack's hat", async () => {
        const g = await setup();
        for (const id of [BULL, TURRET, TANK, BARBARIAN, SOLDIER]) {
            g.neutral();
            g.attack(id);
            expect(g.hat(), String(id)).toBe(id);
        }
    });

    it("2. an attack that only asks for an accessory leaves the hat to the rules below", async () => {
        const g = await setup();
        g.attack(SHADOW_WINGS, true);
        expect(g.hat()).toBe(BOOSTER);
    });

    it("3. in One Tick tap mode, wears the hat for the distance to the ideal spot", async () => {
        const g = await setup();
        for (const id of [BOOSTER, TANK, SOLDIER]) {
            g.neutral();
            g.AttackManager.oneTicker.tapMode = true;
            vi.spyOn(g.AttackManager.oneTicker, "getMoveHat").mockReturnValue(id as never);
            expect(g.hat(), String(id)).toBe(id);
        }
    });

    it("3. tap mode with no move hat falls through to the rules below", async () => {
        const g = await setup();
        g.AttackManager.oneTicker.tapMode = true;
        vi.spyOn(g.AttackManager.oneTicker, "getMoveHat").mockReturnValue(IGNORE as never);
        expect(g.hat()).toBe(BOOSTER);
    });

    describe("4. Combat Controller asks for a hat (breaking, grinding, spamming)", () => {
        it("4e. wears the hat it asked for", async () => {
            const g = await setup();
            for (const id of [TANK, SOLDIER, BULL]) {
                g.neutral();
                g.CombatController.skinIndex = id as never;
                expect(g.hat(), String(id)).toBe(id);
            }
        });

        it("4a. soldier when soldier is required or spikes threaten us (not when it asked for tank gear)", async () => {
            const g = await setup();
            g.CombatController.skinIndex = BULL as never;
            g.CombatController.mustBeSoldier = true;
            expect(g.hat()).toBe(SOLDIER);

            g.neutral();
            g.CombatController.skinIndex = BULL as never;
            g.DefenseSystem.state.spikeThreats = 1;
            expect(g.hat()).toBe(SOLDIER);

            g.neutral();
            g.CombatController.skinIndex = TANK as never;
            g.CombatController.mustBeSoldier = true;
            expect(g.hat()).toBe(TANK);
        });

        it("4b. EMP against a turret, or a ranged insta when there are no spikes to break", async () => {
            const g = await setup();
            g.CombatController.skinIndex = SOLDIER as never;
            g.player.turretThreats = 1;
            expect(g.hat()).toBe(EMP);

            g.neutral();
            g.CombatController.skinIndex = SOLDIER as never;
            g.tickState.enemyData.rangedInstaThreats = 1;
            expect(g.hat()).toBe(EMP);

            g.neutral();
            g.CombatController.skinIndex = SOLDIER as never;
            g.tickState.enemyData.rangedInstaThreats = 1;
            g.AutoBreaker.allSpikesBuffer.push({} as never);
            expect(g.hat()).toBe(SOLDIER);
        });

        it("4c. bull helmet when a bull tick is due", async () => {
            const g = await setup();
            g.CombatController.skinIndex = SOLDIER as never;
            g.bullTickDue();
            expect(g.hat()).toBe(BULL);
            expect(g.tickState.activityList).toContain("bullTick");
        });

        it("4d. spike gear for Anti Bull, unless breaking spikes", async () => {
            const g = await setup();
            const antiBull = () => {
                g.CombatController.skinIndex = SOLDIER as never;
                g.AttackManager.antiBuller.consider = true;
                g.player.tailIndex = CX_WINGS;
            };
            antiBull();
            expect(g.hat()).toBe(SPIKE_GEAR);

            g.neutral();
            antiBull();
            g.CombatController.currentMode = "autobreakspike";
            expect(g.hat()).toBe(SOLDIER);
        });
    });

    it("5. EMP against a ranged insta while standing still", async () => {
        const g = await setup();
        g.tickState.enemyData.rangedInstaThreats = 1;
        g.Client.lastMoveDir = null;
        expect(g.hat()).toBe(EMP);

        // Moving: no.
        g.neutral();
        g.tickState.enemyData.rangedInstaThreats = 1;
        expect(g.hat()).toBe(BOOSTER);
    });

    it("6. bull helmet when a bull tick is due", async () => {
        const g = await setup();
        g.bullTickDue();
        expect(g.hat()).toBe(BULL);
    });

    it("7. EMP against a turret", async () => {
        const g = await setup();
        g.player.turretThreats = 1;
        expect(g.hat()).toBe(EMP);
    });

    it("8. spike gear for Anti Bull (wearing Corrupt X Wings, nothing could be placed on us, no spike threat)", async () => {
        const g = await setup();
        g.AttackManager.antiBuller.consider = true;
        g.player.tailIndex = CX_WINGS;
        expect(g.hat()).toBe(SPIKE_GEAR);

        for (const block of [() => { g.DefenseSystem.canPlaceOnMe = true; }, () => { g.DefenseSystem.state.spikeThreats = 1; }, () => { g.player.tailIndex = SHADOW_WINGS; }]) {
            g.neutral();
            g.AttackManager.antiBuller.consider = true;
            g.player.tailIndex = CX_WINGS;
            block();
            expect(g.hat()).not.toBe(SPIKE_GEAR);
        }
    });

    it("9. flipper hat in the river", async () => {
        const g = await setup();
        g.player.real_position.y = 7200;
        expect(g.hat()).toBe(FLIPPER);
    });

    describe("10. soldier helmet against a close enemy", () => {
        it("against most weapons within 200", async () => {
            const g = await setup();
            g.enemyAt(190, SWORD);
            expect(g.hat()).toBe(SOLDIER);

            g.neutral();
            g.enemyAt(210, SWORD);
            expect(g.hat()).toBe(BOOSTER);
        });

        it("EMP instead while standing still with a ranged insta threat", async () => {
            const g = await setup();
            g.enemyAt(150, SWORD);
            g.tickState.enemyData.rangedInstaThreats = 1;
            g.Client.lastMoveDir = null;
            // Rule 5 already gives EMP here; this is the same answer from rule 10.
            expect(g.hat()).toBe(EMP);
        });

        it("against a polearm only when its next swing can land (or something else threatens us)", async () => {
            const g = await setup();
            g.enemyAt(150, POLEARM);
            g.enemy.reloads[POLEARM] = 0;
            expect(g.hat()).toBe(BOOSTER);

            g.neutral();
            g.enemyAt(150, POLEARM);
            g.enemy.reloads[POLEARM] = 1;
            expect(g.hat()).toBe(SOLDIER);

            g.neutral();
            g.enemyAt(150, POLEARM);
            g.enemy.reloads[POLEARM] = 0;
            g.player.turretThreats = 0;
            g.DefenseSystem.canPlaceOnMe = true;
            expect(g.hat()).toBe(SOLDIER);
        });

        it("against daggers from further away (dagger range x1.3), when they can reach us", async () => {
            const g = await setup();
            g.enemyAt(250, DAGGERS);
            expect(g.hat()).toBe(BOOSTER);

            g.neutral();
            g.enemyAt(100, DAGGERS);
            expect(g.hat()).toBe(SOLDIER);
        });
    });

    it("11. winter cap in the snow", async () => {
        const g = await setup();
        g.player.real_position.y = 1000;
        expect(g.hat()).toBe(WINTER_CAP);
    });

    it("12. booster hat while moving", async () => {
        const g = await setup();
        expect(g.hat()).toBe(BOOSTER);
    });

    it("13. after stopping: keeps the hat for 1 tick, then soldier helmet", async () => {
        const g = await setup();
        g.Client.lastMoveDir = null;
        expect(g.hat()).toBe(IGNORE);
        expect(g.hat()).toBe(SOLDIER);
        expect(g.hat()).toBe(SOLDIER);

        // Moving again restarts the count.
        g.Client.lastMoveDir = 0;
        expect(g.hat()).toBe(BOOSTER);
        g.Client.lastMoveDir = null;
        expect(g.hat()).toBe(IGNORE);
    });
});

describe("Hat System classic contract: accessory", () => {
    it("1. wears the accessory the running attack asks for", async () => {
        const g = await setup();
        g.attack(BLOOD_WINGS, true);
        expect(g.acc()).toBe(BLOOD_WINGS);
    });

    it("2. shadow wings during a One Tick step that moves (tick mode)", async () => {
        const g = await setup();
        g.attack(TURRET, false, "to");
        expect(g.acc()).toBe(SHADOW_WINGS);
    });

    it("3. shadow wings while push-striking an enemy within 125 (not with a stick; daggers only with the bull spam method)", async () => {
        const g = await setup();
        const push = (dist: number) => {
            g.AutoPusher.theSpike = { x: 0, y: 0, scale: 50 } as never;
            g.enemyAt(dist);
        };
        push(120);
        expect(g.acc()).toBe(SHADOW_WINGS);
        expect(g.tickState.activityList).toContain("forceStrikeWings");

        // Beyond 125 the push-strike rule stays out (row 5 still gives shadow wings near an enemy with a polearm).
        g.neutral();
        push(130);
        g.acc();
        expect(g.tickState.activityList).not.toContain("forceStrikeWings");
    });

    it("3. with daggers only when the push dagger method is bull spam (1)", async () => {
        for (const [method, expected] of [["0", false], ["1", true]] as const) {
            const g = await setup({ weapon: DAGGERS, settings: { "attackInPush:dagger_method": method } });
            g.AutoPusher.theSpike = { x: 0, y: 0, scale: 50 } as never;
            g.enemyAt(120);
            g.acc();
            expect(g.tickState.activityList.includes("forceStrikeWings"), method).toBe(expected);
            game!.done();
        }
    });

    it("3. not with a stick", async () => {
        const g = await setup({ weapon: STICK });
        g.AutoPusher.theSpike = { x: 0, y: 0, scale: 50 } as never;
        g.enemyAt(120);
        expect(g.acc()).toBe(MONKEY_TAIL);
    });

    it("4. blood wings for a melee hit on an enemy while hurt (Blood Wings Optimizations on)", async () => {
        const g = await setup({ enable: ["bloodWingsOptimizations"] });
        vi.spyOn(g.WingsUtils, "willHitPlayer").mockReturnValue(true);
        g.player.health = 80;
        expect(g.acc()).toBe(BLOOD_WINGS);
        expect(g.tickState.activityList).toContain("bloodWings");

        g.neutral();
        expect(g.acc()).toBe(MONKEY_TAIL); // full health
    });

    it("4. not when Blood Wings Optimizations is off", async () => {
        const g = await setup();
        vi.spyOn(g.WingsUtils, "willHitPlayer").mockReturnValue(true);
        g.player.health = 80;
        expect(g.acc()).toBe(MONKEY_TAIL);
    });

    it("5. shadow wings with an enemy within 350 while holding an attack primary", async () => {
        for (const weapon of [SWORD, KATANA, POLEARM]) {
            const g = await setup({ weapon });
            g.enemyAt(340);
            expect(g.acc(), String(weapon)).toBe(SHADOW_WINGS);
            game!.done();
        }
    });

    it("5. not with a non-attack primary, or beyond 350", async () => {
        const g = await setup({ weapon: DAGGERS });
        g.enemyAt(300);
        expect(g.acc()).toBe(MONKEY_TAIL);

        const g2 = await setup();
        g2.enemyAt(360);
        expect(g2.acc()).toBe(MONKEY_TAIL);
    });

    it("5. corrupt X wings within 200 with Anti Bull on, against a katana or polearm", async () => {
        const g = await setup({ enable: ["antiBull"] });
        g.enemyAt(190, KATANA);
        expect(g.acc()).toBe(CX_WINGS);

        g.neutral();
        g.enemyAt(210, KATANA);
        expect(g.acc()).toBe(SHADOW_WINGS);

        g.neutral();
        g.enemyAt(190, SWORD);
        expect(g.acc()).toBe(SHADOW_WINGS);
    });

    it("5. corrupt X wings against daggers only with a diamond polearm or better", async () => {
        const g = await setup({ enable: ["antiBull"] });
        g.enemyAt(150, DAGGERS);
        g.player.weaponData.primaryVariant = 1;
        expect(g.acc()).toBe(SHADOW_WINGS);

        g.neutral();
        g.enemyAt(150, DAGGERS);
        g.player.weaponData.primaryVariant = 2;
        expect(g.acc()).toBe(CX_WINGS);
    });

    it("6. angel wings while hurt with no enemy close (Angel Wings Regen on)", async () => {
        const g = await setup({ enable: ["angelWingsRegen"] });
        g.player.health = 80;
        expect(g.acc()).toBe(ANGEL_WINGS);

        g.neutral();
        g.player.health = 80;
        g.enemyAt(300, SWORD);
        expect(g.acc()).toBe(SHADOW_WINGS);
    });

    it("7. monkey tail otherwise", async () => {
        const g = await setup();
        expect(g.acc()).toBe(MONKEY_TAIL);
    });
});

describe("Hat System classic contract: overlaps (the higher rule wins)", () => {
    it("forced defense hat beats an attack, a bull tick, a turret and the river", async () => {
        const g = await setup();
        g.DefenseSystem.skinIndex = SOLDIER;
        g.attack(BULL);
        g.bullTickDue();
        g.player.turretThreats = 1;
        g.player.real_position.y = 7200;
        expect(g.hat()).toBe(SOLDIER);
    });

    it("an attack's hat beats a bull tick, tap mode and Combat Controller", async () => {
        const g = await setup();
        g.attack(TURRET);
        g.bullTickDue();
        g.AttackManager.oneTicker.tapMode = true;
        vi.spyOn(g.AttackManager.oneTicker, "getMoveHat").mockReturnValue(TANK as never);
        g.CombatController.skinIndex = TANK as never;
        expect(g.hat()).toBe(TURRET);
    });

    it("a bull tick beats EMP against a turret, the river and a close enemy", async () => {
        const g = await setup();
        g.bullTickDue();
        g.player.turretThreats = 1;
        g.player.real_position.y = 7200;
        g.enemyAt(150);
        expect(g.hat()).toBe(BULL);
    });

    it("the river beats soldier against a close enemy (classic behaviour)", async () => {
        const g = await setup();
        g.player.real_position.y = 7200;
        g.enemyAt(150, SWORD);
        expect(g.hat()).toBe(FLIPPER);
    });

    it("soldier against a close enemy beats the snow", async () => {
        const g = await setup();
        g.player.real_position.y = 1000;
        g.enemyAt(150, SWORD);
        expect(g.hat()).toBe(SOLDIER);
    });

    it("tick-mode shadow wings beat push-strike, blood wings and corrupt X wings", async () => {
        const g = await setup({ enable: ["antiBull", "bloodWingsOptimizations"] });
        vi.spyOn(g.WingsUtils, "willHitPlayer").mockReturnValue(true);
        g.player.health = 80;
        g.attack(BULL, false, "to");
        g.enemyAt(150, KATANA);
        expect(g.acc()).toBe(SHADOW_WINGS);
    });

    it("blood wings beat corrupt X wings and shadow wings near an enemy", async () => {
        const g = await setup({ enable: ["antiBull", "bloodWingsOptimizations"] });
        vi.spyOn(g.WingsUtils, "willHitPlayer").mockReturnValue(true);
        g.player.health = 80;
        g.enemyAt(150, KATANA);
        expect(g.acc()).toBe(BLOOD_WINGS);
    });
});
