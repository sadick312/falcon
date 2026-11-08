import { GAME_V182 } from "@constants/gameVersion";
import { at } from "@utils/array/at";
import PacketMap, { WireValue } from "@root/utils/socket/PacketMap";

const LEGACY_PLAYER_STRIDE = GAME_V182.playerStride;
const LEGACY_AI_STRIDE = GAME_V182.aiStride;
const ATTRIBUTE_COUNT = GAME_V182.attributeCount;

/**
 * Converts the v1.8.2 packets whose layout changed in v1.9.0 into the v1.9.0 layout the
 * event handlers parse, so the handlers and the combat code stay version-agnostic.
 *
 * v1.8.2 sends every visible player/ai in one flat array each tick, with plain radians.
 * v1.9.0 splits players into positions (dir * 100) + changed attributes, and lists the
 * sids that went out of view. This class rebuilds both from the flat array.
 */
export default class LegacyPacketAdapter {
    private visiblePlayers = new Set<number>();
    private visibleAis = new Set<number>();
    private lastAttributes = new Map<number, number[]>();

    adapt(type: string, data: WireValue[] | undefined): WireValue[] | undefined {
        const first = Array.isArray(data) ? data[0] : undefined;

        switch (type) {
            case PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS:
                return this.adaptPlayers(Array.isArray(first) ? first : []);
            case PacketMap.SERVER_TO_CLIENT.LOAD_AI:
                return this.adaptAis(Array.isArray(first) ? first : []);
            case PacketMap.SERVER_TO_CLIENT.ADD_PLAYER:
                // A (re)spawned player must get a full attribute entry on its next update.
                if (Array.isArray(first)) this.lastAttributes.delete(first[1]);
                return data;
            default:
                return data;
        }
    }

    /** [sid, x, y, dir, ...9 attributes] * n  ->  [positions(sid, x, y, dir*100), attributes(sid, ...9), hidden] */
    private adaptPlayers(flat: number[]): [number[], number[], number[]] {
        const positions: number[] = [];
        const attributes: number[] = [];
        const current = new Set<number>();

        for (let i = 0; i + LEGACY_PLAYER_STRIDE <= flat.length; i += LEGACY_PLAYER_STRIDE) {
            const sid = at(flat, i);
            current.add(sid);
            positions.push(sid, at(flat, i + 1), at(flat, i + 2), at(flat, i + 3) * 100);

            // v1.9.0 only sends attributes that changed, and the handler relies on that
            // (e.g. lastSkinIndex keeps the previous hat), so only emit changed entries.
            const prev = this.lastAttributes.get(sid);
            let changed = !prev || !this.visiblePlayers.has(sid);

            for (let k = 0; !changed && k < ATTRIBUTE_COUNT; k++) {
                if (prev![k] !== flat[i + 4 + k]) changed = true;
            }

            if (!changed) continue;

            const values = flat.slice(i + 4, i + 4 + ATTRIBUTE_COUNT);
            this.lastAttributes.set(sid, values);
            attributes.push(sid, ...values);
        }

        const hidden = this.leftView(this.visiblePlayers, current);
        this.visiblePlayers = current;
        return [positions, attributes, hidden];
    }

    /** [sid, index, x, y, dir, health, nameIndex] * n  ->  [(sid, index, x, y, dir*100, health, nameIndex, 0) * n, hidden] */
    private adaptAis(flat: number[]): [number[], number[]] {
        const data: number[] = [];
        const current = new Set<number>();

        for (let i = 0; i + LEGACY_AI_STRIDE <= flat.length; i += LEGACY_AI_STRIDE) {
            const sid = at(flat, i);
            current.add(sid);
            data.push(sid, at(flat, i + 1), at(flat, i + 2), at(flat, i + 3), at(flat, i + 4) * 100, at(flat, i + 5), at(flat, i + 6), 0);
        }

        const hidden = this.leftView(this.visibleAis, current);
        this.visibleAis = current;
        return [data, hidden];
    }

    private leftView(before: Set<number>, now: Set<number>) {
        const hidden: number[] = [];
        for (const sid of before) {
            if (!now.has(sid)) hidden.push(sid);
        }

        return hidden;
    }
}
