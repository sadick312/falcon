// How the Hat System sends what it picked (the "classic contract", part 2), and the hat state around it: at most one
// store packet a tick (the hat first), nothing when it's already on, what happens with items we don't own, the bull
// helmet cycle, every insta's hat sequence, and a combo's hat arriving in the same tick as its hit.
// it.fails marks a known weak spot from the Phase 0 audit: the test states the wanted behaviour and fails today. Once
// a fix is approved, it.fails becomes it.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const SOLDIER = 6, BULL = 7, BOOSTER = 12, BARBARIAN = 26, TANK = 40, TURRET = 53;
const MONKEY_TAIL = 11, SHADOW_WINGS = 19;
const POLEARM = 5;
const ENEMY = 2;

async function setup() {
    game = await startGame();
    game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: POLEARM });
    game.spawn({ sid: ENEMY, x: 12000, y: 12000 });
    game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
    game.update();

    const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
    const { tickState } = await import("@core/TickState");
    const hs = HatSystem as unknown as {
        main(): void; storeEquip(id: number, isAccessory: boolean): void; canTick(execute?: boolean): boolean;
        fetchBestHat(): number; fetchBestAccessory(): number;
        needTick: number; sentHatPacket: boolean; stopMoveDuration: number;
    };
    return { HatSystem: hs, tickState, Client: game.Client, player: game.Client.player };
}

/** The store packets (equip only, not buys) sent in the last tick, as [id, isAccessory]. */
function equipsLastTick() {
    return game!.sentInLast(1).filter(p => p.type === "c" && p.args[0] === false).map(p => [p.args[1], p.args[2]]);
}

describe("Hat System sending rules", () => {
    it("sends at most one store packet a tick: the hat first, the accessory on a later tick", async () => {
        const g = await setup();
        g.HatSystem.sentHatPacket = false;
        g.player.skinIndex = 0;
        g.player.tailIndex = 0;
        g.HatSystem.storeEquip(BOOSTER, false);
        g.HatSystem.storeEquip(MONKEY_TAIL, true);
        const sent = game!.sent.filter(p => p.type === "c").slice(-1);
        expect(sent.map(p => p.args)).toEqual([[false, BOOSTER, false]]);

        // Next tick, with the hat on: now the accessory goes.
        g.HatSystem.sentHatPacket = false;
        g.player.skinIndex = BOOSTER;
        g.HatSystem.storeEquip(BOOSTER, false);
        g.HatSystem.storeEquip(MONKEY_TAIL, true);
        expect(game!.sent.filter(p => p.type === "c").slice(-1).map(p => p.args)).toEqual([[false, MONKEY_TAIL, true]]);
    });

    it("in a real tick: puts on booster hat, and monkey tail the tick after", async () => {
        const g = await setup();
        g.Client.lastMoveDir = 0;
        game!.update([{ sid: ME, skinIndex: 0, tailIndex: 0 }]);
        expect(equipsLastTick()).toEqual([[BOOSTER, false]]);
        game!.update([{ sid: ME, skinIndex: BOOSTER, tailIndex: 0 }]);
        expect(equipsLastTick()).toEqual([[MONKEY_TAIL, true]]);
        game!.update([{ sid: ME, skinIndex: BOOSTER, tailIndex: MONKEY_TAIL }]);
        expect(equipsLastTick()).toEqual([]);
    });

    it("sends nothing for an item that's already on", async () => {
        const g = await setup();
        g.player.skinIndex = SOLDIER;
        g.player.tailIndex = SHADOW_WINGS;
        const before = game!.sent.length;
        g.HatSystem.sentHatPacket = false;
        g.HatSystem.storeEquip(SOLDIER, false);
        g.HatSystem.storeEquip(SHADOW_WINGS, true);
        expect(game!.sent.length).toBe(before);
        expect(g.HatSystem.sentHatPacket).toBe(false);
    });

    it("takes the accessory off when the wanted one isn't owned (Monkey Tail cuts our hit damage)", async () => {
        const g = await setup();
        delete g.player.tails[SHADOW_WINGS];
        g.player.tailIndex = MONKEY_TAIL;
        g.HatSystem.sentHatPacket = false;
        g.HatSystem.storeEquip(SHADOW_WINGS, true);
        expect(game!.sent.at(-1)?.args).toEqual([false, 0, true]);
    });

    it("does nothing when the wanted accessory isn't owned and none is on", async () => {
        const g = await setup();
        delete g.player.tails[SHADOW_WINGS];
        g.player.tailIndex = 0;
        const before = game!.sent.length;
        g.HatSystem.sentHatPacket = false;
        g.HatSystem.storeEquip(SHADOW_WINGS, true);
        expect(game!.sent.length).toBe(before);
    });

    it("remembers what it equipped this tick in the brain state", async () => {
        const g = await setup();
        g.player.skinIndex = 0;
        g.HatSystem.sentHatPacket = false;
        g.HatSystem.storeEquip(SOLDIER, false);
        expect(g.tickState.brainState.hatUsed).toBe(SOLDIER);
    });
});

