// Entry for the bundled replay (replay.ts, bundle mode): esbuild bundles the mod from here like the real build, so the
// benchmark runs code shaped like production instead of Vitest's per-module transform, which turns every imported
// name into a property lookup. Same load order as replay.ts's module mode.
export * as profiler from "@services/profiler/Profiler";
import "@core/socket/SocketListener";
export { default as Menu } from "@menu/Menu";
export { default as Client } from "@core/Client";
export { default as AngleFinder } from "@placing/AngleFinder";
