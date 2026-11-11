// Hat brief, Phase 1: the branches of the Hat System's callers that the other tests left out (Spike Tick, Turret
// Bullet Assist, Bullspam and Shame Strike push strikes), plus two whole-tick checks of the Hat System itself: a steady
// situation sends each item once and never swaps back, and danger + an attack + healing in one tick ends in the
// highest rule's hat with the heal still done. None of these change behaviour; they pin down the classic one.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const SOLDIER = 6, BULL = 7, TURRET = 53;
const POLEARM = 5, DAGGERS = 7;
const ENEMY = 2;

describe("Spike Tick: every reason not to hit", () => {
    async function setUp(enable = ["spikeTick", "autoPlacing", "replacer"]) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.spawn({ sid: ENEMY, x: 1090, y: 1000 });
        game.setLoadout([POLEARM, 10], [0, 3, 6, 15]);
        game.addObjects([{ sid: 600, x: 1090, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME }]);
        game.update();
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
        const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
        const { tickState } = await import("@core/TickState");
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        const hit = () => { AttackManager.spikeTicker.consider = true; AttackManager.spikeTicker.run(); return queued.mock.calls.length; };
        return { AttackManager, HatSystem, DefenseSystem, tickState, queued, hit, LIST_ID_MAP };
    }

    it("hits in the normal case (so the cases below can fail)", async () => {
        expect((await setUp()).hit()).toBe(1);
    });

    it("not while another attack is running", async () => {
        const t = await setUp();
        vi.spyOn(t.AttackManager, "isAttacking").mockReturnValue(true);
        expect(t.hit()).toBe(0);
    });

    it("not while the Defense System forces a hat", async () => {
        const t = await setUp();
        vi.spyOn(t.HatSystem, "allowHatSwitch").mockReturnValue(false);
        expect(t.hit()).toBe(0);
    });

    it("not without an enemy", async () => {
        const t = await setUp();
        t.tickState.enemyData.nearest = null;
        expect(t.hit()).toBe(0);
    });

    it("not with Auto Placing or the Replacer off", async () => {
        expect((await setUp(["spikeTick", "replacer"])).hit()).toBe(0);
        game!.done();
        expect((await setUp(["spikeTick", "autoPlacing"])).hit()).toBe(0);
    });

    it("marks the spike less gladly when the enemy could place on us", async () => {
        const t = await setUp();
        t.DefenseSystem.canPlaceOnMe = true;
        const angle = { grade: 0, id: t.LIST_ID_MAP.SPIKES, spikeTick: false };
        t.AttackManager.spikeTicker.process(angle as never, t.tickState.enemyData.nearest!);
        expect(angle).toMatchObject({ spikeTick: true, grade: -2 });
    });
});

