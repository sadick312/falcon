// Run with: npm test --workspace=mod-source
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { default: EntityHandler } = await loadTs("src/utils/constants/EntityHandler.ts");

test("add/remove keep list and lookups consistent", () => {
    const h = new EntityHandler();
    const ents = [1, 2, 3, 4, 5].map(sid => ({ sid }));
    ents.forEach(e => h.add(e));
    h.remove(2); h.remove(5); h.remove(1);
    assert.deepEqual(h.all.map(e => e.sid).sort(), [3, 4]);
    assert.equal(h.get(2), undefined);
    h.all.forEach((e, i) => assert.equal(e.listHandlerIndex, i, "every entity knows its own index"));
});
