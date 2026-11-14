// Phase 3B part 3: Aim Assist. Picks only inside a cone around the mouse (never wider than 60°), leads ranged shots.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";
import { halfCone, inCone, MAX_FOV_DEG, pickTarget, predictHit, type AimCandidate } from "@core/mod/combat/modules/AimAssist";

let game: Game | undefined;
afterEach(() => {
    game?.done();
    game = undefined;
    vi.restoreAllMocks();
});

const TICK = 1000 / 9;
const DEG = Math.PI / 180;

function enemy(sid: number, x: number, y: number, health = 100, last?: { x: number; y: number }, trap?: boolean): AimCandidate {
    return { sid, health, real_position: { x, y }, last_position: last ?? { x, y }, trap: trap ? {} : undefined };
}

describe("the cone", () => {
    it("is never wider than 60° in all, whatever the slider says", () => {
        expect(MAX_FOV_DEG).toBe(60);
        expect(halfCone(40)).toBeCloseTo(20 * DEG);
        expect(halfCone(360)).toBeCloseTo(30 * DEG);
    });

    it("keeps only living enemies inside the cone and within the max distance", () => {
        const me = { x: 0, y: 0 };
        const list = [
            enemy(1, 300, 0),               // straight ahead: in
            enemy(2, 300, 300),             // 45° off: out of a 40° cone
            enemy(3, -300, 0),              // behind: out
            enemy(4, 900, 0),               // too far
            enemy(5, 200, 30, 0),           // dead
            enemy(6, 250, 60)               // about 13.5° off: in
        ];
        expect(inCone(me, 0, halfCone(40), 700, list).map(p => p.sid)).toEqual([1, 6]);
    });

    it("never picks an enemy behind us, even when it is the only one", () => {
        expect(inCone({ x: 0, y: 0 }, 0, halfCone(60), 1400, [enemy(1, -100, 0)])).toEqual([]);
    });
});

describe("picking", () => {
    const me = { x: 0, y: 0 };
    const near = enemy(1, 200, 40, 100);
    const weak = enemy(2, 400, 0, 20);
    const onMouse = enemy(3, 300, 0, 80);

    it("nearest", () => expect(pickTarget(me, 0, 0, [near, weak, onMouse])?.sid).toBe(1));
    it("lowest health", () => expect(pickTarget(me, 0, 1, [near, weak, onMouse])?.sid).toBe(2));
    it("closest to the mouse (ties go to the closer one)", () => expect(pickTarget(me, 0, 2, [near, weak, onMouse])?.sid).toBe(3));
    it("nothing to pick", () => expect(pickTarget(me, 0, 0, [])).toBeNull());
});

