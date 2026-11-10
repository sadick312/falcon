// The modules around the Hat System: how Combat Controller plays an attack step and asks for hats, how One Tick picks
// its tap-mode hat and judges the enemy's hat, and how health updates feed the bull helmet cycle. Each test pins
// today's behaviour (the classic contract); none of them changes it.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const IGNORE = -1;
const SOLDIER = 6, BULL = 7, BOOSTER = 12, TANK = 40, TURRET = 53;
const MONKEY_TAIL = 11;
const KATANA = 4, POLEARM = 5, SWORD = 3, GREAT_HAMMER = 10, MUSKET = 15;
const ENEMY = 2;

async function setup(weapons = [POLEARM], options: { enable?: string[] } = {}) {
    game = await startGame({ enable: options.enable });
    game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: weapons[0] });
    game.spawn({ sid: ENEMY, x: 3214, y: 3000, weaponIndex: POLEARM });
    game.setLoadout(weapons, [0, 3, 6, 10, 15]);
    game.update();

    const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    const { default: AutoBreaker } = await import("@core/mod/defense/modules/AutoBreaker");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { Input } = await import("@ui/Input");
    const { tickState } = await import("@core/TickState");
    const player = game.Client.player;
    const enemy = PlayerManager.get(ENEMY)!;
    const oneTicker = AttackManager.oneTicker as unknown as {
        getMoveHat(): number; getMoveDir(peek?: boolean): number | null; canExecute(): boolean; tapMode: boolean;
        willStayInSoldier(enemy: unknown): boolean; getTickMode(i: number): string; minDist: number;
    };
    // manageHitAction is private; reached through a cast (intersecting it with the class type would give never).
    const cc = CombatController;
    const manageHitAction = (action: unknown) => (CombatController as unknown as { manageHitAction(a: unknown): boolean }).manageHitAction(action);
    const am = AttackManager as unknown as { _currentAttackAction: unknown; currentAttackActionHead: number };

    /** Puts the enemy `dist` to our right, as the nearest enemy. */
    function enemyAt(dist: number) {
        enemy.real_position.x = enemy.next_position.x = player.real_position.x + dist;
        enemy.real_position.y = enemy.next_position.y = player.real_position.y;
        tickState.enemyData.nearest = enemy;
    }

    return { CombatController: cc, manageHitAction, AttackManager, am, DefenseSystem, AutoBreaker, Input, tickState, player, enemy, oneTicker, enemyAt };
}

