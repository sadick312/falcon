// Hat brief Phase 2, B2 ("Remember Sent Equips", Defense toggle, off by default): the Hat System compares what it wants
// with what the server last reported. With a ping over one tick (~111 ms) the server's report of a new hat arrives
// ticks after we sent it, so the old code sent the same equip again every tick until then: wasted packets, and the
// accessory waited behind each copy (one store packet a tick). With the toggle on, an equip still on its way (sent
// within the ticks our ping takes, plus one) isn't sent again, and the accessory can go out meanwhile.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const BOOSTER = 12, WINTER_CAP = 15, MONKEY_TAIL = 11;
const POLEARM = 5;

/** We move on open ground (booster hat + monkey tail wanted); the server reports `hat`/`acc` each tick. */
async function setup(on: boolean, ping: number) {
    game = await startGame({ enable: on ? ["rememberSentEquips"] : [] });
    game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: POLEARM });
    game.spawn({ sid: 2, x: 12000, y: 12000 });
    game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
    const { default: PingTracker } = await import("@core/mod/utils/PingTracker");
    vi.spyOn(PingTracker, "getStablePing").mockReturnValue(ping);
    game.Client.lastMoveDir = 0;

    /** One tick with the server still showing `hat`/`acc`; returns this tick's equips as [id, isAccessory]. */
    const tick = (hat = 0, acc = 0) => {
        game!.update([{ sid: ME, skinIndex: hat, tailIndex: acc }]);
        return game!.sentInLast(1).filter(p => p.type === "c" && p.args[0] === false).map(p => [p.args[1], p.args[2]]);
    };
    return { tick, player: game.Client.player };
}

describe("Remember Sent Equips (B2)", () => {
    it("off (classic): sends the same hat again every tick until the server shows it", async () => {
        const g = await setup(false, 300);
        expect(g.tick()).toEqual([[BOOSTER, false]]);
        expect(g.tick()).toEqual([[BOOSTER, false]]);
        expect(g.tick()).toEqual([[BOOSTER, false]]);
    });

    it("on, 300 ms ping: sends the hat once, the accessory the next tick, and nothing more while they're on their way", async () => {
        const g = await setup(true, 300);
        expect(g.tick()).toEqual([[BOOSTER, false]]);
        expect(g.tick()).toEqual([[MONKEY_TAIL, true]]);
        expect(g.tick()).toEqual([]);
        // The server shows both: nothing to send.
        expect(g.tick(BOOSTER, MONKEY_TAIL)).toEqual([]);
    });

    it("on: sends again once the hat is overdue (lost, or refused by the server)", async () => {
        const g = await setup(true, 50); // under a tick: expected on the next update, one tick of grace
        expect(g.tick()).toEqual([[BOOSTER, false]]);
        expect(g.tick(0, MONKEY_TAIL)).toEqual([]);
        expect(g.tick(0, MONKEY_TAIL)).toEqual([]);
        expect(g.tick(0, MONKEY_TAIL)).toEqual([[BOOSTER, false]]);
    });

    it("on: a different wanted hat goes out at once, even while another is on its way", async () => {
        const g = await setup(true, 300);
        expect(g.tick()).toEqual([[BOOSTER, false]]);
        g.player.real_position.y = 100; // the snow: winter cap now (the update below keeps our position)
        const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
        HatSystem.sentHatPacket = false;
        HatSystem.storeEquip(WINTER_CAP, false);
        expect(game!.sent.filter(p => p.type === "c").slice(-1).map(p => p.args)).toEqual([[false, WINTER_CAP, false]]);
    });

    it("on: forgets equips on their way when we respawn", async () => {
        const g = await setup(true, 300);
        expect(g.tick()).toEqual([[BOOSTER, false]]);
        const { default: HatSystem } = await import("@core/mod/defense/defense-modules/HatSystem");
        HatSystem.reset();
        expect(g.tick()).toEqual([[BOOSTER, false]]);
    });

    it("is a Defense toggle, off by default", async () => {
        vi.resetModules();
        const { defenseSettings } = await import("@core/menu/content/defense");
        const find = (node: unknown): { type?: string; status?: unknown } | undefined => {
            if (Array.isArray(node)) return node.map(find).find(Boolean);
            if (node && typeof node === "object") {
                if ((node as { id?: string }).id === "rememberSentEquips") return node as { type?: string; status?: unknown };
                return Object.values(node).map(find).find(Boolean);
            }
            return undefined;
        };
        const item = find(defenseSettings);
        expect(item?.type).toBe("toggle");
        expect(item?.status).toBe(false);
    });
});
