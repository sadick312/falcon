/**
 * `list[index]` for an index that is always in range (a ring buffer position, a fixed slot). Throws if it isn't, just
 * as reading a field of the missing entry would; used where skipping the entry would hide a real mistake.
 */
export function at<T>(list: readonly T[], index: number): T {
    const value = list[index];
    if (value === undefined) throw new RangeError(`Index ${index} is outside a list of ${list.length}`);
    return value;
}
