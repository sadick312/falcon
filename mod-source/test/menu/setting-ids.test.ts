// Menu.getValue("id") returns undefined for an id that doesn't exist, which reads as "switched off". A typo in an
// id would silently disable whatever checks it, so every id the source passes to getValue/setValue must exist.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return entry.name.endsWith(".ts") ? [full] : [];
    });
}

/** Lookups the id check below can't read: anything but Menu.getValue("id") / setValue("id", ...), or itemMap access. */
function uncheckedLookups(text: string) {
    const found: string[] = [];
    for (const match of text.matchAll(/Menu\.(?:getValue|setValue)\(\s*([^,)]*)/g)) {
        if (!/^"[^"]+"$/.test(match[1].trim())) found.push(`Menu.getValue/setValue(${match[1].trim()})`);
    }
    for (const match of text.matchAll(/Menu\.itemMap(\[[^\]]*\]|\.\w+)/g)) found.push(`Menu.itemMap${match[1]}`);
    return found;
}

describe("setting ids", () => {
    it("every id passed to Menu.getValue or Menu.setValue is a real setting", async () => {
        const { default: Menu } = await import("@menu/Menu");
        Menu.buildItemMap();

        const missing: string[] = [];
        let checked = 0;

        for (const file of sourceFiles(srcDir)) {
            const text = fs.readFileSync(file, "utf8");
            for (const match of text.matchAll(/Menu\.(?:getValue|setValue)\("([^"]+)"/g)) {
                checked++;
                if (!Object.hasOwn(Menu.itemMap, match[1])) missing.push(`${path.relative(srcDir, file)}: "${match[1]}"`);
            }
        }

        expect(checked).toBeGreaterThan(50);
        expect(missing).toEqual([]);
    });

    it("every lookup outside the menu code uses a plain \"id\", so the check above can read it", () => {
        // Menu.getValue('id'), a `template`, a variable or itemMap["id"] would slip past the check above, so a typo in
        // one of them could switch a feature off unnoticed. The menu's own files work on ids generically and are skipped.
        const unchecked: string[] = [];

        for (const file of sourceFiles(srcDir)) {
            const relative = path.relative(srcDir, file).split(path.sep).join("/");
            if (relative.startsWith("core/menu/")) continue;
            for (const found of uncheckedLookups(fs.readFileSync(file, "utf8"))) unchecked.push(`${relative}: ${found}`);
        }

        expect(unchecked).toEqual([]);
    });

    it("would catch the forms it can't read", () => {
        expect(uncheckedLookups(`Menu.getValue("autoHeal"); Menu.setValue("autoGrind", false);`)).toEqual([]);
        expect(uncheckedLookups(`Menu.getValue('autoHeal')`)).toHaveLength(1);
        expect(uncheckedLookups("Menu.getValue(`auto${x}`)")).toHaveLength(1);
        expect(uncheckedLookups(`Menu.getValue(id)`)).toHaveLength(1);
        expect(uncheckedLookups(`Menu.itemMap["autoHeal"].status`)).toHaveLength(1);
    });
});
