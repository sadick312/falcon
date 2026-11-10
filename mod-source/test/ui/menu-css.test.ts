// Menu toggle switches in Windows high-contrast mode ("Contrast themes"). There Chrome reports forced colors and
// repaints every background with system colours, so the switch and its knob both turned the same dark grey and
// the switch vanished. Opting the switch out of forced colours keeps it visible. jsdom can't emulate forced
// colours, so this checks the rule in menu.css itself.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Tests run from the repo root (vitest.config.mts), as the setup file path there shows.
const css = readFileSync(resolve(process.cwd(), "mod-source/src/core/menu/menu.css"), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
function ruleBody(selector: string) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
    return match?.[1] ?? "";
}

describe("Menu toggle switches in high-contrast mode", () => {
    it.each([".menuItemToggleHolder", ".menuItemToggleCircle"])("%s keeps its own colours (forced-color-adjust: none)", (selector) => {
        expect(ruleBody(selector)).toMatch(/forced-color-adjust:\s*none\s*;/);
    });
});
