// Run with: npm test --workspace=mod-source
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { default: Keybinds } = await loadTs("src/core/Keybinds.ts");
const key = (code, shiftKey = false) => ({ code, shiftKey });

test("defaults match the old hard-coded keys", () => {
    Keybinds.resetAll();
    assert.equal(Keybinds.get("autoInsta"), "KeyR");
    assert.equal(Keybinds.get("bullSpam"), "Space");
    assert.equal(Keybinds.get("tankSpam"), "Mouse0");
    assert.equal(Keybinds.get("reloadSprites"), "Shift+KeyZ");
    assert.deepEqual(Keybinds.conflictsWith("bullSpam"), [], "no default conflicts");
});

test("press matching, shift combos and unbinding", () => {
    Keybinds.resetAll();
    assert.equal(Keybinds.matches(key("KeyR"), "autoInsta"), true);
    assert.equal(Keybinds.matches(key("KeyZ", true), "reloadSprites"), true);
    assert.equal(Keybinds.matches(key("KeyZ", false), "reloadSprites"), false);
    Keybinds.set("autoInsta", "");
    assert.equal(Keybinds.matches(key("KeyR"), "autoInsta"), false, "unbound = disabled");
    Keybinds.set("autoInsta", "KeyG");
    assert.equal(Keybinds.matches(key("KeyG"), "autoInsta"), true);
});

test("held keys, mouse, capture mode and conflicts", () => {
    Keybinds.resetAll();
    assert.equal(Keybinds.isHeld("eat", { KeyQ: true }), true);
    assert.equal(Keybinds.isHeld("reloadSprites", { ShiftLeft: true, KeyZ: true }), true);
    assert.equal(Keybinds.matchesMouse({ button: 0 }, "tankSpam"), true);
    Keybinds.isCapturing = true;
    assert.equal(Keybinds.matches(key("KeyR"), "autoInsta"), false, "no actions while rebinding");
    Keybinds.isCapturing = false;
    Keybinds.set("eat", "KeyR");
    assert.deepEqual(Keybinds.conflictsWith("eat"), ["autoInsta"]);
    Keybinds.resetAll();
});

test("readable names", () => {
    assert.equal(Keybinds.describe("Shift+KeyZ"), "Shift + Z");
    assert.equal(Keybinds.describe("Mouse0"), "Left Click");
    assert.equal(Keybinds.describe(""), "None");
    assert.equal(Keybinds.fromKeyEvent({ code: "KeyZ", shiftKey: true }), "Shift+KeyZ");
    assert.equal(Keybinds.fromKeyEvent({ code: "ShiftLeft", shiftKey: true }), "ShiftLeft");
});
