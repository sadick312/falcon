// Feature #9, Auto Push Strikes (AutoPushStriker + push-strikes/): attacks while Auto Push drives the enemy into a
// spike. Daggers: Shame Strike (turret gear hit once the enemy is near Shame) or Bullspam; polearm/katana: Predictive
// (bull hit timed with the enemy's learned tank-gear habit) or Bullspam; other weapons: Bullspam.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

interface Scenario {
    enable?: boolean;
    weapons?: number[];
    settings?: Record<string, unknown>;
    /** Enemy x on the last two ticks (default 1095: touching the spike at 1150, within 100 of us). Spikes hit within 49 + 35.8. */
    enemyPath?: [number, number];
}

/** Sets the scene, makes the spike Auto Push's current target, runs the module once; returns the queued attacks. */
async function strike(s: Scenario = {}, before?: (ctx: { enemy: import("@entities/Player").default; tick: number }) => void | Promise<void>) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["attackInPush"], settings: s.settings });
    const [prevX, enemyX] = s.enemyPath ?? [1095, 1095];
    const weapons = s.weapons ?? [5, 10];
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: weapons[0] });
    game.spawn({ sid: 2, x: prevX, y: 1000 });
    game.setLoadout(weapons, [0, 3, 6, 15]);
    game.addObjects([{ sid: 700, x: 1150, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: ME }]);
    game.update([{ sid: 2, x: prevX }]);
    game.update([{ sid: 2, x: enemyX }]);

    const { default: ModManager } = await import("@core/ModManager");
    const { default: ObjectManager } = await import("@core/logic/ObjectManager");
    const { default: AutoPusher } = await import("@core/mod/combat/core/AutoPusher");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: AutoPushStriker } = await import("@combat-modules/AutoPushStriker");

    AutoPusher.theSpike = ObjectManager.getObject(700)!;
    await before?.({ enemy: ModManager.enemyData.nearest!, tick: ModManager.tick });
    const module = new AutoPushStriker();
    module.init();
    const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
    module.run();
    return queued.mock.calls.map(([queue]) => queue.sequence[0]);
}

const BULLSPAM = { "attackInPush:polearm_katana_method": 1 };

describe("Auto Push Strikes: Bullspam", () => {
    it("bull-hits when the pushed enemy touches the spike", async () => {
        const hits = await strike({ settings: BULLSPAM });
        expect(hits.map(h => h.reason)).toEqual(["spikeStrikes"]);
    });

    it("waits while the enemy is still away from the spike", async () => {
        expect(await strike({ settings: BULLSPAM, enemyPath: [1040, 1040] })).toEqual([]);
    });

    it("does nothing when the method is Disabled, or the toggle is off", async () => {
        expect(await strike({ settings: { "attackInPush:polearm_katana_method": 2 } })).toEqual([]);
        expect(await strike({ settings: BULLSPAM, enable: false })).toEqual([]);
    });
});

describe("Auto Push Strikes: waiting for other attacks", () => {
    it("doesn't cut off an attack already in progress", async () => {
        // Mid-way through a 2-step combo: the next step is still to come. (Imported here: startGame reloads modules.)
        expect(await strike({ settings: BULLSPAM }, async () => {
            const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
            vi.spyOn(AttackManager, "isAttacking").mockReturnValue(true);
        })).toEqual([]);
    });

    it("doesn't replace a hat defense chose", async () => {
        expect(await strike({ settings: BULLSPAM }, async () => {
            const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
            vi.spyOn(HatSystem, "allowHatSwitch").mockReturnValue(false);
        })).toEqual([]);
    });
});

describe("Auto Push Strikes: Shame Strike (daggers)", () => {
    const DAGGERS = [7, 10];

    it("hits with turret gear once the enemy's shame count reaches the threshold", async () => {
        const hits = await strike({ weapons: DAGGERS }, ({ enemy }) => { enemy.shameCount = 4; });
        expect(hits.map(h => h.reason)).toEqual(["daggerSpikeHit"]);
    });

    it("also fires a tick early, when the enemy is about to reach the spike", async () => {
        // 90 away from the spike now (not touching), moving 15 per tick toward it. Before the fix, "will hit" used
        // the current position too, so this waited a tick.
        const hits = await strike({ weapons: DAGGERS, enemyPath: [1045, 1060] }, ({ enemy }) => { enemy.shameCount = 4; });
        expect(hits.map(h => h.reason)).toEqual(["daggerSpikeHit"]);
    });

    it("waits below the shame threshold, and never hits an enemy wearing Shame", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        expect(await strike({ weapons: DAGGERS }, ({ enemy }) => { enemy.shameCount = 2; })).toEqual([]);
        expect(await strike({ weapons: DAGGERS }, ({ enemy }) => {
            enemy.shameCount = 4;
            enemy.skinIndex = STORE_HAT_MAP.SHAME;
        })).toEqual([]);
    });
});

