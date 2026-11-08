// Pathfinder benchmark: the main-thread grid build (Pathfinder.find, with the worker stubbed so nothing is sent) and
// the worker's A* search (Pathfinder.worker.js, run here with a stand-in `self`). Writes results/pathfinder.json.
// Best of 5 rounds, like packets.bench-run.ts.
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { it, vi } from "vitest";
import { benchDir } from "./replay";

const posted = vi.hoisted(() => ({ last: null as null | { grid: Uint8Array; xCells: number; yCells: number; start: unknown; goal: unknown } }));
vi.mock("@services/pathfinding/Pathfinder.worker.js", () => ({
    default: class {
        postMessage(message: typeof posted.last) { posted.last = message; }
        addEventListener() { }
        terminate() { }
    }
}));

function time(name: string, calls: number, fn: () => void) {
    for (let i = 0; i < Math.max(1, calls / 10); i++) fn();
    let best = Infinity;
    for (let round = 0; round < 5; round++) {
        const start = performance.now();
        for (let i = 0; i < calls; i++) fn();
        best = Math.min(best, performance.now() - start);
    }
    return { name, usPerCall: (best / calls) * 1000, callsPerRound: calls };
}

/** Loads the worker script with a stand-in `self` and returns a function that runs one search on it. */
function loadWorker() {
    const source = fs.readFileSync(path.join(benchDir, "..", "src", "services", "pathfinding", "Pathfinder.worker.js"), "utf8");
    const self: { onmessage?: (ev: { data: unknown }) => void; postMessage: (msg: { path: unknown[] }) => void } = { postMessage: (msg) => { lastPath = msg.path; } };
    let lastPath: unknown[] = [];
    new Function("self", source)(self);
    return (data: unknown) => { self.onmessage!({ data }); return lastPath; };
}

it("pathfinder", async () => {
    localStorage.setItem("falcon-host-mode", "moomodding");
    await import("@core/socket/SocketListener");
    const { default: Pathfinder } = await import("@services/pathfinding/Pathfinder");
    const { default: ObjectManager } = await import("@core/logic/ObjectManager");
    const { default: Client } = await import("@core/Client");
    Client.mySID = 1;

    // A field of trees and walls between start and goal, like a base: 40 objects in a 1350 × 390 area.
    // Fields as LOAD_GAME_OBJECT sends them: a tree has type 0 and no item id, a wall no type and item id 3.
    const none = null as unknown as number;
    for (let i = 0; i < 40; i++) {
        const isTree = i % 5 === 0;
        ObjectManager.add(1000 + i, 1250 + (i % 10) * 150, 1260 + Math.floor(i / 10) * 130, 0, isTree ? 140 : 50, isTree ? 0 : none, isTree ? none : 3, true, isTree ? none : 2);
    }

    // find() reads the per-tick list of nearby objects, which a real tick fills from the chunks around us.
    ObjectManager.pool.closeObjects.push(...ObjectManager.allObjects);

    const start = { x: 1000, y: 1500 };
    const goal = { x: 2900, y: 1500 };
    const runSearch = loadWorker();

    const buildGrid = () => { void Pathfinder.find(start, goal); };
    buildGrid();
    const request = posted.last!;
    const grid = request.grid.slice();
    const pathLength = runSearch({ ...request, grid: grid.slice() }).length;
    const blocked = grid.reduce((n, cell) => n + (cell === 1 ? 1 : 0), 0);
    if (blocked === 0 || pathLength === 0) throw new Error(`benchmark scene is wrong: ${blocked} blocked cells, path of ${pathLength}`);

    const rows = [
        time(`Pathfinder.find: build the ${request.xCells}×${request.yCells} grid (40 objects, ${blocked} blocked cells)`, 2_000, buildGrid),
        time(`worker A*: ${request.xCells}×${request.yCells} grid, path of ${pathLength} cells`, 2_000, () => { runSearch({ ...request, grid: grid.slice() }); })
    ];

    fs.mkdirSync(path.join(benchDir, "results"), { recursive: true });
    fs.writeFileSync(path.join(benchDir, "results", "pathfinder.json"), JSON.stringify({ date: new Date().toISOString(), rows }, null, 2));
}, 120_000);
