// Feature #36, Auto Buy (AutoBuyer): with "Auto Buy" on, buys hats and accessories in a fixed order (monkey tail,
// winter cap, soldier helmet, bull helmet, tank gear, turret gear, flipper hat, booster hat, EMP helmet, shadow wings,
// spike gear, corrupt X wings, barbarian armor) whenever our points change, skipping ones we already own.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const MONKEY_TAIL = 11;
const WINTER_CAP = 15;

/** Returns the store purchases (`c` with buy = true) sent when our points become `points`. */
async function buys(points: number, s: { enable?: boolean; ownMonkeyTail?: boolean } = {}) {
    game = await startGame({ enable: s.enable === false ? [] : ["autoBuy"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    const player = game.Client.player;
    if (s.ownMonkeyTail) player.tails[MONKEY_TAIL] = true;
    else delete player.tails[MONKEY_TAIL];
    delete player.skins[WINTER_CAP];

    const before = game.sent.length;
    game.handlers.N("points", points);
    return game.sent.slice(before).filter(p => p.type === "c" && p.args[0] === true).map(p => [p.args[1], p.args[2]]);
}

describe("Auto Buy", () => {
    it("buys the first item on the list once we can afford it", async () => {
        expect(await buys(2000)).toEqual([[MONKEY_TAIL, true]]);
    });

    it("waits while we can't afford it, and does nothing when off", async () => {
        expect(await buys(1999)).toEqual([]);
        expect(await buys(5000, { enable: false })).toEqual([]);
    });

    it("skips an item we already own even before we could afford it", async () => {
        // Monkey tail (2000) is owned; winter cap (600) is next. An owned item was only skipped once we had its price,
        // so 1000 points bought nothing.
        expect(await buys(1000, { ownMonkeyTail: true })).toEqual([[WINTER_CAP, false]]);
    });
});