describe("Hat System bull helmet cycle", () => {
    it("is due every 9 ticks while shamed, counted from the last health drain", async () => {
        const g = await setup();
        g.player.shameCount = 1;
        g.player.bullTick = g.tickState.tick - 9;
        expect(g.HatSystem.canTick(false)).toBe(true);
        g.player.bullTick = g.tickState.tick - 4;
        expect(g.HatSystem.canTick(false)).toBe(false);
    });

    it("isn't due without shame, without a bull helmet, while clowned, or when 100+ damage could sync us", async () => {
        const g = await setup();
        const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
        g.player.bullTick = g.tickState.tick - 9;
        g.HatSystem.needTick = 0;

        g.player.shameCount = 0;
        expect(g.HatSystem.canTick(false)).toBe(false);

        g.player.shameCount = 1;
        g.player.clowned = true;
        expect(g.HatSystem.canTick(false)).toBe(false);
        g.player.clowned = false;

        DefenseSystem.state.totalDamage = 95;
        expect(g.HatSystem.canTick(false)).toBe(false);
        DefenseSystem.state.totalDamage = 0;

        delete g.player.skins[BULL];
        expect(g.HatSystem.canTick(false)).toBe(false);
    });

    it("keeps asking for the bull helmet on later ticks until the drain shows up", async () => {
        const g = await setup();
        g.player.shameCount = 1;
        g.player.bullTick = g.tickState.tick;
        expect(g.HatSystem.canTick()).toBe(true);
        // canTick() moved the cycle to start next tick, so it's due again then.
        expect(g.player.bullTick).toBe(g.tickState.tick + 1);
    });

    it("a 5 health drain while wearing the bull helmet restarts the cycle", async () => {
        const g = await setup();
        game!.update([{ sid: ME, skinIndex: BULL }]);
        g.HatSystem.needTick = 3;
        game!.setHealth(ME, 95);
        expect(g.player.bullTick).toBe(g.tickState.tick - 1);
        expect(g.HatSystem.needTick).toBe(0);
    });

    it("with Angel Wings on, the drain shows as 2 (5 minus 3 regen) and also restarts it", async () => {
        const g = await setup();
        game!.update([{ sid: ME, skinIndex: BULL, tailIndex: 13 }]);
        g.HatSystem.needTick = 3;
        game!.setHealth(ME, 98);
        expect(g.player.bullTick).toBe(g.tickState.tick - 1);
        expect(g.HatSystem.needTick).toBe(0);
    });

    it.fails("weak spot 5: a 5 damage hit without a bull helmet shouldn't restart the bull cycle", async () => {
        const g = await setup();
        game!.update([{ sid: ME, skinIndex: SOLDIER }]);
        g.player.bullTick = 7;
        game!.setHealth(ME, 95);
        expect(g.player.bullTick).toBe(7);
    });
});

describe("Hat System state after death and reconnecting", () => {
    it.fails("weak spot 4: respawning clears the leftover bull helmet count and the standing-still count", async () => {
        const g = await setup();
        g.HatSystem.needTick = 3;
        g.HatSystem.stopMoveDuration = 5;
        game!.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: POLEARM });
        expect(g.HatSystem.needTick).toBe(0);
        expect(g.HatSystem.stopMoveDuration).toBe(0);
    });

    it.fails("weak spot 4: reconnecting clears them too", async () => {
        const g = await setup();
        g.HatSystem.needTick = 3;
        g.HatSystem.stopMoveDuration = 5;
        await g.Client.connect();
        expect(g.HatSystem.needTick).toBe(0);
        expect(g.HatSystem.stopMoveDuration).toBe(0);
    });

    it("a leftover bull count puts the bull helmet on with no shame at all (what weak spot 4 leads to)", async () => {
        const g = await setup();
        g.HatSystem.needTick = 2;
        g.player.shameCount = 0;
        g.player.bullTick = g.tickState.tick + 1;
        expect(g.HatSystem.canTick(false)).toBe(true);
    });
});

