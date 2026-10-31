import items, { LIST_ID_MAP } from "@constants/items";
import Client from "@core/Client";
import ModManager from "@core/ModManager";
import withinDist from "@utils/geometry/withinDist";

export class PotentialObject {
    active: boolean = true;
    ticksOut = 0;
    isBreaking = false;
    willBreak = false;
    totalDamagePotential = 0;
    isFakeObject = true;

    readonly scale = 50;

    static readonly maxHealth = items.list[LIST_ID_MAP.PIT_TRAP].health!;
    health = PotentialObject.maxHealth;

    constructor(
        public x: number,
        public y: number,
        public ownerSID: number,
        public tick: number
    ) { }

    public redefine(x: number, y: number, ownerSID: number, tick: number): void {
        this.x = x;
        this.y = y;
        this.ownerSID = ownerSID;
        this.isBreaking = false;
        this.totalDamagePotential = 0;
        this.tick = tick;
        this.active = true;
        this.ticksOut = 0;
        this.willBreak = false;
        this.health = PotentialObject.maxHealth;
    }
}

export default class PotentialObjectManager {
    static allObjects: PotentialObject[] = [];
    static closeObjects: PotentialObject[] = [];
    static onRenderObjects: PotentialObject[] = [];

    private static tmpPos = { x: 0, y: 0 };
    /** Where add() last found an object in range. Adds come from neighbouring angles, so the next match is usually close by. */
    private static lastMatchIndex = 0;

    static update(x: number, y: number, scale: number) {
        const allObjects = this.allObjects;
        const radius = 50 + scale;
        const pos = this.tmpPos;

        pos.x = x;
        pos.y = y;

        for (let i = 0; i < allObjects.length; i++) {
            const obj = allObjects[i];
            if (!obj || !obj.active) continue;

            if (withinDist(obj, pos, radius)) {
                obj.active = false;
            }
        }
    }

    static remove(ownerSID: number) {
        const allObjects = this.allObjects;

        for (let i = 0; i < allObjects.length; i++) {
            const obj = allObjects[i];
            if (!obj) continue;
            if (obj.ownerSID !== ownerSID) continue;
            obj.active = false;
        }
    }

    static add(x: number, y: number, ownerSID: number) {
        const allObjects = this.allObjects;
        const length = allObjects.length;
        const pos = this.tmpPos;

        pos.x = x;
        pos.y = y;

        // Any active object in range stops the add, so the scan can start where the last one was found.
        const start = this.lastMatchIndex < length ? this.lastMatchIndex : 0;
        for (let n = 0; n < length; n++) {
            const i = start + n < length ? start + n : start + n - length;
            const obj = allObjects[i];

            if (obj && obj.active && withinDist(obj, pos, 100)) {
                this.lastMatchIndex = i;
                return;
            }
        }

        for (let i = 0; i < length; i++) {
            const obj = allObjects[i];

            if (obj && !obj.active) {
                obj.redefine(x, y, ownerSID, ModManager.tick);
                return;
            }
        }

        allObjects.push(new PotentialObject(x, y, ownerSID, ModManager.tick));
    }

    static query() {
        const allObjects = this.allObjects;
        const closeObjects = this.closeObjects;
        const onRenderObjects = this.onRenderObjects;

        onRenderObjects.length = 0;
        closeObjects.length = 0;

        const player = Client.player;
        for (let i = 0; i < allObjects.length; i++) {
            const obj = allObjects[i];
            if (!obj || !obj.active) continue;

            if (!withinDist(player.real_position, obj, 800)) {
                obj.ticksOut++;
                if (obj.ticksOut >= 9 * 10) obj.active = false;
                continue;
            } else {
                obj.ticksOut = 0;
                onRenderObjects.push(obj);
            }

            if (!withinDist(player.real_position, obj, 200)) continue;
            closeObjects.push(obj);
        }
    }
}