describe("ranged prediction", () => {
    it("a standing enemy: aim at it", () => {
        expect(predictHit({ x: 0, y: 0 }, enemy(1, 500, 0), 3.6)).toEqual({ x: 500, y: 0 });
    });

    it("an enemy that just came back into view (a jump of over 100 in one tick): no lead, not a huge one", () => {
        // last_position is only updated while the enemy is in view, so it can be far out of date.
        expect(predictHit({ x: 0, y: 0 }, enemy(1, 500, 0, 100, { x: 500, y: -400 }), 3.6)).toEqual({ x: 500, y: 0 });
    });

    it("an enemy back in view with the one-tick delay (the game's call): still no lead", () => {
        expect(predictHit({ x: 0, y: 0 }, enemy(1, 500, 0, 100, { x: 500, y: -400 }), 3.6, undefined, TICK)).toEqual({ x: 500, y: 0 });
    });

    it("a trapped enemy doesn't move, so no lead", () => {
        expect(predictHit({ x: 0, y: 0 }, enemy(1, 500, 0, 100, { x: 500, y: -40 }, true), 3.6)).toEqual({ x: 500, y: 0 });
    });

    for (const [name, speed] of [["musket", 3.6], ["crossbow", 2.5]] as const) {
        it(`${name}: a shot along the aim meets an enemy running sideways (within 5 px)`, () => {
            const from = { x: 0, y: 0 };
            // Moved 40 px down last tick: 0.36 px per ms.
            const target = enemy(1, 500, 0, 100, { x: 500, y: -40 });
            const aim = predictHit(from, target, speed);
            const dir = Math.atan2(aim.y, aim.x);
            const vy = 40 / TICK;

            // Fly the shot (starting 70 px in front) and the enemy step by step; find the closest they get.
            let closest = Infinity;
            for (let t = 0; t < 400; t += 0.5) {
                const sx = Math.cos(dir) * (70 + speed * t);
                const sy = Math.sin(dir) * (70 + speed * t);
                closest = Math.min(closest, Math.hypot(sx - 500, sy - vy * t));
            }
            expect(closest).toBeLessThan(5);
            // Aiming straight at it would miss by far more.
            expect(aim.y).toBeGreaterThan(30);
        });

        it(`${name}: with the one tick before the shot leaves, it still meets the enemy (within 5 px)`, () => {
            const from = { x: 0, y: 0 };
            const target = enemy(1, 500, 0, 100, { x: 500, y: -40 });
            const aim = predictHit(from, target, speed, undefined, TICK);
            const dir = Math.atan2(aim.y, aim.x);
            const vy = 40 / TICK;

            // The server fires the shot one tick after the position we saw; the enemy keeps running meanwhile.
            let closest = Infinity;
            for (let t = 0; t < 400; t += 0.5) {
                const sx = Math.cos(dir) * (70 + speed * t);
                const sy = Math.sin(dir) * (70 + speed * t);
                closest = Math.min(closest, Math.hypot(sx - 500, sy - vy * (TICK + t)));
            }
            expect(closest).toBeLessThan(5);
            // The lead without the tick misses this by about a tick of running (40 px).
            const noDelay = predictHit(from, target, speed);
            expect(aim.y - noDelay.y).toBeGreaterThan(35);
        });
    }
});

