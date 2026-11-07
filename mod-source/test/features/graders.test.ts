// Feature #23, Graders (Grader, SpikeGrader, TrapGrader): score each candidate spot from the Angle Finder against each
// nearby enemy. Spikes: near enemy traps, facing the enemy, next to the enemy's trap (for Auto Push), and a physics
// simulation of the spike's hit (knockback into other spikes, kills, pit traps). Traps: facing the enemy, enemy not
// trapped yet, enemy close or able to place there. Spots we placed at recently, or that would block our movement, lose.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

/** Us at (1000, 1000), the enemy 120 to our right (or `enemyX`). */
async function setUp(enemyX = 1120) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: enemyX, y: 1000 });
    game.setLoadout([5, 10], [0, 3, 6, 10, 15]);
    game.update();
    game.update();

    const { default: Angle } = await import("@placing/Angle");
    const { default: AngleGrader } = await import("@placing/AngleGrader");
    const { default: ModManager } = await import("@core/ModManager");
    const { LIST_ID_MAP, default: items } = await import("@constants/items");
    const graders = AngleGrader as unknown as { spikeGrader: Grader; trapGrader: Grader };
    const enemy = ModManager.enemyData.nearest!;

    /** A spot `distance` from us at `angle`, graded against the enemy. */
    function grade(id: number, angle: number, setUp?: (spot: InstanceType<typeof Angle>) => void) {
        const offset = 35 + items.list[id].scale;
        const spot = new Angle(1000 + Math.cos(angle) * offset, 1000 + Math.sin(angle) * offset, items.list[id].scale, angle, id);
        setUp?.(spot);
        const grader = spot.isTrap ? graders.trapGrader : graders.spikeGrader;
        grader.prepare(spot, [enemy], false);
        grader.grade(spot, enemy);
        return { spot, grader };
    }

    return { grade, graders, enemy, LIST_ID_MAP };
}

interface Grader {
    prepare(spot: unknown, enemies: unknown[], allowPreplace: boolean): void;
    grade(spot: unknown, enemy: unknown): void;
    internalCache: { canAbuse: boolean };
}

describe("Graders", () => {
    it("prefer spots facing the enemy", async () => {
        const { grade, LIST_ID_MAP } = await setUp();
        expect(grade(LIST_ID_MAP.PIT_TRAP, 0).spot.grade).toBeGreaterThan(grade(LIST_ID_MAP.PIT_TRAP, Math.PI).spot.grade);
        expect(grade(LIST_ID_MAP.SPIKES, 0).spot.grade).toBeGreaterThan(grade(LIST_ID_MAP.SPIKES, Math.PI).spot.grade);
    });

    it("rule out a spot we placed at in the last 18 ticks", async () => {
        const { grade, LIST_ID_MAP } = await setUp();
        const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
        const { default: ModManager } = await import("@core/ModManager");
        PlacementSystem.usedAngles[0].angle = 0.05;
        PlacementSystem.usedAngles[0].tick = ModManager.tick;
        PlacementSystem.usedAnglesCount = 1;
        expect(grade(LIST_ID_MAP.PIT_TRAP, 0).spot.dontUse).toBe(true);
        expect(grade(LIST_ID_MAP.PIT_TRAP, 1).spot.dontUse).toBe(false);
        PlacementSystem.usedAnglesCount = 0;
    });

    it("give traps within the enemy's place reach a bonus: +1, or +.5 when the enemy can't place there (P14)", async () => {
        // The trap spot is about 35 from the enemy, well inside its place reach. TrapGrader used to compare the
        // squared distance with the plain reach, so the bonus never applied (both grades came out equal).
        const { grade, enemy, LIST_ID_MAP } = await setUp();
        const { spot, grader } = grade(LIST_ID_MAP.PIT_TRAP, 0);
        const regrade = (canAbuse: boolean) => {
            spot.grade = 0;
            grader.internalCache.canAbuse = canAbuse;
            grader.grade(spot, enemy);
            return spot.grade;
        };
        expect(regrade(true) - regrade(false)).toBeCloseTo(0.5);
    });

    it("count the spike-tick hit's damage in the spike simulation (P15)", async () => {
        // Enemy close enough for the spike to hit it.
        const { grade, LIST_ID_MAP } = await setUp(1100);
        const { default: MovementPhysicsSimulator } = await import("@core/mod/simulation/MovementPhysicsSimulator");
        const damageSkipped: boolean[] = [];
        const simulate = MovementPhysicsSimulator.simulate.bind(MovementPhysicsSimulator);
        vi.spyOn(MovementPhysicsSimulator, "simulate").mockImplementation((state, actions, ...rest) => {
            const damage = actions[0]?.[1];
            if (damage?.type === "damage") damageSkipped.push(!!damage.dontUse);
            return simulate(state, actions, ...rest);
        });
        grade(LIST_ID_MAP.SPIKES, 0, spot => { spot.spikeTick = true; });
        expect(damageSkipped.length).toBeGreaterThan(0);
        // The hit's damage step used to stay switched off.
        expect(damageSkipped.some(Boolean)).toBe(false);
    });
});