describe("Hat System: every insta and combo keeps its hat sequence", () => {
    // [hat, isAccessory, step skipped, tick mode, step only moves/equips (no swing)], per step. Read from the current code
    // (Phase 0); a change here changes a combo and needs the user's OK.
    const CLASSIC: Record<string, [number, boolean, boolean, string | null, boolean][]> = {
        "AutoInstakiller.normalAttackAction": [[BULL, false, false, null, false], [TURRET, false, false, null, false]],
        "AutoInstakiller.reverseAttackAction": [[TURRET, false, false, null, false], [BULL, false, false, null, false]],
        "MusketInstakiller.attackAction": [[BULL, false, false, null, false], [TURRET, false, false, null, false]],
        "AppleInstakiller.attackAction": [[TANK, false, false, null, false], [BULL, false, false, null, false]],
        "OneTicker.attackAction": [[TURRET, false, false, null, true], [BULL, false, false, null, false]],
        "TurretAPAssister.attackAction": [[TURRET, false, false, null, true], [-1, false, true, null, false]],
        "TurretGearKnockbacker.attackAction": [[TURRET, false, false, null, true], [-1, false, true, null, false]],
        "BarbarianKnockbacker.attackAction": [[BARBARIAN, false, false, null, true], [-1, false, true, null, false]]
    };

    it("matches the classic sequences", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: POLEARM });
        game.spawn({ sid: ENEMY, x: 3300, y: 3000, weaponIndex: POLEARM });
        game.setLoadout([POLEARM, 15], [0, 3, 6, 10, 15]);
        game.update();
        game.update();

        const { getAttackModules } = await import("@core/mod/combat/core/attackModuleRegistry");
        const found: Record<string, unknown> = {};
        for (const m of getAttackModules().modules) {
            for (const [key, value] of Object.entries(m as object)) {
                const seq = (value as { sequence?: { skinData: [number, boolean]; dontUse: boolean; tickMode?: string; noAttack?: boolean }[] })?.sequence;
                const name = `${m.constructor.name}.${key}`;
                if (!Array.isArray(seq) || !(name in CLASSIC)) continue;
                found[name] = seq.map(s => [s.skinData[0], s.skinData[1], s.dontUse, s.tickMode ?? null, !!s.noAttack]);
            }
        }
        expect(found).toEqual(CLASSIC);
    });

    it("a normal bull hit wears the bull helmet, or the soldier helmet with daggers", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: POLEARM });
        game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
        game.update();
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const { default: AttackQueuePool } = await import("@core/mod/combat/core/AttackQueuePool");
        const seq = AttackQueuePool.createAttackSequence();
        AttackManager.prepareBullHitSequence(seq);
        expect(seq[0].skinData).toEqual([BULL, false]);

        game.setLoadout([7], [0, 3, 6, 10, 15]);
        AttackManager.prepareBullHitSequence(seq);
        expect(seq[0].skinData).toEqual([SOLDIER, false]);
    });
});

describe("Hat System timing: a combo's hat is sent in the same tick as its swing, before it", () => {
    it("turret gear on the first tick, bull helmet together with the swing on the next", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: POLEARM });
        game.spawn({ sid: ENEMY, x: 3100, y: 3000, weaponIndex: POLEARM });
        game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
        game.update();

        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const { default: AttackQueuePool } = await import("@core/mod/combat/core/AttackQueuePool");
        const queue = AttackQueuePool.createAttackQueue();
        queue.sequence[0].skinData[0] = TURRET;
        queue.sequence[0].noAttack = true;
        queue.sequence[0].dontUse = false;
        queue.sequence[0].wpnId = POLEARM;
        queue.sequence[1].skinData[0] = BULL;
        queue.sequence[1].dontUse = false;
        queue.sequence[1].wpnId = POLEARM;
        queue.grade = Infinity;

        let queued = false;
        const original = AttackManager.modules;
        AttackManager.modules = [{ init() { }, update() { }, run() { if (!queued) { queued = true; AttackManager.addAttackQueue(queue); } }, reset() { } }] as never;
        try {
            game.update([{ sid: ME, skinIndex: 0 }]);
            const first = game.sentInLast(1);
            game.update([{ sid: ME, skinIndex: TURRET }]);
            const second = game.sentInLast(1);

            expect(first.filter(p => p.type === "c").map(p => p.args)).toEqual([[false, TURRET, false]]);
            expect(second.filter(p => p.type === "c").map(p => p.args)).toEqual([[false, BULL, false]]);
            // The first step only equips (no swing); the swing (auto gather on) goes out in the same tick as the bull
            // helmet, after it, so the server has the helmet on when it processes the swing.
            const swing = (t: typeof first) => t.findIndex(p => p.type === "K" && p.args[0] === 1);
            expect(swing(first)).toBe(-1);
            expect(swing(second)).toBeGreaterThan(second.findIndex(p => p.type === "c"));
        } finally {
            AttackManager.modules = original;
        }
    });
});