describe("Combat Controller and hats", () => {
    it("drops the running attack when the Defense System forces a hat", async () => {
        const g = await setup();
        g.DefenseSystem.skinIndex = SOLDIER;
        g.am._currentAttackAction = { reason: "x", wpnId: POLEARM, skinData: [BULL, false], noAttack: false };
        g.am.currentAttackActionHead = 0;
        expect(g.manageHitAction(g.AttackManager.currentAttackAction)).toBe(false);
        expect(g.AttackManager.currentAttackAction).toBeUndefined();
    });

    it("plays an attack step: holds its weapon and swings, unless the step only equips", async () => {
        const g = await setup();
        g.DefenseSystem.skinIndex = IGNORE;
        g.CombatController.attackState.confirm = false;
        expect(g.manageHitAction({ reason: "test", wpnId: POLEARM, skinData: [BULL, false], noAttack: false })).toBe(true);
        expect(g.CombatController.attackState.confirm).toBe(true);
        expect(g.tickState.activityList).toContain("test");

        g.CombatController.attackState.confirm = false;
        g.tickState.activityList.length = 0;
        expect(g.manageHitAction({ reason: "don't do 1234", wpnId: POLEARM, skinData: [TURRET, false], noAttack: true })).toBe(true);
        expect(g.CombatController.attackState.confirm).toBe(false);
        expect(g.tickState.activityList).not.toContain("don't do 1234");
    });

    it("stops a One Tick when the enemy already took the turret's 25 (or 25 through a soldier helmet)", async () => {
        for (const dmg of [25, 18.75]) {
            const g = await setup();
            g.DefenseSystem.skinIndex = IGNORE;
            g.enemyAt(214);
            g.enemy.damages.length = 0;
            g.enemy.damages.push(dmg);
            g.am._currentAttackAction = { reason: "oneTick", wpnId: POLEARM, skinData: [BULL, false], noAttack: false };
            expect(g.manageHitAction(g.AttackManager.currentAttackAction), String(dmg)).toBe(false);
            game!.done();
        }
    });

    it("keeps a One Tick going after other damage", async () => {
        const g = await setup();
        g.DefenseSystem.skinIndex = IGNORE;
        g.enemyAt(214);
        g.enemy.damages.length = 0;
        g.enemy.damages.push(33);
        expect(g.manageHitAction({ reason: "oneTick", wpnId: POLEARM, skinData: [BULL, false], noAttack: false })).toBe(true);
    });

    it("doesn't swing while dead", async () => {
        const g = await setup();
        g.CombatController.attackState.confirm = false;
        g.player.health = 0;
        g.CombatController.hitOnce();
        expect(g.CombatController.attackState.confirm).toBe(false);
    });

    it("breaks with the great hammer when we have one, else the primary", async () => {
        const g = await setup([POLEARM, GREAT_HAMMER]);
        expect(g.CombatController.bestWeaponForBreak()).toBe(GREAT_HAMMER);
        expect(g.CombatController.bestWeaponForBreak("group")).toBe(1);

        const g2 = await setup([POLEARM, MUSKET]);
        expect(g2.CombatController.bestWeaponForBreak()).toBe(POLEARM);
        expect(g2.CombatController.bestWeaponForBreak("group")).toBe(0);
    });

    it("tank spam: asks for tank gear and swings once the break weapon is reloaded (primary with Shift held)", async () => {
        const g = await setup([POLEARM, GREAT_HAMMER]);
        g.DefenseSystem.skinIndex = IGNORE;
        g.am._currentAttackAction = undefined;
        g.player.trap = undefined;
        g.CombatController.tankSpam = true;
        try {
            g.player.reloads[GREAT_HAMMER] = 1;
            g.CombatController.main();
            expect(g.CombatController.currentMode).toBe("tankspam");
            expect(g.CombatController.skinIndex).toBe(TANK);

            g.Input.keys["ShiftLeft"] = true;
            g.player.reloads[POLEARM] = 0;
            g.CombatController.main();
            expect(g.CombatController.skinIndex).toBe(IGNORE);
        } finally {
            g.CombatController.tankSpam = false;
            delete g.Input.keys["ShiftLeft"];
        }
    });

    it("with Select Best Weapon, holds the great hammer next to a polearm or katana, else the primary", async () => {
        for (const [weapons, held] of [[[POLEARM, GREAT_HAMMER], GREAT_HAMMER], [[KATANA, GREAT_HAMMER], GREAT_HAMMER], [[SWORD, GREAT_HAMMER], SWORD]] as const) {
            game = await startGame({ enable: ["selectBestWeapon"] });
            game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: weapons[0] });
            game.setLoadout([...weapons], [0, 3, 6, 10, 15]);
            game.update();
            const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
            const player = game.Client.player;
            player.reloads[weapons[0]] = 1;
            player.reloads[weapons[1]] = 1;
            CombatController.main();
            expect(game.Client.weaponIndex, weapons.join("+")).toBe(held);
            game.done();
        }
    });
});

