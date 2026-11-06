// Replay benchmark (mod-source/bench): the test setup with __DEV__ on, so the profiler's timing code is kept.
import { defineConfig } from "vitest/config";
import base from "./vitest.config.mts";

export default defineConfig({
    ...base,
    define: { ...base.define, __DEV__: "true" },
    test: {
        ...base.test,
        // Replaces the unit-test include instead of adding to it.
        include: ["mod-source/bench/**/*.bench-run.ts"],
        // Builds the bundle replay.ts's bundle mode loads.
        globalSetup: ["mod-source/bench/build-bundle.mjs"],
        testTimeout: 0
    }
});
