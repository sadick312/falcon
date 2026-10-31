import GameObject from "@constants/GameObject";
import Player from "@entities/Player";
import Client from "@core/Client.js";
import ObjectManager from "@core/logic/ObjectManager.js";
import PlayerManager from "@core/logic/players/PlayerManager.js";
import { Point } from "@mod-types/index";
import withinDist from "@utils/geometry/withinDist";
import PathfindWorker from "./Pathfinder.worker.js";

export default class Pathfinder {
    private static readonly CELL_SIZE = 15;
    private static readonly DOUBLE_CELL_SIZE = this.CELL_SIZE * 2;

    private static readonly PADDING = 10;
    private static GRID_BOUNDS_BUFFER = [0, 0, 0, 0];

    private static worker: Worker;

    private static calculateGridBounds(start: Point, goal: Point) {
        const cellPadding = this.PADDING * this.DOUBLE_CELL_SIZE;

        const minX = Math.min(start.x, goal.x) - cellPadding;
        const minY = Math.min(start.y, goal.y) - cellPadding;

        const maxX = Math.max(start.x, goal.x) + cellPadding;
        const maxY = Math.max(start.y, goal.y) + cellPadding;

        const xCells = Math.ceil((maxX - minX) / this.DOUBLE_CELL_SIZE);
        const yCells = Math.ceil((maxY - minY) / this.DOUBLE_CELL_SIZE);

        this.GRID_BOUNDS_BUFFER[0] = minX;
        this.GRID_BOUNDS_BUFFER[1] = minY;
        this.GRID_BOUNDS_BUFFER[2] = xCells;
        this.GRID_BOUNDS_BUFFER[3] = yCells;
        return this.GRID_BOUNDS_BUFFER;
    }

    private static MAP_POINTS_BUFFER: Point[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];

    private static mapPoints(start: Point, goal: Point, gridBounds: number[]) {
        const minX = gridBounds[0], minY = gridBounds[1];
        const doubleSize = this.CELL_SIZE * 2;

        const localStart = this.MAP_POINTS_BUFFER[0];
        const localGoal = this.MAP_POINTS_BUFFER[1];

        localStart.x = Math.floor((start.x - minX) / doubleSize);
        localStart.y = Math.floor((start.y - minY) / doubleSize);
        localGoal.x = Math.floor((goal.x - minX) / doubleSize);
        localGoal.y = Math.floor((goal.y - minY) / doubleSize);

        return this.MAP_POINTS_BUFFER;
    }

    private static OBJECT_BOUNDS_BUFFER = [0, 0, 0, 0];

    private static getObjectBounds(obj: GameObject | Player, gridBounds: number[]) {
        const doubleSize = this.DOUBLE_CELL_SIZE;
        const minX = gridBounds[0], minY = gridBounds[1], xCells = gridBounds[2], yCells = gridBounds[3];
        const isGameObject = obj instanceof GameObject;

        const objScale = isGameObject ? obj.getScale() : obj.scale;
        const objX = isGameObject ? obj.x : obj.real_position.x;
        const objY = isGameObject ? obj.y : obj.real_position.y;

        const startX = Math.max(0, Math.floor((objX - objScale - minX) / doubleSize));
        const startY = Math.max(0, Math.floor((objY - objScale - minY) / doubleSize));

        const endX = Math.min(xCells - 1, Math.ceil((objX + objScale - minX) / doubleSize));
        const endY = Math.min(yCells - 1, Math.ceil((objY + objScale - minY) / doubleSize));

        this.OBJECT_BOUNDS_BUFFER[0] = startX;
        this.OBJECT_BOUNDS_BUFFER[1] = startY;
        this.OBJECT_BOUNDS_BUFFER[2] = endX;
        this.OBJECT_BOUNDS_BUFFER[3] = endY;
        return this.OBJECT_BOUNDS_BUFFER;
    }

    /**
     * Requests in the order they were posted, each with its own grid origin. The worker answers one at a time,
     * in order, so each reply belongs to the oldest pending request. (A `once` listener per request made every
     * pending request take the first reply, and map it with its own, different origin.)
     */
    private static pending: { minX: number; minY: number; resolve: (path: Point[]) => void }[] = [];

