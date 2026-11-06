// Search, reset to default, import/export and keyboard use of the mod menu.
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
    Menu.search("");
});

const shownLabels = () => [...Menu.contentElement.querySelectorAll(".menuItemLabel")].map((label) => label.textContent?.trim());

describe("settings search", () => {
    it("finds settings by label or description, case-insensitively, including nested ones", () => {
        expect(Menu.findSettings("SHAME STRIKE THRESHOLD").map((item) => item.id)).toContain(NESTED_SLIDER);
        expect(Menu.findSettings("draws player and ai names").map((item) => item.id)).toContain(TOGGLE);
        expect(Menu.findSettings("   ")).toEqual([]);
    });

    it("shows the results, and the tab again once the search is cleared", () => {
        Menu.search("names");
        expect(Menu.utilsTitle.innerText).toMatch(/^Search: \d+ results?$/);
        expect(shownLabels()).toContain(Menu.itemMap[TOGGLE].label);

        Menu.search("");
        expect(Menu.utilsTitle.innerText).toBe("Combat");
    });

    it("says so when nothing matches", () => {
        Menu.search("zzzz-no-such-setting");
        expect(Menu.contentElement.textContent).toContain('No settings match "zzzz-no-such-setting".');
    });
});

describe("reset to default", () => {
    it("puts a changed setting back and hides its button again", () => {
        Menu.search("draws player and ai names");
        const button = () => Menu.contentElement.querySelector<HTMLElement>(".menuResetButton")!;
        expect(button().style.display).toBe("none");

        Menu.contentElement.querySelector<HTMLElement>(".menuToggle .menuToggle")!.click();
        expect(Menu.getValue(TOGGLE)).toBe(false);
        expect(button().style.display).toBe("");

        button().click();
        expect(Menu.getValue(TOGGLE)).toBe(true);
        expect(button().style.display).toBe("none");
    });

    it("treats a slider's typed text and its numeric default as the same value", () => {
        const item = Menu.itemMap[NESTED_SLIDER];
        item.status = String(Menu.defaults[NESTED_SLIDER]);
        expect(Menu.isChanged(item)).toBe(false);
    });

    it("has no reset for settings that are never saved", () => {
        const neverSaved = Object.values(Menu.itemMap).find((item) => item.neverSave && item.type === "toggle")!;
        expect(Menu.canReset(neverSaved)).toBe(false);
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
        Menu.search("draws player and ai names");
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