describe("Spike Grader: more cases (B6)", () => {
    /** A spike spot straight at the enemy (100 to our right, inside the spike's hit range), with optional extras. */
    async function spike(opts: {
        objects?: { sid: number; x: number; y: number; itemId: keyof typeof import("@constants/items").LIST_ID_MAP; owner?: number }[];
        moveDir?: number | null;
        order?: number[];
        fakeTick?: boolean;
        spikeTick?: boolean;
        clowned?: boolean;
        weapons?: number[];
    } = {}) {
        const { LIST_ID_MAP, default: items } = await import("@constants/items");
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: (opts.weapons ?? [5, 10])[0] });
        game.spawn({ sid: 2, x: 1100, y: 1000 });
        game.setLoadout(opts.weapons ?? [5, 10], [0, 3, 6, 10, 15]);
        game.addObjects((opts.objects ?? []).map(o => ({ sid: o.sid, x: o.x, y: o.y, itemId: LIST_ID_MAP[o.itemId], owner: o.owner ?? ME })));
        game.update([], opts.order);
        game.update(opts.clowned ? [{ sid: 2, skinIndex: 45 }] : [], opts.order);

        const { default: Angle } = await import("@placing/Angle");
        const { default: AngleGrader } = await import("@placing/AngleGrader");
        const { default: ModManager } = await import("@core/ModManager");
        const { default: PlayerStateManager } = await import("@core/logic/players/core/PlayerStateManager");
        const { default: MovementPhysicsSimulator } = await import("@core/mod/simulation/MovementPhysicsSimulator");
        const grader = (AngleGrader as unknown as { spikeGrader: Grader }).spikeGrader;
        const enemy = ModManager.enemyData.nearest!;
        game.Client.lastMoveDir = opts.moveDir ?? null;
        if (opts.fakeTick) PlayerStateManager.placementMap.clear();

        const kb: { same: boolean; next: boolean; damage: boolean }[] = [];
        const simulate = MovementPhysicsSimulator.simulate.bind(MovementPhysicsSimulator);
        vi.spyOn(MovementPhysicsSimulator, "simulate").mockImplementation((state, actions, ...rest) => {
            const first = actions[0] as { dontUse?: boolean }[];
            const second = actions[1] as { dontUse?: boolean }[] | undefined;
            if (first?.[1] && first[2]) kb.push({ damage: !first[1].dontUse, same: !first[2].dontUse, next: !!second && !second[0].dontUse });
            return simulate(state, actions, ...rest);
        });

        const scale = items.list[LIST_ID_MAP.SPIKES].scale;
        const spot = new Angle(1000 + 35 + scale, 1000, scale, 0, LIST_ID_MAP.SPIKES);
        spot.spikeTick = !!opts.spikeTick;
        grader.prepare(spot, [enemy], false);
        grader.grade(spot, enemy);
        return { spot, kb, enemy };
    }

    it("marks down a spot our own next step would run into", async () => {
        const still = (await spike()).spot.grade;
        game!.done();
        const walking = (await spike({ moveDir: 0 })).spot.grade;
        expect(still - walking).toBeCloseTo(2.5, 5);
    });

    it("times a spike tick's knockback by the update order", async () => {
        const first = (await spike({ spikeTick: true, order: [ME, 2] })).kb[0];
        expect(first).toEqual({ damage: true, same: true, next: false });
        game!.done();
        const second = (await spike({ spikeTick: true, order: [2, ME] })).kb[0];
        expect(second).toEqual({ damage: true, same: false, next: true });
    });

    it("leaves the spike tick's hit out on a fake tick (unknown update order)", async () => {
        const { kb } = await spike({ spikeTick: true, fakeTick: true });
        expect(kb[0]).toEqual({ damage: false, same: false, next: false });
    });

    it("rates a spike that knocks the enemy into our pit trap higher", async () => {
        const alone = (await spike()).spot.grade;
        game!.done();
        const intoTrap = (await spike({ objects: [{ sid: 801, x: 1170, y: 1000, itemId: "PIT_TRAP" }] })).spot.grade;
        expect(intoTrap).toBeGreaterThan(alone);
    });

    it("never uses a spike that would knock the enemy onto a teleporter", async () => {
        const { spot } = await spike({ objects: [{ sid: 802, x: 1160, y: 1000, itemId: "TELEPORTER" }] });
        expect(spot.dontUse).toBe(true);
    });

    it("counts a pit spike on a trapped enemy, without spike tick or Apple Insta", async () => {
        const { spot, enemy } = await spike({ spikeTick: true, objects: [{ sid: 803, x: 1100, y: 1000, itemId: "PIT_TRAP" }] });
        expect(enemy.trap).toBeTruthy();
        expect(spot.pitSpike.has(2)).toBe(true);
        expect(spot.spikeTick).toBe(false);
        expect(spot.appleInsta).toBe(false);
    });

    it("gives a little extra against a shamed enemy", async () => {
        const normal = (await spike()).spot.grade;
        game!.done();
        const shamed = (await spike({ clowned: true })).spot.grade;
        expect(shamed - normal).toBeCloseTo(0.25, 5);
    });

    it("drops spike-tick plans when our primary can't make them count", async () => {
        // Tool hammer + great hammer: no attack primary, and nothing important about this spot.
        const { spot } = await spike({ spikeTick: true, weapons: [0, 10] });
        expect(spot.spikeTick).toBe(false);
    });
});
