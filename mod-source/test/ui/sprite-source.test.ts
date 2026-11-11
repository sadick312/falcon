// "Original MooMoo Artwork" (Visual, on by default): on sandbox.moomodding.io, hats, accessories, weapons and arrows
// are drawn with the official moomoo.io pictures (the original Falcon's look), loaded without crossOrigin because
// moomoo.io sends no CORS header. Off, or on sandbox.moomoo.io, the site's own img/ pictures as before.
import { afterEach, describe, expect, it, vi } from "vitest";

async function load(mode: "moomodding" | "moomoo-sandbox", originalArtwork?: boolean) {
    vi.resetModules();
    localStorage.setItem("falcon-host-mode", mode);
    const { default: Menu } = await import("@menu/Menu");
    await Menu.init();
    if (originalArtwork !== undefined) Menu.itemMap.originalArtwork!.status = originalArtwork;
    const { loadGameSprite } = await import("@rendering/core/SpriteSource");
    return loadGameSprite;
}

afterEach(() => localStorage.removeItem("falcon-host-mode"));

describe("loadGameSprite", () => {
    it("on moomodding with the setting on (default): the official moomoo.io picture, no crossOrigin", async () => {
        const loadGameSprite = await load("moomodding");
        const hat = loadGameSprite("hats", "hat_7.png");
        expect(hat.src).toBe("https://moomoo.io/img/hats/hat_7.png");
        expect(hat.crossOrigin).toBeNull();
    });

    it("on moomodding with the setting off: the site's own picture, as before", async () => {
        const loadGameSprite = await load("moomodding", false);
        const weapon = loadGameSprite("weapons", "spear_1.png");
        expect(weapon.src.endsWith("/img/weapons/spear_1.png")).toBe(true);
        expect(weapon.src.startsWith("https://moomoo.io")).toBe(false);
        expect(weapon.crossOrigin).toBe("anonymous");
    });

    it("on sandbox.moomoo.io: always the site's own pictures (they are the official ones there)", async () => {
        const loadGameSprite = await load("moomoo-sandbox", true);
        expect(loadGameSprite("accessories", "access_11.png").src.startsWith("https://moomoo.io")).toBe(false);
    });
});
