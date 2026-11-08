// Checks noUncheckedIndexedAccess for the parts of the mod that have been converted to it.
//
// The flag can only be set for a whole TypeScript project, and every file reaches the hot per-tick code (combat,
// defense, simulation, rendering) through its imports, so turning it on in tsconfig.json would report ~1,300 errors
// there at once. Instead this runs tsc with the flag and fails only on errors inside OPTED_IN. Add a folder or file
// here once its errors are fixed properly (a real check, not `!` or `any`); the hot code is converted last, carefully,
// because extra checks in its loops cost time.
//
// Usage: node scripts/check-indexed-access.mjs   (also part of `npm run typecheck`)
import { spawnSync } from "child_process";
import { resolve } from "path";

const OPTED_IN = [
    "src/ui/",
    "src/core/menu/",
    "src/core/events/",
    "src/core/PacketReplayer.ts",
    "src/core/utils/ChatCommands.ts",
    "src/core/utils/GameVersionCheck.ts",
    "src/core/utils/ProtocolLoader.ts",
    "src/core/utils/PacketTracker.ts",
    "src/core/mod/utils/PingTracker.ts",
    "src/core/socket/events/core/HealthUpdateEvent.ts",
    "src/core/logic/players/PlayerEntityHandler.ts",
    "src/utils/constants/EntityHandler.ts",
    "src/services/",
    "src/utils/constants/items.ts",
    "src/utils/constants/store.ts"
];

const root = resolve(import.meta.dirname, "..");
const tsc = resolve(root, "node_modules/typescript/bin/tsc");
const result = spawnSync(process.execPath, [tsc, "--noEmit", "-p", "mod-source", "--noUncheckedIndexedAccess"], { cwd: root, encoding: "utf8" });

const errors = result.stdout.split("\n").filter((line) => /error TS\d+/.test(line));
const ours = errors.filter((line) => {
    const file = line.replace(/^mod-source\//, "").replace(/\\/g, "/");
    return OPTED_IN.some((prefix) => file.startsWith(prefix));
});

if (ours.length) {
    console.error(ours.join("\n"));
    console.error(`\n${ours.length} noUncheckedIndexedAccess error(s) in opted-in files (${errors.length} in the whole mod).`);
    process.exit(1);
}

console.log(`noUncheckedIndexedAccess: opted-in files clean (${errors.length} errors left in files not opted in yet).`);
