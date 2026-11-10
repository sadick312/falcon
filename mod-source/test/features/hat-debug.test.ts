// Hat Debug (Visuals menu, off by default): shows what the Hat System wanted this tick and which rule of its classic
// contract chose it. It only reads the decision; it never changes which hat is picked.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function tick(enable: string[], change: (g: Game) => void = () => { }) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 3000, y: 3000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 12000, y: 12000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();
    game.Client.lastMoveDir = 0;
    change(game);
    game.update();
    return document.getElementById("activity-list-display")!.textContent ?? "";
}

describe("Hat Debug", () => {
    it("shows the wanted hat and accessory with the rule that chose each", async () => {
        const text = await tick(["showHatDecision"]);
        expect(text).toContain("hat: Booster Hat (12 moving)");
        expect(text).toContain("acc: Monkey Tail (7 default)");
    });

    it("names the rule for other situations too (the river)", async () => {
        const text = await tick(["showHatDecision"], g => {
            g.update([{ sid: ME, y: 7200 }]);
        });
        expect(text).toContain("hat: Flipper Hat (9 in the river)");
    });

    it("says 'keep current' on the first tick after stopping", async () => {
        const text = await tick(["showHatDecision"], g => {
            g.update(); // moving: the standing-still count starts again
            g.Client.lastMoveDir = null;
        });
        expect(text).toContain("hat: keep current (13 just stopped (keep hat))");
    });

    it("shows nothing when it's off (the default)", async () => {
        const text = await tick([]);
        expect(text).not.toContain("hat:");
    });

    it("is a Visuals toggle, off by default", async () => {
        vi.resetModules();
        const { visualSettings } = await import("@core/menu/content/visual");
        // Menu items can sit inside groups, so search the whole tree.
        const find = (node: unknown): { type?: string; status?: unknown } | undefined => {
            if (Array.isArray(node)) return node.map(find).find(Boolean);
            if (node && typeof node === "object") {
                if ((node as { id?: string }).id === "showHatDecision") return node as { type?: string; status?: unknown };
                return Object.values(node).map(find).find(Boolean);
            }
            return undefined;
        };
        const item = find(visualSettings);
        expect(item?.type).toBe("toggle");
        expect(item?.status).toBe(false);
    });
});
