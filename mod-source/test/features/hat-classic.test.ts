// Classic Hat Switching (Defense menu, off by default): the everyday hats (contract rules 9-13) work like a classic
// MooMoo hat changer: soldier helmet with an enemy within 300, else flipper hat in the river, winter cap in the snow,
// booster hat while moving, soldier helmet when standing still. Rules 1-8 (defense, combos, tap mode, breaking, EMP,
// bull ticks, anti-bull) still come first, and with the toggle off nothing changes.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const IGNORE = -1;
const SOLDIER = 6, BULL = 7, BOOSTER = 12, WINTER_CAP = 15, EMP = 22, FLIPPER = 31, TURRET = 53;
const SWORD = 3, POLEARM = 5;
const ENEMY = 2;

async function setup(classic: boolean) {
    game = await startGame({ enable: classic ? ["classicHatSwitching"] : [] });
    game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: POLEARM });
    game.spawn({ sid: ENEMY, x: 12000, y: 12000, weaponIndex: SWORD });
    game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
    game.update();

    const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const { tickState } = await import("@core/TickState");
    const { Client } = game;
    const player = Client.player;
    const enemy = PlayerManager.get(ENEMY)!;
    const hs = HatSystem as unknown as { fetchBestHat(): number; needTick: number; stopMoveDuration: number; hatRule: string };

    // Nothing going on: no forced hat, no attack, no threats, us moving at (3000, 3000), the enemy far away.
    DefenseSystem.skinIndex = IGNORE;
    DefenseSystem.canPlaceOnMe = false;
    DefenseSystem.state.spikeThreats = 0;
    (AttackManager as unknown as { _currentAttackAction: unknown })._currentAttackAction = undefined;
    AttackManager.oneTicker.tapMode = false;
    AttackManager.antiBuller.consider = false;
    CombatController.skinIndex = IGNORE;
    tickState.enemyData.nearest = null;
    tickState.enemyData.rangedInstaThreats = 0;
    player.turretThreats = 0;
    player.shameCount = 0;
    player.bullTick = tickState.tick + 1;
    player.zIndex = 0;
    hs.needTick = 0;
    hs.stopMoveDuration = 0;
    Client.lastMoveDir = 0;

    return {
        hs, DefenseSystem, AttackManager, Client, player, tickState,
        hat: () => hs.fetchBestHat(),
        at(y: number) { player.real_position.x = 3000; player.real_position.y = y; },
        enemyAt(dist: number) {
            enemy.real_position.x = player.real_position.x + dist;
            enemy.real_position.y = player.real_position.y;
            enemy.weaponData.primary = SWORD;
            tickState.enemyData.nearest = enemy;
        }
    };
}

describe("Classic Hat Switching", () => {
    it("soldier helmet with an enemy within 300, booster hat beyond", async () => {
        const g = await setup(true);
        g.at(3000);
        g.enemyAt(290);
        expect(g.hat()).toBe(SOLDIER);
        expect(g.hs.hatRule).toBe("classic: enemy near");

        g.enemyAt(310);
        expect(g.hat()).toBe(BOOSTER);
    });

    it("an enemy near beats the river and the snow (the normal rules put the river first)", async () => {
        const g = await setup(true);
        g.at(7200);
        g.enemyAt(250);
        expect(g.hat()).toBe(SOLDIER);

        const off = await setup(false);
        off.at(7200);
        off.enemyAt(150);
        expect(off.hat()).toBe(FLIPPER);
    });

    it("flipper hat in the river, winter cap in the snow, booster hat while moving", async () => {
        const g = await setup(true);
        g.at(7200);
        expect(g.hat()).toBe(FLIPPER);
        g.at(1000);
        expect(g.hat()).toBe(WINTER_CAP);
        g.at(3000);
        expect(g.hat()).toBe(BOOSTER);
    });

    it("soldier helmet as soon as we stand still (the normal rules keep the hat for one tick)", async () => {
        const g = await setup(true);
        g.at(3000);
        g.Client.lastMoveDir = null;
        expect(g.hat()).toBe(SOLDIER);
        expect(g.hs.hatRule).toBe("classic: standing still");

        const off = await setup(false);
        off.at(3000);
        off.Client.lastMoveDir = null;
        expect(off.hat()).toBe(IGNORE);
    });

    it("leaves rules 1-8 in charge: forced defense hat, combos, bull ticks, EMP against turrets", async () => {
        const g = await setup(true);
        g.at(3000);
        g.enemyAt(200);

        g.DefenseSystem.skinIndex = EMP;
        expect(g.hat()).toBe(EMP);
        g.DefenseSystem.skinIndex = IGNORE;

        (g.AttackManager as unknown as { _currentAttackAction: unknown })._currentAttackAction = { skinData: [TURRET, false] };
        expect(g.hat()).toBe(TURRET);
        (g.AttackManager as unknown as { _currentAttackAction: unknown })._currentAttackAction = undefined;

        g.player.shameCount = 1;
        g.player.bullTick = g.tickState.tick;
        expect(g.hat()).toBe(BULL);
        g.player.shameCount = 0;
        g.player.bullTick = g.tickState.tick + 1;

        g.player.turretThreats = 1;
        expect(g.hat()).toBe(EMP);
    });

    it("is a Defense toggle, off by default", async () => {
        vi.resetModules();
        const { defenseSettings } = await import("@core/menu/content/defense");
        const find = (node: unknown): { type?: string; status?: unknown } | undefined => {
            if (Array.isArray(node)) return node.map(find).find(Boolean);
            if (node && typeof node === "object") {
                if ((node as { id?: string }).id === "classicHatSwitching") return node as { type?: string; status?: unknown };
                return Object.values(node).map(find).find(Boolean);
            }
            return undefined;
        };
        expect(find(defenseSettings)?.type).toBe("toggle");
        expect(find(defenseSettings)?.status).toBe(false);
    });
});