describe("Turret Bullet Assist: every reason not to put turret gear on", () => {
    /** The enemy trapped against our spike 230 away (as in turret-assist.test.ts), not yet hurt; the module run alone. */
    async function setUp() {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["turretBulletAssistOnAP"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM, weaponVariant: 2 });
        game.spawn({ sid: ENEMY, x: 1230, y: 1000 });
        game.setLoadout([POLEARM], [0, 3, 6, 15]);
        game.addObjects([
            { sid: 700, x: 1300, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: ME },
            { sid: 600, x: 1230, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME }
        ]);
        game.update();
        game.update();

        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const { default: AutoPusher } = await import("@core/mod/combat/core/AutoPusher");
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        const { tickState } = await import("@core/TickState");
        const module = AttackManager.modules.find(m => m.constructor.name === "TurretAPAssister")!;
        const enemy = tickState.enemyData.nearest!;
        enemy.damages.push(20); // taking damage
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        const assists = () => { queued.mockClear(); module.run(); return queued.mock.calls.length; };
        return { AttackManager, AutoPusher, ObjectManager, enemy, player: game.Client.player, assists };
    }

    it("assists in the normal case (so the cases below can fail)", async () => {
        expect((await setUp()).assists()).toBe(1);
    });

    it("not in One Tick tap mode", async () => {
        const t = await setUp();
        t.AttackManager.oneTicker.tapMode = true;
        expect(t.assists()).toBe(0);
    });

    it("not while our turret is reloading", async () => {
        const t = await setUp();
        t.player.reloads[TURRET] = 0.5;
        expect(t.assists()).toBe(0);
    });

    it("not while auto-pushing (unless we're trapped)", async () => {
        const t = await setUp();
        t.AutoPusher.autoPushing = true;
        expect(t.assists()).toBe(0);
        // Trapped ourselves, the push doesn't stop it (any object: only "are we trapped" matters).
        t.player.trap = t.ObjectManager.getObject(600)!;
        expect(t.assists()).toBe(1);
    });

    it("not while the enemy is still moving", async () => {
        const t = await setUp();
        t.enemy.next_position.x = t.enemy.real_position.x + 10;
        expect(t.assists()).toBe(0);
    });

    it("not when the only spike near the enemy is a teammate's, or no spike is near", async () => {
        const t = await setUp();
        const spike = t.ObjectManager.getObject(700)!;
        spike.ownerSID = ENEMY; // the enemy's own spike doesn't hurt them
        expect(t.assists()).toBe(0);
        spike.ownerSID = ME;
        spike.x = 2000;
        expect(t.assists()).toBe(0);
    });
});

describe("Push strikes: hats and every reason to wait", () => {
    /** Bullspam / Shame Strike run directly with the enemy at `enemyX` (the spike at 1150, us at 1000). */
    async function setUp(weapon: number, enemyX = 1095) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["attackInPush"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: weapon });
        game.spawn({ sid: ENEMY, x: enemyX, y: 1000 });
        game.setLoadout([weapon, 10], [0, 3, 6, 15]);
        game.addObjects([{ sid: 700, x: 1150, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: ME }]);
        game.update();
        game.update();

        const { default: ModManager } = await import("@core/ModManager");
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const { default: PlayerCombatManager } = await import("@core/logic/players/core/PlayerCombatManager");
        const { default: BullspamMethod } = await import("@core/mod/combat/modules/push-strikes/modules/BullspamMethod");
        const { default: ShameStrikeMethod } = await import("@core/mod/combat/modules/push-strikes/modules/ShameStrikeMethod");
        const spike = ObjectManager.getObject(700)!;
        const player = game.Client.player;
        const enemy = ModManager.enemyData.nearest!;
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        const ctx = () => ({ nearestEnemy: enemy, primary: PlayerCombatManager.fetch(player, 0), spike, scale: spike.scale + 35.8, player, tick: ModManager.tick });
        const bullspam = new BullspamMethod();
        bullspam.initialize();
        const shame = new ShameStrikeMethod();
        shame.initialize();
        /** The first step's hat, or null when nothing was queued. */
        const run = (method: { execute(c: never): void }) => {
            queued.mockClear();
            method.execute(ctx() as never);
            return queued.mock.calls[0]?.[0].sequence[0].skinData[0] ?? null;
        };
        return { player, enemy, spike, ObjectManager, bullspam, shame, run };
    }

    it("Bullspam: bull helmet; with daggers, turret gear when the turret is ready, else soldier helmet", async () => {
        let t = await setUp(POLEARM);
        expect(t.run(t.bullspam)).toBe(BULL);
        game!.done();

        t = await setUp(DAGGERS);
        expect(t.run(t.bullspam)).toBe(TURRET);
        t.player.reloads[TURRET] = 0.5;
        expect(t.run(t.bullspam)).toBe(SOLDIER);
    });

    it("Bullspam waits while our primary reloads, or the enemy is over 100 away", async () => {
        const t = await setUp(POLEARM);
        t.player.reloads[POLEARM] = 0.5;
        expect(t.run(t.bullspam)).toBe(null);
        t.player.reloads[POLEARM] = 1;
        t.enemy.real_position.x = 1105; // 105 from us, still touching the spike
        expect(t.run(t.bullspam)).toBe(null);
    });

    it("Bullspam needs the enemy closer to the spike while we're trapped (no 10 padding)", async () => {
        const t = await setUp(POLEARM, 1060);
        // 90 from the spike; the spike reaches 49 + 35.8 = 84.8, plus 10 when we're free.
        expect(t.run(t.bullspam)).toBe(BULL);
        t.player.trap = t.spike; // any object: only "are we trapped" matters
        expect(t.run(t.bullspam)).toBe(null);
    });

    it("Shame Strike waits while our primary or turret reloads, the enemy is over 100 away, or not at the spike", async () => {
        const t = await setUp(DAGGERS);
        t.enemy.shameCount = 7;
        expect(t.run(t.shame)).toBe(TURRET); // the normal case

        t.player.reloads[DAGGERS] = 0.5;
        expect(t.run(t.shame)).toBe(null);
        t.player.reloads[DAGGERS] = 1;

        t.player.reloads[TURRET] = 0.5;
        expect(t.run(t.shame)).toBe(null);
        t.player.reloads[TURRET] = 1;

        t.enemy.real_position.x = 1105;
        expect(t.run(t.shame)).toBe(null);

        t.enemy.real_position.x = t.enemy.next_position.x = 1040; // 110 from the spike, not heading into it
        expect(t.run(t.shame)).toBe(null);
    });
});