    private static initWorker() {
        this.worker = new PathfindWorker();
        this.worker.addEventListener("message", (ev) => {
            const request = this.pending.shift();
            if (!request) return;

            const pathData = ev.data as { path: Point[], grid: Uint8Array };
            const doubleSize = this.DOUBLE_CELL_SIZE;
            request.resolve(pathData.path.map(p => ({
                x: request.minX + (p.x * doubleSize),
                y: request.minY + (p.y * doubleSize)
            })));
        });
    }

    private static PARSED_START_BUFFER = { x: 0, y: 0 };
    private static PARSED_END_BUFFER = { x: 0, y: 0 };

    static async find(start: Point, goal: Point): Promise<Point[]> {
        if (!this.worker) this.initWorker();

        // parse the start/end so that pathfinding becomes consistent regardless of start/end positions
        // basically it acts like the entire map is already "grided"
        const parsedStart = this.PARSED_START_BUFFER;
        const parsedEnd = this.PARSED_END_BUFFER;

        parsedStart.x = this.DOUBLE_CELL_SIZE * ((start.x / this.DOUBLE_CELL_SIZE) | 0);
        parsedStart.y = this.DOUBLE_CELL_SIZE * ((start.y / this.DOUBLE_CELL_SIZE) | 0);
        parsedEnd.x = this.DOUBLE_CELL_SIZE * ((goal.x / this.DOUBLE_CELL_SIZE) | 0);
        parsedEnd.y = this.DOUBLE_CELL_SIZE * ((goal.y / this.DOUBLE_CELL_SIZE) | 0);

        const doubleSize = this.CELL_SIZE * 2;
        const gridBounds = this.calculateGridBounds(parsedStart, parsedEnd);
        const minX = gridBounds[0], minY = gridBounds[1], xCells = gridBounds[2], yCells = gridBounds[3];
        const grid = new Uint8Array(xCells * yCells);

        const mapBuf = this.mapPoints(parsedStart, parsedEnd, gridBounds);;
        const localStart = mapBuf[0], localGoal = mapBuf[1];
        const closeObjects = ObjectManager.pool.closeObjects;
        const cellWorldPos = { x: 0, y: 0 };

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const obj = closeObjects[i];
            if (!obj || obj.ignoreCollision) continue;

            const radius = obj.getScale() + this.CELL_SIZE;
            const buf = this.getObjectBounds(obj, gridBounds);
            const startX = buf[0], startY = buf[1], endX = buf[2], endY = buf[3];

            for (let y = startY; y <= endY; y++) {
                const yOffset = y * xCells;

                for (let x = startX; x <= endX; x++) {
                    cellWorldPos.x = minX + x * doubleSize;
                    cellWorldPos.y = minY + y * doubleSize;

                    if (withinDist(cellWorldPos, obj, radius)) {
                        grid[yOffset + x] = 1;
                    }
                }
            }
        }

        const players = PlayerManager.players.visible.all;
        for (let i = 0, len = players.length; i < len; i++) {
            const player = players[i];
            if (!player || player.sid === Client.mySID) continue;

            const radius = 35 + this.CELL_SIZE;
            const buf = this.getObjectBounds(player, gridBounds);
            const startX = buf[0], startY = buf[1], endX = buf[2], endY = buf[3];

            for (let y = startY; y <= endY; y++) {
                const yOffset = y * xCells;

                for (let x = startX; x <= endX; x++) {
                    cellWorldPos.x = minX + x * doubleSize;
                    cellWorldPos.y = minY + y * doubleSize;

                    if (withinDist(cellWorldPos, player.real_position, radius)) {
                        grid[yOffset + x] = 2;
                    }
                }
            }
        }

        return new Promise((resolve) => {
            this.pending.push({ minX, minY, resolve });

            this.worker.postMessage({
                grid,
                xCells,
                yCells,
                start: localStart,
                goal: localGoal
            }, [grid.buffer]);
        });
    }
}