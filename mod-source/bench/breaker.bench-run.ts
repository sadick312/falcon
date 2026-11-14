/**
 * Breaker brief Part E: what trap detection (PlayerStateManager.updateState) and Auto Break's preparation
 * (AutoBreaker.preTick) cost per tick, with a crowded base around us: 120 enemy traps, 120 enemy spikes and 8 enemies,
 * while we're stuck in one of the traps. Both only look at the objects in the map squares around us
 * (ObjectManager.pool.closeObjects), never at every object on the map.
 *
 * Run: npx vitest run --config vitest.bench.config.mts mod-source/bench/breaker.bench-run.ts
 */
import { performance } from "perf_hooks";
import { describe, it } from "vitest";
import { ME, startGame } from "../test/helpers/game";

const TICKS = 300;

describe("breaker cost per tick", () => {
    it("crowded base, stuck in a trap", async () => {
        const { LIST_ID_MAP } = await import("@constants/items");
        const game = await startGame({ enable: ["autoBreak"] });
        game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: 5 });
        for (let e = 0; e < 8; e++) game.spawn({ sid: 2 + e, x: 3000 + 200 * Math.cos(e), y: 3000 + 200 * Math.sin(e), weaponIndex: 5 });
        game.setLoadout([5, 10], [0, 3, 6, 10, 15]);
        const objects: { sid: number; x: number; y: number; itemId: number; owner: number }[] = [
            { sid: 1000, x: 3000, y: 3000, itemId: LIST_ID_MAP.PIT_TRAP, owner: 2 }
        ];
        for (let i = 0; i < 120; i++) {
            const a = (i / 120) * Math.PI * 2;
            const r = 150 + (i % 6) * 120;
            objects.push({ sid: 2000 + i, x: 3000 + r * Math.cos(a), y: 3000 + r * Math.sin(a), itemId: LIST_ID_MAP.PIT_TRAP, owner: 2 });
            objects.push({ sid: 3000 + i, x: 3000 + (r + 60) * Math.cos(a + 0.03), y: 3000 + (r + 60) * Math.sin(a + 0.03), itemId: LIST_ID_MAP.SPIKES, owner: 2 });
        }
        // Far away (another part of the map): never looked at.
        for (let i = 0; i < 300; i++) objects.push({ sid: 5000 + i, x: 9000 + (i % 20) * 60, y: 9000 + Math.floor(i / 20) * 60, itemId: LIST_ID_MAP.SPIKES, owner: 2 });
        game.addObjects(objects);
        game.update();

        const { default: PlayerStateManager } = await import("@core/logic/players/core/PlayerStateManager");
        const { default: AutoBreaker } = await import("@core/mod/defense/modules/AutoBreaker");
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");

        let detectMs = 0;
        let preTickMs = 0;
        for (let t = 0; t < TICKS; t++) {
            game.update();
            const a = performance.now();
            PlayerStateManager.updateState();
            const b = performance.now();
            AutoBreaker.preTick();
            const c = performance.now();
            detectMs += b - a;
            preTickMs += c - b;
        }
        const close = ObjectManager.pool.closeObjects.length;
        const all = ObjectManager.allObjects.length;
        process.stdout.write(`[breaker bench] objects looked at ${close} of ${all}; per tick: trap detection ${(detectMs / TICKS * 1000).toFixed(1)} µs, AutoBreaker.preTick ${(preTickMs / TICKS * 1000).toFixed(1)} µs (tick budget 111 ms)
`);
        game.done();
    });
});
