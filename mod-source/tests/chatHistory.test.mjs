import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { default: ChatHistory, canQuickChat, QUICK_CHAT_COOLDOWN_MS } = await loadTs("src/core/ChatHistory.ts");

test("Up goes to older messages, Down back to newer and then the line being typed", () => {
    const h = new ChatHistory();
    h.add("hi"); h.add("gg"); h.add("help");
    h.resetBrowsing();

    assert.equal(h.older("typing..."), "help");
    assert.equal(h.older(""), "gg");
    assert.equal(h.older(""), "hi");
    assert.equal(h.older(""), null);         // nothing older
    assert.equal(h.newer(), "gg");
    assert.equal(h.newer(), "help");
    assert.equal(h.newer(), "typing...");    // back to what you were typing
    assert.equal(h.newer(), null);
});

test("empty and repeated messages aren't saved; only the last 30 are kept", () => {
    const h = new ChatHistory();
    h.add("   "); h.add("gg"); h.add("gg");
    assert.equal(h.size, 1);

    for (let i = 0; i < 40; i++) h.add(`m${i}`);
    assert.equal(h.size, ChatHistory.MAX);
    h.resetBrowsing();
    assert.equal(h.older(""), "m39");
});

test("quick chat cooldown", () => {
    assert.equal(canQuickChat(5000, 4500), false);
    assert.equal(canQuickChat(5000, 5000 - QUICK_CHAT_COOLDOWN_MS), true);
});
