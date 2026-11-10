// Part 3A fixes, both off by default:
//  - "EMP-Aware Instas": in 1.8.2 an EMP Helmet (antiTurret) makes the turret bullet do nothing. Musket Insta and
//    Knockback Instakills counted its 25 anyway, so they could fire an insta that can't kill (a wasted insta).
//  - "Insta Uses Enemy Health": Knockback Instakills' simulation starts every tick at full health, so its two hits
//    never added up and the enemy's current health was ignored: without spikes or a pit trap it never fired. With the
//    setting its total (soldier helmet assumed for the second hit) against the enemy's health counts too.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const HAND_AXE = 1;
const POLEARM = 5;
const MUSKET = 15;
const BULL = 7;
const TURRET_GEAR = 53;
const EMP_HELMET = 22;
const SOLDIER = 6;

describe("EMP-Aware Instas: Musket Insta", () => {
    /** Polearm + musket next to an enemy in `enemyHat` at `enemyHealth`; returns the queued combo or null. */
    async function musket(enemyHat: number, enemyHealth: number, enable: string[]) {
        game = await startGame({ enable: ["musketInsta", ...enable] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.spawn({ sid: 2, x: 1150, y: 1000, weaponIndex: POLEARM, skinIndex: enemyHat });
        game.setLoadout([POLEARM, MUSKET], [0, 3, 6, 10, 15]);
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        let combo: [number, number][] | null = null;
        vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(action => {
            if (action.sequence[0].reason === "musketInsta") combo ??= action.sequence.map(a => [a.wpnId, a.skinData[0]]);
        });
        game.update();
        game.setHealth(2, enemyHealth);
        game.update();
        game.update();
        return combo;
    }

    it("comboDamage: with an EMP Helmet the turret bullet is left out (worst case: the musket shot alone)", async () => {
        game = await startGame();
        const { default: MusketInstakiller } = await import("@combat-modules/MusketInstakiller");
        expect(MusketInstakiller.comboDamage(45, EMP_HELMET)).toBeCloseTo(67.5 + 56.25); // off: as before
        expect(MusketInstakiller.comboDamage(45, EMP_HELMET, true)).toBeCloseTo(67.5 + 50);
        expect(MusketInstakiller.comboDamage(45, 0, true)).toBeCloseTo(67.5 + 56.25); // no EMP: unchanged
    });

    it("off (default): fires at an EMP enemy with 120 health, counting a turret bullet that does nothing", async () => {
        expect(await musket(EMP_HELMET, 120, [])).toEqual([[POLEARM, BULL], [MUSKET, TURRET_GEAR]]);
    });

    it("on: doesn't waste the insta on that EMP enemy (117.5 can't kill 120)", async () => {
        expect(await musket(EMP_HELMET, 120, ["empAwareInstas"])).toBeNull();
    });

    it("on: still fires when the enemy has no EMP Helmet", async () => {
        expect(await musket(0, 120, ["empAwareInstas"])).toEqual([[POLEARM, BULL], [MUSKET, TURRET_GEAR]]);
    });
});

describe("Knockback Instakills", () => {
    /** Plays 4 ticks with `weapons`; returns the combo's [tick, weapon, hat] steps and the turret damage it simulated. */
    async function knockback(opts: { weapons: number[]; enemyHat?: number; enemyHealth?: number; spike?: boolean; enable?: string[] }) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["attackFactoringKB:insta", ...(opts.enable ?? [])] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.spawn({ sid: 2, x: 1100, y: 1000, skinIndex: opts.enemyHat ?? 0 });
        game.setLoadout(opts.weapons, [0, 3, 6, 10]);
        if (opts.spike) game.addObjects([{ sid: 500, x: 1180, y: 1000, itemId: LIST_ID_MAP.GREATER_SPIKES, owner: ME }]);

        const { default: MovementPhysicsSimulator } = await import("@simulation/MovementPhysicsSimulator");
        const turretDamages: number[] = [];
        const totals: number[] = [];
        const simulate = MovementPhysicsSimulator.simulate.bind(MovementPhysicsSimulator);
        vi.spyOn(MovementPhysicsSimulator, "simulate").mockImplementation((state, actions, ...rest) => {
            const steps = actions as { type: string; damage?: number }[][];
            const result = simulate(state, actions as never, ...rest);
            // Knockback Instakills' own simulation has steps of 3, 4 and 2 actions; in the normal order the turret
            // bullet is the second tick's first action.
            if (steps.length === 3 && steps[0]?.length === 3 && steps[1]?.length === 4 && steps[2]?.length === 2) {
                turretDamages.push(steps[1]?.[0]?.damage ?? NaN);
                totals.push(result.totalDamage);
            }
            return result;
        });

        game.update();
        if (opts.enemyHealth !== undefined) game.setHealth(2, opts.enemyHealth);
        for (let i = 0; i < 3; i++) game.update();

        const steps: [number, unknown, unknown][] = [];
        for (const hat of game.sent.filter(p => p.type === "c" && (p.args[1] === BULL || p.args[1] === TURRET_GEAR))) {
            const weapon = game.sent.find(p => p.type === "z" && p.tick === hat.tick);
            steps.push([hat.tick, weapon?.args[0], hat.args[1]]);
        }
        return { steps, turretDamages, totals };
    }

    describe("EMP-Aware Instas", () => {
        it("off (default): simulates the turret bullet's 25 against an EMP enemy", async () => {
            const { turretDamages } = await knockback({ weapons: [POLEARM, MUSKET], enemyHat: EMP_HELMET, spike: true });
            expect(turretDamages.length).toBeGreaterThan(0);
            expect(turretDamages.every(d => d === 25)).toBe(true);
        });

        it("on: simulates 0 turret damage against an EMP enemy, 25 against others", async () => {
            const emp = await knockback({ weapons: [POLEARM, MUSKET], enemyHat: EMP_HELMET, spike: true, enable: ["empAwareInstas"] });
            expect(emp.turretDamages.length).toBeGreaterThan(0);
            expect(emp.turretDamages.every(d => d === 0)).toBe(true);
            game!.done();
            const plain = await knockback({ weapons: [POLEARM, MUSKET], spike: true, enable: ["empAwareInstas"] });
            expect(plain.turretDamages.every(d => d === 25)).toBe(true);
        });
    });

    describe("Insta Uses Enemy Health", () => {
        it("off (default): without a spike or trap it never fires, even at a nearly dead enemy", async () => {
            expect((await knockback({ weapons: [POLEARM, MUSKET], enemyHealth: 30 })).steps).toEqual([]);
        });

        it("on: fires when the two hits reach the enemy's health", async () => {
            const { steps } = await knockback({ weapons: [POLEARM, MUSKET], enemyHealth: 30, enable: ["instaUsesEnemyHealth"] });
            expect(steps.slice(0, 2)).toEqual([[1, POLEARM, BULL], [2, MUSKET, TURRET_GEAR]]);
        });

        it("on: leaves a soldier-helmet enemy at full health alone when the hits can't reach it", async () => {
            // Hand axe + musket on a soldier helmet: 30 x 1.5 x 0.75 + (50 + 25) x 0.75 = 90 < 100.
            const full = await knockback({ weapons: [HAND_AXE, MUSKET], enemyHat: SOLDIER, enable: ["instaUsesEnemyHealth"] });
            expect(full.steps).toEqual([]);
            expect(full.totals.length).toBeGreaterThan(0); // it did consider the insta
            game!.done();
            const hurt = await knockback({ weapons: [HAND_AXE, MUSKET], enemyHat: SOLDIER, enemyHealth: 80, enable: ["instaUsesEnemyHealth"] });
            expect(hurt.steps.length, `simulated totals ${JSON.stringify(hurt.totals)}`).toBeGreaterThan(0);
        });
    });
});