describe("Hat System over whole ticks", () => {
    /** A game where the server echoes our last equip on the next update, like a real one under ~110 ms ping. */
    async function echoGame(enable?: string[]) {
        game = await startGame({ enable });
        game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: POLEARM });
        game.spawn({ sid: ENEMY, x: 12000, y: 12000 });
        game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
        const player = game.Client.player;
        let hat = 0, acc = 0;
        const equips: [number, boolean][] = [];
        const tick = () => {
            game!.update([{ sid: ME, skinIndex: hat, tailIndex: acc }]);
            for (const p of game!.sentInLast(1)) {
                if (p.type !== "c" || p.args[0] !== false) continue;
                const id = p.args[1] as number, isAcc = p.args[2] as boolean;
                equips.push([id, isAcc]);
                if (isAcc) acc = id; else hat = id;
            }
        };
        return { player, equips, tick, Client: game.Client };
    }

    it("a steady situation sends each item once and never swaps back", async () => {
        const g = await echoGame();
        for (const id of [6, 7, 12, 40, 53]) g.player.skins[id] = true;
        g.Client.lastMoveDir = 0; // moving: booster hat and monkey tail
        for (let i = 0; i < 8; i++) g.tick();
        expect(g.equips).toEqual([[12, false], [11, true]]);
    });

    it("danger + an attack + healing in one tick: the forced soldier helmet wins and the heal still happens", async () => {
        const g = await echoGame(["autoHeal"]);
        g.tick();
        g.player.skins[SOLDIER] = true;
        const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
        const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
        const { default: AutoHealer } = await import("@core/mod/defense/defense-modules/AutoHealer");
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const { tickState } = await import("@core/TickState");
        const place = vi.spyOn((await import("@core/mod/combat/core/PlacementSystem")).default, "place").mockImplementation(() => true as never);

        // An attack wants the bull helmet this tick, a hit could kill us, and the defense forces soldier.
        (AttackManager as unknown as { _currentAttackAction: unknown })._currentAttackAction = { skinData: [BULL, false], noAttack: true, wpnId: POLEARM };
        DefenseSystem.alreadyHealed = false;
        DefenseSystem.skinIndex = SOLDIER;
        g.player.health = 40;
        AutoHealer.main({ ...DefenseSystem.state, totalDamage: 60 } as never);

        expect((HatSystem as unknown as { fetchBestHat(): number }).fetchBestHat()).toBe(SOLDIER);
        expect(tickState.brainState.healingResponse).toBe("instant soldier + heal");
        expect(place).toHaveBeenCalled();
    });
});
