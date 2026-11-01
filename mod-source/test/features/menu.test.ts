// Feature #59, Menu, settings save/load, favorites (Menu, icons, menuStyle, Stack). Saving, loading, versioning,
// favorites and corrupted data are covered in test/menu/settings.test.ts; this checks the settings list itself.
import { describe, expect, it } from "vitest";
import Menu, { menuContent, type IMenuItem } from "@menu/Menu";

function allItems(items: IMenuItem[] = Object.values(menuContent).flat() as IMenuItem[]): IMenuItem[] {
    return items.flatMap(item => [item, ...allItems(item.settings ?? [])]);
}

describe("Menu", () => {
    it("gives every setting its own id (a repeated id would overwrite another setting)", () => {
        // Favorites list items that also appear in their own tab; those are the same object, not a clash. Layout items
        // (headings, groups, the chat log and config panels) have no id.
        const byId = new Map<string, IMenuItem>();
        for (const item of allItems()) {
            if (item.id === "") continue;
            const seen = byId.get(item.id);
            expect(seen === undefined || seen === item, item.id).toBe(true);
            byId.set(item.id, item);
        }
    });

    it("starts every select on one of its options", () => {
        for (const item of allItems()) {
            if (item.type !== "select" || item.status === undefined) continue;
            expect(item.options?.some(o => String(o.value) === String(item.status)), item.id).toBe(true);
        }
    });

    it("finds every setting by id", () => {
        Menu.buildItemMap();
        for (const item of allItems()) if (item.id !== "") expect(Menu.itemMap[item.id], item.id).toBe(item);
    });
});
