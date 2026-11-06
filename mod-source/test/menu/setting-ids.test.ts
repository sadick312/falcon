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
});
