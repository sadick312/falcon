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

test("Shift + key goes to the Shift action only (Shift+= zooms in, doesn't also reset zoom)", () => {
    Keybinds.resetAll();
    assert.equal(Keybinds.matches(key("Equal", true), "zoomIn"), true);
    assert.equal(Keybinds.matches(key("Equal", true), "resetZoom"), false);
    assert.equal(Keybinds.matches(key("Equal", false), "resetZoom"), true);
    assert.equal(Keybinds.matches(key("Minus"), "zoomOut"), true);
    // No Shift+R action exists, so R still works while Shift is held (e.g. while overriding).
    assert.equal(Keybinds.matches(key("KeyR", true), "autoInsta"), true);
    assert.deepEqual(Keybinds.conflictsWith("zoomIn"), []);
    assert.deepEqual(Keybinds.conflictsWith("zoomOut"), []);
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

test("hotkey list has the game keys and every action with its current key", () => {
    Keybinds.resetAll();
    const rows = Keybinds.listBindings();
    assert.equal(rows[0].category, "Game");
    assert.equal(rows.find(r => r.label === "Show All Hotkeys").key, "O");
    assert.equal(rows.find(r => r.label === "Quick Chat 1").key, "Shift + 1");
    Keybinds.set("autoInsta", "");
    assert.equal(rows.length, Keybinds.listBindings().length);
    assert.equal(Keybinds.listBindings().find(r => r.label.startsWith("Insta Now")).key, "None");
    Keybinds.resetAll();
});
