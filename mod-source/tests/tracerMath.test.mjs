import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { edgeArrowPoint, isOnScreen } = await loadTs("src/rendering/utils/mod/tracerMath.ts");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("edge arrow sits on the inner edge, pointing at the target", () => {
    // 1000x600 screen, centre (500, 300), margin 40 -> inner box x 40..960, y 40..560
    let [x, y, a] = edgeArrowPoint(500, 300, 3000, 300, 1000, 600, 40); // far right
    near(x, 960); near(y, 300); near(a, 0);
    [x, y, a] = edgeArrowPoint(500, 300, 500, -2000, 1000, 600, 40);   // far up
    near(x, 500); near(y, 40); near(a, -Math.PI / 2);
    [x, y] = edgeArrowPoint(500, 300, 2500, 2300, 1000, 600, 40);      // down-right 45 deg: hits bottom first
    near(y, 560); near(x, 760);
});

test("isOnScreen", () => {
    assert.equal(isOnScreen(10, 10, 100, 100), true);
    assert.equal(isOnScreen(-1, 10, 100, 100), false);
    assert.equal(isOnScreen(101, 50, 100, 100), false);
});
