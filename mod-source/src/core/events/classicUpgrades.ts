import items from "@constants/items";

/**
 * Classic upgrades (1.6.9 style): any age 8 weapon followed by any age 9 weapon, e.g. katana + musket.
 *
 * Verified on the sandbox server (UPGRADES.md, section 9): it gives a weapon when its `age` equals the current upgrade
 * age and never checks `pre`. So everything here is read from `items.weapons` (id, type, age): a new weapon needs only
 * a new row there.
 */
export const CLASSIC_AGES = [8, 9] as const;

export interface ClassicCombo {
    /** Menu value: age 8 weapon id * 100 + age 9 weapon id. */
    value: number;
    label: string;
    /** The weapon to send at each of CLASSIC_AGES, in that order. */
    picks: readonly number[];
}

const title = (name: string) => name.replace(/\b\w/g, c => c.toUpperCase());

function buildCombos(): ClassicCombo[] {
    const [age8, age9] = CLASSIC_AGES.map(age => items.weapons.filter(w => w.age === age));
    const combos: ClassicCombo[] = [];

    for (const first of age8!) {
        for (const second of age9!) {
            // Same slot (crossbow, then musket): the second replaces the first and the other slot is kept.
            const label = first.type === second.type
                ? `Keep ${second.type === 0 ? "Secondary" : "Primary"} + ${title(second.name)} (via ${title(first.name)})`
                : first.type === 0 ? `${title(first.name)} + ${title(second.name)}` : `${title(second.name)} + ${title(first.name)}`;
            combos.push({ value: first.id * 100 + second.id, label, picks: [first.id, second.id] });
        }
    }
    return combos;
}

/** Every combo the server accepts, built once from the weapon table. */
export const CLASSIC_COMBOS: readonly ClassicCombo[] = buildCombos();

/** The combo for a Menu value, or undefined for "None" (-1) and anything unknown (an old or edited config). */
export function comboFromValue(value: number): ClassicCombo | undefined {
    return CLASSIC_COMBOS.find(combo => combo.value === value);
}

/**
 * The weapon to send for `picks` when an upgrade point for `age` arrives, or undefined: no pick is for this age, or
 * it's already owned (so a repeated or late upgrade packet sends nothing twice).
 */
export function planClassicPick(picks: readonly number[], age: number, ownedWeapons: readonly number[]): number | undefined {
    const id = picks.find(pick => items.weapons[pick]?.age === age);
    return id === undefined || ownedWeapons.includes(id) ? undefined : id;
}

/**
 * The combos to show as buttons at `age`: those with a pick for this age not owned yet, whose picks for earlier
 * classic ages are all owned (at age 9 after a katana: only the katana combos).
 */
export function combosAt(age: number, ownedWeapons: readonly number[]): ClassicCombo[] {
    return CLASSIC_COMBOS.filter(combo =>
        planClassicPick(combo.picks, age, ownedWeapons) !== undefined &&
        combo.picks.every(pick => (items.weapons[pick]?.age ?? age) >= age || ownedWeapons.includes(pick)));
}
