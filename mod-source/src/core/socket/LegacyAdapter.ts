/**
 * Converts 1.8.2 packet layouts into the layouts Falcon's handlers were written for (1.9.x),
 * so the rest of the client doesn't need to know which protocol is in use.
 *
 * New arrays are created per packet on purpose: PacketBatcher may hold several packets
 * before flushing, so reusing buffers would overwrite data that hasn't been processed yet.
 * That's ~9 small allocations per second, which is negligible.
 */
export default class LegacyAdapter {
    private static visiblePlayers = new Set<number>();
    private static visibleAis = new Set<number>();

    /**
     * 1.8.2 "a": one flat array, 13 values per player:
     *   sid, x, y, dir, buildIndex, weaponIndex, weaponVariant, team, isLeader, skin, tail, icon, zIndex
     * Falcon "a": [positions (sid, x, y, dir*100), attributes (sid + 9 values), hidden sids]
     */
    static players(data: any[]): [number[], any[], number[]] {
        const positions: number[] = [];
        const attributes: any[] = [];
        const seen = new Set<number>();

        for (let i = 0; i + 12 < data.length; i += 13) {
            const sid = data[i];
            seen.add(sid);

            // Falcon divides direction by 100 (1.9 sends it pre-multiplied).
            positions.push(sid, data[i + 1], data[i + 2], data[i + 3] * 100);
            attributes.push(
                sid, data[i + 4], data[i + 5], data[i + 6], data[i + 7],
                data[i + 8], data[i + 9], data[i + 10], data[i + 11], data[i + 12]
            );
        }

        return [positions, attributes, this.diffHidden(this.visiblePlayers, seen)];
    }

    /**
     * 1.8.2 "I": flat array, 7 values per animal: sid, index, x, y, dir, health, nameIndex
     * Falcon "I": [data (8 values, dir*100), hidden sids]
     */
    static ais(data: any[] | null): [number[], number[]] {
        const out: number[] = [];
        const seen = new Set<number>();

        if (data) {
            for (let i = 0; i + 6 < data.length; i += 7) {
                seen.add(data[i]);
                out.push(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4] * 100, data[i + 5], data[i + 6], 0);
            }
        }

        return [out, this.diffHidden(this.visibleAis, seen)];
    }

    /** Sids that were visible last update but aren't now. Updates the stored set. */
    private static diffHidden(previous: Set<number>, current: Set<number>) {
        const hidden: number[] = [];
        for (const sid of previous) if (!current.has(sid)) hidden.push(sid);

        previous.clear();
        for (const sid of current) previous.add(sid);
        return hidden;
    }

    static reset() {
        this.visiblePlayers.clear();
        this.visibleAis.clear();
    }
}