describe("in the game", () => {
    const POLEARM = 5;
    const MUSKET = 15;

    async function setup(enable: string[], mouseDir: number, enemies: [number, number, number][]) {
        game = await startGame({ enable });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.setLoadout([POLEARM, MUSKET], [0, 3, 6, 10, 15]);
        for (const [sid, x, y] of enemies) game.spawn({ sid, x, y, weaponIndex: POLEARM });
        game.update();
        const { Input } = await import("@ui/Input");
        vi.spyOn(Input, "getAttackDir").mockReturnValue(mouseDir);
        const { default: ModManager } = await import("@core/ModManager");
        const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
        const { default: AimAssist } = await import("@core/mod/combat/modules/AimAssist");
        CombatController.tankSpam = true;
        return { ModManager, CombatController, AimAssist };
    }

    it("Lead Falcon's Ranged Shots: off (default), or with a melee weapon, Falcon's own shot aim is unchanged", async () => {
        const { CombatController, AimAssist } = await setup(["aimAssist"], 0, [[2, 1300, 1000]]);
        CombatController.tankSpam = false;
        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        const target = PlayerManager.get(2)!;
        expect(AimAssist.leadOwnShot(0.123, target)).toBe(0.123); // option off
        game!.done();
        const second = await setup(["aimAssist", "aimAssist:leadOwnShots"], 0, [[2, 1300, 1000]]);
        second.CombatController.tankSpam = false;
        const { default: PM2 } = await import("@core/logic/players/PlayerManager");
        expect(second.AimAssist.leadOwnShot(0.123, PM2.get(2)!)).toBe(0.123); // holding a polearm (melee)
    });

    it("Lead Falcon's Ranged Shots: leads for the attack's weapon (musket) even while the polearm is still held", async () => {
        const { CombatController, AimAssist } = await setup(["aimAssist", "aimAssist:leadOwnShots"], 0, [[2, 1300, 1000]]);
        CombatController.tankSpam = false;
        // The enemy runs down (+y) 40 px a tick.
        game!.update([{ sid: 2, x: 1300, y: 1040 }]);
        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        const target = PlayerManager.get(2)!;
        const plain = Math.atan2(40, 300);
        // Holding the polearm, as when the combo switches to the musket in the same tick as the shot.
        expect(AimAssist.leadOwnShot(plain, target)).toBe(plain);
        expect(AimAssist.leadOwnShot(plain, target, MUSKET)).toBeGreaterThan(plain + 0.01);
        expect(AimAssist.leadOwnShot(plain, target, POLEARM)).toBe(plain);
    });

    it("lock-on ends when the locked enemy leaves the cone (it doesn't jump to another one still showing 'locked')", async () => {
        const { ModManager, CombatController, AimAssist } = await setup(["aimAssist"], 0, [[2, 1300, 1000], [3, 1400, 1050]]);
        try {
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(2);
            AimAssist.toggleLock();
            expect(AimAssist.locked).toBe(true);
            // The locked enemy runs behind us; another one is still in the cone.
            game!.update([{ sid: 2, x: 700, y: 1000 }]);
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(3);
            expect(AimAssist.locked).toBe(false);
        } finally {
            CombatController.tankSpam = false;
            AimAssist.locked = false;
        }
    });

    it("the marker goes away once we stop hitting by hand (no stale target)", async () => {
        const { ModManager, CombatController, AimAssist } = await setup(["aimAssist"], 0, [[2, 1300, 1000]]);
        ModManager.getAttackDir(true);
        expect(AimAssist.activeTarget()?.sid).toBe(2);
        CombatController.tankSpam = false;
        game!.update();
        game!.update();
        expect(AimAssist.activeTarget()).toBeNull();
    });

    it("off (default): tank spam aims at the mouse, as before", async () => {
        const { ModManager, CombatController } = await setup([], 0.2, [[2, 1300, 1000]]);
        try {
            expect(ModManager.getAttackDir(true)).toBe(0.2);
        } finally {
            CombatController.tankSpam = false;
        }
    });

    it("on: tank spam turns to the enemy inside the cone", async () => {
        const { ModManager, CombatController } = await setup(["aimAssist"], 0.2, [[2, 1300, 1000]]);
        try {
            expect(ModManager.getAttackDir(true)).toBeCloseTo(0);
        } finally {
            CombatController.tankSpam = false;
        }
    });

    it("on: an enemy behind us is ignored; the mouse direction stays", async () => {
        const { ModManager, CombatController } = await setup(["aimAssist"], 0, [[2, 700, 1000]]);
        try {
            expect(ModManager.getAttackDir(true)).toBe(0);
        } finally {
            CombatController.tankSpam = false;
        }
    });

    it("J's pick stays on the next ticks without L (it went straight back to the nearest)", async () => {
        const { ModManager, CombatController, AimAssist } = await setup(["aimAssist"], 0, [[2, 1400, 1000], [3, 1300, 1030]]);
        try {
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(3);
            AimAssist.requestSwitch();
            game!.update();
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(2);
            game!.update();
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(2);
            expect(AimAssist.locked).toBe(false);
            // Once it leaves the cone, the normal pick takes over again.
            game!.update([{ sid: 2, x: 700, y: 1000 }]);
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(3);
            game!.update([{ sid: 2, x: 1400, y: 1000 }]);
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(3);
        } finally {
            CombatController.tankSpam = false;
        }
    });

    it("on: lock-on keeps the target over a nearer one; J switches", async () => {
        const { ModManager, CombatController, AimAssist } = await setup(["aimAssist"], 0, [[2, 1400, 1000], [3, 1300, 1030]]);
        try {
            // "Nearest" picks sid 3; J switches to sid 2 (farther); L locks it, so it stays though 3 is nearer.
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(3);
            AimAssist.requestSwitch();
            game!.update();
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(2);
            AimAssist.toggleLock();
            expect(AimAssist.locked).toBe(true);
            game!.update();
            expect(ModManager.getAttackDir(true)).toBeCloseTo(0);
            expect(AimAssist.target?.sid).toBe(2);
            // Unlocked, the nearest one is picked again.
            AimAssist.toggleLock();
            game!.update();
            ModManager.getAttackDir(true);
            expect(AimAssist.target?.sid).toBe(3);
        } finally {
            CombatController.tankSpam = false;
            AimAssist.locked = false;
        }
    });
});
