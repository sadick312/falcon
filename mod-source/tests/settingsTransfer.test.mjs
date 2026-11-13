import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { exportSettingsText, parseSettingsText, isValidValue } = await loadTs("src/core/menu/SettingsTransfer.ts");

const schema = {
    autoHeal: { def: true },
    weaponBuild: { def: "katanaMusket", options: ["manual", "katanaMusket", "polearmMusket"] },
    dangerWarningAt: { def: 50 },
    quickChat1: { def: "gg" },
};
const keybindIds = ["autoInsta", "eat"];

test("export then import gives the same settings and keybinds back", () => {
    const text = exportSettingsText({ autoHeal: false, weaponBuild: "polearmMusket", dangerWarningAt: 70 }, { autoInsta: "KeyG" });
    const r = parseSettingsText(text, schema, keybindIds);
    assert.deepEqual(r.settings, { autoHeal: false, weaponBuild: "polearmMusket", dangerWarningAt: 70 });
    assert.deepEqual(r.keybinds, { autoInsta: "KeyG" });
    assert.equal(r.skipped, 0);
});

test("unknown settings and bad values are skipped, not applied", () => {
    const text = JSON.stringify({ falcon: 1, settings: { autoHeal: "yes", weaponBuild: "laserGun", gone: true, quickChat1: "hi", dangerWarningAt: null }, keybinds: { nope: "KeyX", eat: 5 } });
    const r = parseSettingsText(text, schema, keybindIds);
    assert.deepEqual(r.settings, { quickChat1: "hi" });
    assert.equal(r.skipped, 6);
});

test("an old plain saved config (no wrapper) still imports", () => {
    const r = parseSettingsText('{"autoHeal": false}', schema, keybindIds);
    assert.deepEqual(r.settings, { autoHeal: false });
    assert.equal(r.keybinds, null);
});

test("garbage text gives a readable error", () => {
    assert.throws(() => parseSettingsText("hello", schema, keybindIds), /isn't valid settings/);
    assert.throws(() => parseSettingsText("[1,2]", schema, keybindIds), /isn't valid settings/);
    assert.throws(() => parseSettingsText('{"x": 1}', schema, keybindIds), /No Falcon settings/);
});

test("isValidValue", () => {
    assert.equal(isValidValue({ def: true }, 1), false);
    assert.equal(isValidValue({ def: 50 }, "60"), true); // number inputs store text
    assert.equal(isValidValue({ def: 50 }, Infinity), false);
    assert.equal(isValidValue({ def: "a", options: ["0", "1"] }, 1), true);
});