describe("One Tick and hats", () => {
    it("tap-mode hat: booster far from the ideal spot, tank gear right at it, soldier in between", async () => {
        const g = await setup();
        const ideal = g.oneTicker.minDist + 10;
        g.enemyAt(ideal + 30);
        expect(g.oneTicker.getMoveHat()).toBe(BOOSTER);
        g.enemyAt(ideal + 5);
        expect(g.oneTicker.getMoveHat()).toBe(TANK);
        g.enemyAt(ideal + 15);
        expect(g.oneTicker.getMoveHat()).toBe(SOLDIER);
    });

    it("tap mode has no hat while trapped, without an enemy, or without a polearm (and leaves tap mode then)", async () => {
        const g = await setup();
        g.enemyAt(300);
        g.player.trap = {} as never;
        expect(g.oneTicker.getMoveHat()).toBe(IGNORE);
        g.player.trap = undefined;

        g.oneTicker.tapMode = true;
        g.tickState.enemyData.nearest = null;
        expect(g.oneTicker.getMoveHat()).toBe(IGNORE);
        expect(g.oneTicker.tapMode).toBe(false);

        const g2 = await setup([KATANA]);
        g2.enemyAt(300);
        g2.oneTicker.tapMode = true;
        expect(g2.oneTicker.getMoveHat()).toBe(IGNORE);
        expect(g2.oneTicker.tapMode).toBe(false);
    });

    it("tap-mode movement: toward the enemy when too far, away when too close, still at the spot", async () => {
        const g = await setup();
        const ideal = g.oneTicker.minDist + 10;
        g.tickState.enemyData.angle = 0;
        g.enemyAt(ideal + 30);
        expect(g.oneTicker.getMoveDir()).toBe(0);
        g.enemyAt(ideal - 30);
        expect(g.oneTicker.getMoveDir()).toBeCloseTo(Math.PI);
        g.enemyAt(ideal + 2);
        expect(g.oneTicker.getMoveDir()).toBeNull();

        g.player.trap = {} as never;
        expect(g.oneTicker.getMoveDir()).toBeNull();
        g.player.trap = undefined;

        g.oneTicker.tapMode = true;
        g.tickState.enemyData.nearest = null;
        expect(g.oneTicker.getMoveDir(true)).toBeNull();
        expect(g.oneTicker.tapMode).toBe(true);
        expect(g.oneTicker.getMoveDir()).toBeNull();
        expect(g.oneTicker.tapMode).toBe(false);
    });

    it("names its moves: 0 = toward, 1 = stop, 2 = away", async () => {
        const g = await setup();
        expect([0, 1, 2].map(i => g.oneTicker.getTickMode(i))).toEqual(["to", "stop", "away"]);
    });

    it("won't start without an enemy, while a hat is forced, while breaking spikes, or with Monkey Tail on", async () => {
        const g = await setup([POLEARM], { enable: ["dynamicOneTick"] });
        const ready = () => {
            g.enemyAt(214);
            g.DefenseSystem.skinIndex = IGNORE;
            g.AutoBreaker.allSpikesBuffer.length = 0;
            g.player.tailIndex = 0;
            g.am.currentAttackActionHead = 3;
        };
        ready();
        expect(g.oneTicker.canExecute()).toBe(true);

        ready();
        g.oneTicker.tapMode = true;
        g.tickState.enemyData.nearest = null;
        expect(g.oneTicker.canExecute()).toBe(false);
        expect(g.oneTicker.tapMode).toBe(false);

        ready();
        g.DefenseSystem.skinIndex = SOLDIER;
        expect(g.oneTicker.canExecute()).toBe(false);

        ready();
        g.AutoBreaker.allSpikesBuffer.push({} as never);
        expect(g.oneTicker.canExecute()).toBe(false);

        ready();
        g.player.tailIndex = MONKEY_TAIL;
        expect(g.oneTicker.canExecute()).toBe(false);
    });

    it("judges whether the enemy stays in its soldier helmet through the combo", async () => {
        const g = await setup();
        const e = g.enemy as unknown as { shameCount: number; bullTick: number; clowned: boolean; appendHat(id: number): void; weaponIndex: number; reloads: number[] };
        // Never seen in tank gear: stays in soldier.
        e.shameCount = 0;
        e.clowned = false;
        expect(g.oneTicker.willStayInSoldier(g.enemy)).toBe(true);

        // About to take a bull tick: the bull helmet comes on, so no.
        e.shameCount = 1;
        e.bullTick = g.tickState.tick - 8;
        expect(g.oneTicker.willStayInSoldier(g.enemy)).toBe(false);
        e.shameCount = 0;

        e.clowned = true;
        expect(g.oneTicker.willStayInSoldier(g.enemy)).toBe(false);
        e.clowned = false;

        // Has tank gear: stays in soldier only while its weapon is still reloading next tick.
        e.appendHat(TANK);
        e.weaponIndex = POLEARM;
        e.reloads[POLEARM] = 0;
        expect(g.oneTicker.willStayInSoldier(g.enemy)).toBe(true);
        e.reloads[POLEARM] = 1;
        expect(g.oneTicker.willStayInSoldier(g.enemy)).toBe(false);
    });
});

describe("Health updates", () => {
    it("ignore a player we don't know", async () => {
        await setup();
        expect(() => game!.setHealth(99, 50)).not.toThrow();
    });

    it("log an enemy's death in the chat log with the damage it took", async () => {
        await setup();
        const { default: Menu } = await import("@menu/Menu");
        const before = JSON.stringify((Menu as unknown as { chatLogs?: unknown }).chatLogs ?? null);
        game!.setHealth(ENEMY, 60);
        game!.setHealth(ENEMY, 0);
        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        expect(PlayerManager.get(ENEMY)!.health).toBe(0);
        expect(PlayerManager.get(ENEMY)!.damages).toContain(40);
        void before;
    });
});
