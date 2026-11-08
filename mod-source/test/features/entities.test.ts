// Feature #46, Entities (Player, Ai, Projectile, SimulationProjectile, EntityHandler, aiTypes): the classes behind
// players, animals and projectiles, and the sid-indexed lists that hold them. SimulationProjectile replays 1.8.2's
// projectile update each tick: move by speed × dt, hit the nearest enemy player (35 box) or object with
// layer >= its own (getScale() box) along the way, and stop at the end of its range.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

describe("Entities", () => {
    it("keep their list positions right when entries are removed", async () => {
        game = await startGame();
        const { default: EntityHandler } = await import("@constants/EntityHandler");
        const list = new EntityHandler<{ sid: number; listHandlerIndex: number; turretHandlerIndex: number }>();
        const a = { sid: 1, listHandlerIndex: -1, turretHandlerIndex: -1 };
        const b = { sid: 2, listHandlerIndex: -1, turretHandlerIndex: -1 };
        const c = { sid: 3, listHandlerIndex: -1, turretHandlerIndex: -1 };
        list.add(a);
        list.add(b);
        list.add(c);
        list.add(a); // already there
        list.remove(1);
        expect(list.all.map(e => e.sid)).toEqual([3, 2]);
        expect(c.listHandlerIndex).toBe(0);
        list.remove(3);
        list.remove(2);
        expect(list.all).toEqual([]);
    });

    it("keep positions right when the last entry is removed, in both list types", async () => {
        game = await startGame();
        const { default: EntityHandler } = await import("@constants/EntityHandler");
        type E = { sid: number; listHandlerIndex: number; turretHandlerIndex: number };
        for (const type of [0, 1] as const) {
            const list = new EntityHandler<E>(type);
            const index = (e: E) => (type === 0 ? e.listHandlerIndex : e.turretHandlerIndex);
            const items = [1, 2, 3, 4].map(sid => ({ sid, listHandlerIndex: -1, turretHandlerIndex: -1 }));
            for (const e of items) list.add(e);

            list.remove(4); // the last one
            expect(list.all.map(e => e.sid)).toEqual([1, 2, 3]);
            list.remove(1); // the first: the last one moves into its place
            expect(list.all.map(e => e.sid)).toEqual([3, 2]);
            for (const [i, e] of list.all.entries()) expect(index(e)).toBe(i);
            list.remove(99); // not there
            expect(list.all.map(e => e.sid)).toEqual([3, 2]);
        }
    });

    it("keep the player list's positions right when players leave", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000 });
        for (const sid of [2, 3, 4]) game.spawn({ sid, x: 2000 + sid * 100, y: 1000 });
        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        const handler = PlayerManager.players.handler;
        const sids = () => handler.all.map(p => p.sid);

        const last = handler.all[handler.all.length - 1]!;
        handler.remove(last.sid);
        expect(sids()).not.toContain(last.sid);
        const first = handler.all[0]!;
        handler.remove(first.sid);
        expect(sids()).not.toContain(first.sid);
        for (const [i, p] of handler.all.entries()) expect(p.listHandlerIndex).toBe(i);
        expect(handler.all).toHaveLength(2);
    });

    /** A projectile from (fromX, 1000) toward us at (1000, 1000); returns the damage we expect after 3 ticks. */
    async function incoming(s: { fromX: number; speed: number; indx: number; turretAt?: number; arrowFromEnemy?: boolean }) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: s.arrowFromEnemy ? s.fromX + 70 : 4000, y: 1000, weaponIndex: 9 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        if (s.turretAt !== undefined) game.addObjects([{ sid: 800, x: s.turretAt, y: 1000, itemId: LIST_ID_MAP.TURRET, owner: 2 }]);
        game.update();
        game.update();
        const { default: ModManager } = await import("@core/ModManager");
        game.handlers.X(s.fromX, 1000, Math.PI, 700, s.speed, s.indx, s.indx, 9000);
        const seen: number[] = [];
        for (let i = 0; i < 3; i++) {
            game.update();
            if (ModManager.brainState.sources.includes("projectileDamage")) seen.push(ModManager.brainState.totalDamage);
        }
        return seen;
    }

    it("predict an enemy's arrow hitting us", async () => {
        expect((await incoming({ fromX: 1250, speed: 1.6, indx: 0, arrowFromEnemy: true })).length).toBe(1);
    });

    it("predict an enemy turret's bullet hitting us", async () => {
        // The bullet starts at the turret's centre; 1.8.2 skips the turret that fired it (ignoreObj). The simulation
        // used to hit the turret itself on its first step, so the bullet never reached us.
        expect((await incoming({ fromX: 1250, speed: 1.5, indx: 1, turretAt: 1250 })).length).toBe(1);
    });
});
