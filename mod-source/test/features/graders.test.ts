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
