// Run with: npm test --workspace=mod-source
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const cfg = await loadTs("src/rendering/RenderingConfig.ts");
const RenderingConfig = cfg.default;

test("starts at the old Falcon view (125% of 1920x1080)", () => {
    assert.equal(cfg.ZOOM_DEFAULT, 125);
    assert.equal(RenderingConfig.maxScreenWidth, 2400);
    assert.equal(RenderingConfig.maxScreenHeight, 1350);
});

test("View Distance is limited to 75%..250% and bad saved values fall back to 125%", () => {
    assert.equal(cfg.clampZoom(10), 75);
    assert.equal(cfg.clampZoom(9999), 250);
    assert.equal(cfg.clampZoom("150"), 150, "slider values arrive as text");
    assert.equal(cfg.clampZoom(undefined), 125, "old configs have no View Distance");
    assert.equal(cfg.clampZoom("abc"), 125);
    assert.equal(cfg.clampZoom(NaN), 125);
});

test("setZoom sizes the view and keeps the 16:9 shape", () => {
    assert.equal(cfg.setZoom(200), 200);
    assert.equal(RenderingConfig.maxScreenWidth, 3840);
    assert.equal(RenderingConfig.maxScreenHeight, 2160);
    assert.equal(cfg.setZoom(1e9), 250, "can't zoom out forever (FPS)");
    assert.equal(RenderingConfig.maxScreenWidth, 4800);
    cfg.setZoom(cfg.ZOOM_DEFAULT);
});
