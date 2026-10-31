// Overlapping Pathfinder.find calls: each must get its own reply, mapped with its own grid origin.
import { describe, expect, it, vi } from "vitest";

/** Stands in for the A* worker: answers each request, in order, when the test says so. */
const worker = vi.hoisted(() => {
    const listeners: ((ev: { data: unknown }) => void)[] = [];
    const queue: unknown[] = [];

    return {
        queue,
        replyNext(path: { x: number; y: number }[]) {
            const request = queue.shift() as { grid: Uint8Array };
            for (const listener of [...listeners]) listener({ data: { path, grid: request.grid } });
        },
        FakeWorker: class {
            postMessage(message: unknown) { queue.push(message); }
            addEventListener(_type: string, listener: (ev: { data: unknown }) => void) { listeners.push(listener); }
            terminate() { }
        }
    };
});

vi.mock("@services/pathfinding/Pathfinder.worker.js", () => ({ default: worker.FakeWorker }));

describe("Pathfinder", () => {
    it("gives overlapping requests their own replies, in their own coordinates", async () => {
        await import("@core/socket/SocketListener");
        const { default: Pathfinder } = await import("@services/pathfinding/Pathfinder");

        // Far apart, so the two grids have different origins.
        const first = Pathfinder.find({ x: 1000, y: 1000 }, { x: 1300, y: 1000 });
        const second = Pathfinder.find({ x: 5000, y: 5000 }, { x: 5300, y: 5000 });
        expect(worker.queue).toHaveLength(2);

        worker.replyNext([{ x: 1, y: 2 }]);
        worker.replyNext([{ x: 3, y: 4 }]);

        // Points snap down to 30-unit cells (1000 -> 990, 5000 -> 4980); the grid origin is 10 cells before that.
        await expect(first).resolves.toEqual([{ x: 990 - 300 + 30, y: 990 - 300 + 60 }]);
        await expect(second).resolves.toEqual([{ x: 4980 - 300 + 90, y: 4980 - 300 + 120 }]);
    });
});
