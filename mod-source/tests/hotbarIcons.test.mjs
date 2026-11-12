// Run with: npm test --workspace=mod-source
// Hotbar weapon icons with "Original MooMoo Artwork": moomoo.io pictures make the icon canvas
// unreadable (no CORS), so toDataURL throws and the canvas itself must be shown.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

class FakeElement {
    constructor(tag = "div") { this.tag = tag; this.style = {}; this.children = []; this.classes = new Set(); this.classList = { add: (c) => this.classes.add(c) }; }
    prepend(child) { this.children.unshift(child); }
    querySelector(sel) { return this.children.find(c => sel === "canvas.hotbar-icon" && c.tag === "canvas" && c.classes.has("hotbar-icon")) ?? null; }
}
class FakeCanvas extends FakeElement {
    constructor(tainted = false) { super("canvas"); this.width = 66; this.height = 66; this.tainted = tainted; this.drawn = []; }
    toDataURL() { if (this.tainted) throw new Error("SecurityError: tainted canvas"); return "data:image/png;base64,AAA"; }
    getContext() { return { drawImage: (src) => this.drawn.push(src) }; }
}
globalThis.document = { createElement: (tag) => tag === "canvas" ? new FakeCanvas() : new FakeElement(tag) };

const { showHotbarIcon, copyHotbarIcon } = await loadTs("src/ui/HotbarIcons.ts");

test("readable icon (site picture): background image like before", () => {
    const slot = new FakeElement();
    showHotbarIcon(slot, new FakeCanvas(false));
    assert.equal(slot.style.backgroundImage, "url('data:image/png;base64,AAA')");
    assert.equal(slot.children.length, 0);
});

test("moomoo.io picture (unreadable): the canvas is shown in the slot, no error", () => {
    const slot = new FakeElement();
    const icon = new FakeCanvas(true);
    assert.doesNotThrow(() => showHotbarIcon(slot, icon));
    assert.equal(slot.children[0], icon);
    assert.ok(icon.classes.has("hotbar-icon"));
});

test("upgrade bar copies either kind of icon", () => {
    const readable = new FakeElement();
    showHotbarIcon(readable, new FakeCanvas(false));
    const up1 = new FakeElement();
    copyHotbarIcon(readable, up1);
    assert.equal(up1.style.backgroundImage, readable.style.backgroundImage);

    const official = new FakeElement();
    const icon = new FakeCanvas(true);
    showHotbarIcon(official, icon);
    const up2 = new FakeElement();
    copyHotbarIcon(official, up2);
    assert.equal(up2.children.length, 1, "a copy of the icon canvas");
    assert.notEqual(up2.children[0], icon, "a copy, the hotbar keeps its own");
    assert.deepEqual(up2.children[0].drawn, [icon]);
});

test("empty slot: nothing copied, no error", () => {
    const up = new FakeElement();
    copyHotbarIcon(new FakeElement(), up);
    assert.equal(up.children.length, 0);
    assert.equal(up.style.backgroundImage, undefined);
});
