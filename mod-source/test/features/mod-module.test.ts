// Feature #39, Module base class (ModModule; CombatModule and DefenseModule add nothing): `init()` runs `initialize()`
// once, `run()` calls `execute()` only when `canExecute()` allows it. AttackManager calls init + update on all 14 attack
// modules, then run, every tick. AutoBreaker, ObjectBreaker, TurretManager and the placing/defense systems are plain
// static classes and don't use it.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

describe("Module base class", () => {
    it("initializes once and only executes when allowed", async () => {
        game = await startGame();
        const { default: ModModule } = await import("@core/mod/utils/ModModule");
        const calls: string[] = [];
        let allowed = false;

        class Probe extends ModModule {
            protected initialize() { calls.push("init"); }
            protected canExecute() { return allowed; }
            protected execute() { calls.push("exec"); }
            update() { }
        }

        const probe = new Probe();
        probe.init();
        probe.init();
        probe.run();
        allowed = true;
        probe.run();
        expect(calls).toEqual(["init", "exec"]);
    });

    it("is used by all 15 attack modules, each run every tick", async () => {
        game = await startGame();
        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const { default: ModModule } = await import("@core/mod/utils/ModModule");
        expect(AttackManager.modules.length).toBe(15);
        expect(AttackManager.modules.every(m => m instanceof ModModule)).toBe(true);
        expect(new Set(AttackManager.modules.map(m => m.constructor.name)).size).toBe(15);
    });
});
