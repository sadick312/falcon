import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { default: TaskScheduler } = await loadTs("src/services/event-timer/TaskScheduler.ts");

test("a failing scheduled task doesn't stop later tasks", async () => {
    TaskScheduler.init();
    const ran = [];
    const errors = console.error;
    console.error = () => {}; // the failure is logged on purpose; keep test output clean

    try {
        await new Promise((resolve) => {
            TaskScheduler.setTimeout(() => { throw new Error("boom"); }, 5);
            TaskScheduler.setTimeout(() => ran.push("same batch"), 10);
            setTimeout(() => {
                // Scheduled after the failure: only runs if the scheduler kept going.
                TaskScheduler.setTimeout(() => { ran.push("later"); resolve(); }, 5);
            }, 40);
        });
    } finally {
        console.error = errors;
        TaskScheduler.channel.port1.close(); // let node exit
    }

    assert.deepEqual(ran, ["same batch", "later"]);
});