describe("Auto Push Strikes: Predictive (polearm)", () => {
    it("waits without any learned tank-gear timing for this enemy", async () => {
        expect(await strike({}, ({ enemy }) => { enemy.profilingData.tankUseHits[0] = [0, 0, 0, 0, 0, 0, 0, 0, 0]; })).toEqual([]);
    });

    it("bull-hits one tick before the enemy usually switches to tank gear", async () => {
        const hits = await strike({}, ({ enemy, tick }) => {
            // The enemy (holding weapon 0) mostly used tank gear 3 ticks after reloading; it reloaded 2 ticks ago.
            enemy.profilingData.tankUseHits[0] = [0, 0, 0, 5, 0, 0, 0, 0, 0];
            enemy.weaponData.lastTickSincePrimaryReloaded = tick - 2;
        });
        expect(hits.map(h => h.reason)).toEqual(["predictiveSpikeStrikes"]);
    });
});

describe("Auto Push Strikes: Predictive, learning the enemy's tank-gear timing", () => {
    const KATANA = 4;
    const POLEARM = 5;

    /**
     * The Predictive method on its own, with the enemy touching Auto Push's spike (as in strike()). Default: katana and
     * spinning spikes, so a bull hit + the spike can kill (40 × 1.5 + 45 >= 100); a polearm with plain spikes can't.
     */
    async function predictive(opts: { enemyX?: number; spike?: boolean; weak?: boolean } = {}) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({ enable: ["attackInPush"] });
        const primaryId = opts.weak ? POLEARM : KATANA;
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: primaryId });
        game.spawn({ sid: 2, x: opts.enemyX ?? 1095, y: 1000 });
        game.setLoadout([primaryId, 10], [0, 3, 6, 15]);
        game.addObjects([{ sid: 700, x: 1150, y: 1000, itemId: opts.weak ? LIST_ID_MAP.SPIKES : LIST_ID_MAP.SPINNING_SPIKES, owner: ME }]);
        game.update();
        game.update();

        const { default: ModManager } = await import("@core/ModManager");
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        const { default: AutoPusher } = await import("@core/mod/combat/core/AutoPusher");
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const { default: GameEventTracker } = await import("@core/mod/utils/GameEventTracker");
        const { default: PlayerCombatManager } = await import("@core/logic/players/core/PlayerCombatManager");
        const { default: PredictiveMethod } = await import("@core/mod/combat/modules/push-strikes/modules/PredictiveMethod");

        const spike = ObjectManager.getObject(700)!;
        AutoPusher.theSpike = opts.spike === false ? undefined as never : spike;
        const method = new PredictiveMethod();
        method.initialize();
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        const enemy = ModManager.enemyData.nearest!;
        const player = game.Client.player;
        const ctx = () => ({ nearestEnemy: enemy, primary: PlayerCombatManager.fetch(player, 0), spike, scale: spike.scale + 35.8, player, tick: ModManager.tick });
        return { method, enemy, ModManager, GameEventTracker, queued, ctx, player, primaryId };
    }

    it("counts the tick (since reload) at which a tank-gear enemy swung", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        const t = await predictive();
        vi.spyOn(t.GameEventTracker, "confirm").mockReturnValue(true);
        t.enemy.skinIndex = STORE_HAT_MAP.TANK_GEAR;
        t.enemy.profilingData.tankUseHits[0] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        t.enemy.weaponData.lastTickSincePrimaryReloaded = t.ModManager.tick - 4;

        t.method.update();
        expect(t.enemy.profilingData.tankUseHits[0]).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    });

    it("ignores a swing more ticks after the reload than it keeps slots for", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        const t = await predictive();
        vi.spyOn(t.GameEventTracker, "confirm").mockReturnValue(true);
        t.enemy.skinIndex = STORE_HAT_MAP.TANK_GEAR;
        t.enemy.profilingData.tankUseHits[0] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        t.enemy.weaponData.lastTickSincePrimaryReloaded = t.ModManager.tick - 20;

        t.method.update();
        expect(t.enemy.profilingData.tankUseHits[0]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("learns nothing when the enemy isn't in tank gear, or didn't swing", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        const t = await predictive();
        const confirm = vi.spyOn(t.GameEventTracker, "confirm").mockReturnValue(false);
        t.enemy.skinIndex = STORE_HAT_MAP.TANK_GEAR;
        t.enemy.profilingData.tankUseHits[0] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        t.enemy.weaponData.lastTickSincePrimaryReloaded = t.ModManager.tick - 4;
        t.method.update();

        confirm.mockReturnValue(true);
        t.enemy.skinIndex = STORE_HAT_MAP.BULL_HELMET;
        t.method.update();
        expect(t.enemy.profilingData.tankUseHits[0]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("learns only while the enemy is at the spike, our primary is ready, and hit + spike can kill", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        let t = await predictive({ enemyX: 1300 });
        const track = vi.spyOn(t.GameEventTracker, "track");
        t.enemy.skinIndex = STORE_HAT_MAP.TANK_GEAR;
        t.method.update();
        expect(track).not.toHaveBeenCalled();
        game!.done();

        t = await predictive();
        const track2 = vi.spyOn(t.GameEventTracker, "track");
        t.player.reloads[t.primaryId] = 0.5;
        t.method.update();
        expect(track2).not.toHaveBeenCalled();
        game!.done();

        t = await predictive({ spike: false });
        const track3 = vi.spyOn(t.GameEventTracker, "track");
        t.method.update();
        expect(track3).not.toHaveBeenCalled();
        game!.done();

        t = await predictive({ weak: true });
        const track4 = vi.spyOn(t.GameEventTracker, "track");
        t.method.update();
        expect(track4).not.toHaveBeenCalled();
        game!.done();

        // And the normal case does look (so the checks above can fail).
        t = await predictive();
        const track5 = vi.spyOn(t.GameEventTracker, "track");
        t.method.update();
        expect(track5).toHaveBeenCalled();
    });

    it("after a strike: a slot loses a point if the enemy is still there, gains one if it's gone", async () => {
        let t = await predictive();
        t.enemy.profilingData.tankUseHits[0] = [0, 0, 0, 5, 0, 0, 0, 0, 0];
        t.enemy.weaponData.lastTickSincePrimaryReloaded = t.ModManager.tick - 2;
        t.method.execute(t.ctx() as never);
        expect(t.queued).toHaveBeenCalledTimes(1);
        t.method.update();
        expect(t.enemy.profilingData.tankUseHits[0][3]).toBe(4);
        game!.done();

        t = await predictive();
        t.enemy.profilingData.tankUseHits[0] = [0, 0, 0, 5, 0, 0, 0, 0, 0];
        t.enemy.weaponData.lastTickSincePrimaryReloaded = t.ModManager.tick - 2;
        t.method.execute(t.ctx() as never);
        t.enemy.visible = false;
        t.method.update();
        expect(t.enemy.profilingData.tankUseHits[0][3]).toBe(6);
    });

    it("doesn't strike at the wrong tick, with the primary reloading, or away from the spike", async () => {
        let t = await predictive();
        t.enemy.profilingData.tankUseHits[0] = [0, 0, 0, 5, 0, 0, 0, 0, 0];
        t.enemy.weaponData.lastTickSincePrimaryReloaded = t.ModManager.tick - 1;
        t.method.execute(t.ctx() as never);
        expect(t.queued).not.toHaveBeenCalled();

        t.enemy.weaponData.lastTickSincePrimaryReloaded = t.ModManager.tick - 2;
        t.player.reloads[t.primaryId] = 0.5;
        t.method.execute(t.ctx() as never);
        expect(t.queued).not.toHaveBeenCalled();
        game!.done();

        t = await predictive({ enemyX: 1300 });
        t.enemy.profilingData.tankUseHits[0] = [0, 0, 0, 5, 0, 0, 0, 0, 0];
        t.enemy.weaponData.lastTickSincePrimaryReloaded = t.ModManager.tick - 2;
        t.method.execute(t.ctx() as never);
        expect(t.queued).not.toHaveBeenCalled();
    });

    it("clears negative slots while looking for the most used one", async () => {
        const t = await predictive();
        t.enemy.profilingData.tankUseHits[0] = [-3, 0, 0, 5, -1, 0, 0, 0, 0];
        t.enemy.weaponData.lastTickSincePrimaryReloaded = t.ModManager.tick - 2;
        t.method.execute(t.ctx() as never);
        expect(t.enemy.profilingData.tankUseHits[0]).toEqual([0, 0, 0, 5, 0, 0, 0, 0, 0]);
        expect(t.queued).toHaveBeenCalledTimes(1);
    });
});
