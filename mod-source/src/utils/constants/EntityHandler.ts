import { Entity } from "./Entity";

export default class EntityHandler<T extends Entity> {
    private entitiesMap: Map<number, T> = new Map();
    private entitiesList: T[] = [];

    constructor(private type: 0 | 1 = 0) { }

    add(entity: T) {
        if (this.entitiesMap.has(entity.sid)) return;

        if (this.type === 0) {
            entity.listHandlerIndex = this.entitiesList.length;
        } else {
            entity.turretHandlerIndex = this.entitiesList.length;
        }

        this.entitiesMap.set(entity.sid, entity);
        this.entitiesList.push(entity);
    }

    /** Puts `entity` in place of the one with the same sid (same list position), or adds it if there is none. */
    replace(entity: T) {
        const old = this.entitiesMap.get(entity.sid);
        if (!old) {
            this.add(entity);
            return;
        }

        if (this.type === 0) {
            entity.listHandlerIndex = old.listHandlerIndex;
            this.entitiesList[old.listHandlerIndex] = entity;
        } else {
            entity.turretHandlerIndex = old.turretHandlerIndex;
            this.entitiesList[old.turretHandlerIndex] = entity;
        }

        this.entitiesMap.set(entity.sid, entity);
    }

    get(sid: number) {
        return this.entitiesMap.get(sid);
    }

    has(sid: number) {
        return this.entitiesMap.has(sid);
    }

    remove(sid: number) {
        const entity = this.get(sid);
        if (!entity) return;

        this.entitiesMap.delete(sid);

        const index = this.type === 0 ? entity.listHandlerIndex : entity.turretHandlerIndex;
        // Move the last entity into the removed one's place (a no-op when it was the last one).
        const lastEntity = this.entitiesList.pop();
        if (!lastEntity || lastEntity === entity) return;
        this.entitiesList[index] = lastEntity;

        if (this.type === 0) {
            lastEntity.listHandlerIndex = index;
        } else {
            lastEntity.turretHandlerIndex = index;
        }
    }

    removeAll() {
        this.entitiesList.length = 0;
        this.entitiesMap.clear();
    }

    get all() { return this.entitiesList };
}