// The menu's look (as in the original Falcon), import/export and keyboard use.
import Menu, { menuContent } from "@menu/Menu";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** A saveable toggle that starts on. */
const TOGGLE = "renderNames";
/** A slider inside the Auto Push Striker sub-page. */
const NESTED_SLIDER = "daggerShameStrikeThres";

let initial: Record<string, unknown>;

beforeAll(async () => {
    await Menu.init();
    initial = Object.fromEntries(Object.entries(Menu.itemMap).map(([id, item]) => [id, item.status]));
});

beforeEach(() => {
    for (const [id, status] of Object.entries(initial)) Menu.itemMap[id].status = status;
    document.getElementById(`menuTab:${Menu.selectedTab}`)!.click();
});

const shownLabels = () => [...Menu.contentElement.querySelectorAll(".menuItemLabel")].map((label) => label.textContent?.trim());

describe("original Falcon look", () => {
    it("has no settings search box and no reset buttons", () => {
        Menu.renderItems([Menu.itemMap[TOGGLE]!, Menu.itemMap[NESTED_SLIDER]!]);
        expect(document.querySelector(".menuSearchInput")).toBeNull();
        expect(Menu.contentElement.querySelector(".menuResetButton")).toBeNull();
        expect(shownLabels()).toEqual([Menu.itemMap[TOGGLE]!.label, Menu.itemMap[NESTED_SLIDER]!.label]);
    });
});

describe("import and export", () => {
    it("applies an imported settings object and reports what it skipped", async () => {
        Menu.setValue("autoSaveSettings", true);
        const result = await Menu.applySettings({ [TOGGLE]: false, noSuchSetting: 1, [NESTED_SLIDER]: { bad: true } });

        expect(result).toEqual({ applied: 1, skipped: 2 });
        expect(Menu.getValue(TOGGLE)).toBe(false);
        expect(JSON.parse(localStorage.getItem("falcon-settings")!)[TOGGLE]).toBe(false);
    });

    it("downloads the current settings as falcon-settings.json", () => {
        const configsTab = Object.keys(menuContent).indexOf("configs");
        document.getElementById(`menuTab:${configsTab}`)!.click();
        URL.createObjectURL = vi.fn(() => "blob:test");
        URL.revokeObjectURL = vi.fn();
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

        const exportButton = [...Menu.contentElement.querySelectorAll<HTMLElement>(".menuConfigUIButton")].find((b) => b.textContent === "Export")!;
        exportButton.click();

        expect(click).toHaveBeenCalledOnce();
        expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("falcon-settings.json");
    });
});

describe("keyboard", () => {
    it("flips a toggle with Enter without the key reaching the game", () => {
        Menu.renderItems([Menu.itemMap[TOGGLE]!]);
        const toggle = Menu.contentElement.querySelector<HTMLElement>("[role=switch]")!;
        const gameListener = vi.fn();
        document.addEventListener("keydown", gameListener);

        toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        document.removeEventListener("keydown", gameListener);

        expect(Menu.getValue(TOGGLE)).toBe(false);
        expect(toggle.getAttribute("aria-checked")).toBe("false");
        expect(gameListener).not.toHaveBeenCalled();
    });

    it("switches tabs from the keyboard and highlights only the new one", () => {
        const visualTab = Object.keys(menuContent).indexOf("visual");
        document.getElementById(`menuTab:${visualTab}`)!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

        expect(Menu.selectedTab).toBe(visualTab);
        expect(document.querySelectorAll(".menuTab.activeTab")).toHaveLength(1);
        expect(Menu.utilsTitle.innerText).toBe("Visual");
    });
});
