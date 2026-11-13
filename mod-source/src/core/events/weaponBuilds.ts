import { WEAPON_ID_MAP } from "@constants/items";

const W = WEAPON_ID_MAP;

interface WeaponBuild {
    label: string;
    /** age -> weapon id to pick at that age */
    ages: Record<number, number>;
    /**
     * Send the pick even if the game wouldn't offer it (its "pre" weapon isn't owned).
     * The sandbox server doesn't check "pre" (verified live 2026-11-12: Katana at age 8, then
     * Musket at age 9 with no Crossbow -> weapons [4, 15]). The normal game would refuse it.
     */
    skipPre?: boolean;
}

/**
 * Auto Upgrade weapon builds: age -> weapon id to pick at that age.
 * 1.8.2 gives ONE upgrade per age. In the normal game age 8 offers Great Axe / Katana (primary)
 * OR Crossbow (secondary), and Musket / Repeater (age 9) need the Crossbow. Builds without
 * `skipPre` follow those rules; tests/weaponBuilds.test.mjs checks them.
 */
export const WEAPON_BUILDS: Record<string, WeaponBuild> = {
    polearmMusket: { label: "Polearm + Musket", ages: { 2: W.POLEARM, 6: W.HUNTING_BOW, 8: W.CROSSBOW, 9: W.MUSKET } },
    katanaMusket: { label: "Katana + Musket (sandbox)", ages: { 2: W.SHORT_SWORD, 6: W.HUNTING_BOW, 8: W.KATANA, 9: W.MUSKET }, skipPre: true },
    swordMusket: { label: "Short Sword + Musket", ages: { 2: W.SHORT_SWORD, 6: W.HUNTING_BOW, 8: W.CROSSBOW, 9: W.MUSKET } },
    axeMusket: { label: "Hand Axe + Musket", ages: { 2: W.HAND_AXE, 6: W.HUNTING_BOW, 8: W.CROSSBOW, 9: W.MUSKET } },
    polearmRepeater: { label: "Polearm + Repeater Crossbow", ages: { 2: W.POLEARM, 6: W.HUNTING_BOW, 8: W.CROSSBOW, 9: W.REPEATER_CROSSBOW } },
    katanaHammer: { label: "Katana + Great Hammer", ages: { 2: W.SHORT_SWORD, 6: W.GREAT_HAMMER, 8: W.KATANA } },
    katanaBow: { label: "Katana + Hunting Bow", ages: { 2: W.SHORT_SWORD, 6: W.HUNTING_BOW, 8: W.KATANA } },
    greatAxeHammer: { label: "Great Axe + Great Hammer", ages: { 2: W.HAND_AXE, 6: W.GREAT_HAMMER, 8: W.GREAT_AXE } },
    greatAxeBow: { label: "Great Axe + Hunting Bow", ages: { 2: W.HAND_AXE, 6: W.HUNTING_BOW, 8: W.GREAT_AXE } },
    polearmHammer: { label: "Polearm + Great Hammer", ages: { 2: W.POLEARM, 6: W.GREAT_HAMMER } },
};

/** Weapon to auto-pick for this build at this age (undefined = no preference). */
export function wantedWeapon(build: string, age: number): number | undefined {
    return WEAPON_BUILDS[build]?.ages[age];
}

/**
 * With "Show Every Upgrade", these ages also show a few earlier weapons, in case you skipped them:
 * age 9 also offers the Katana (age 8). Great Axe and Crossbow are left out on purpose (the player
 * didn't want them at age 9). Weapons you own are left out.
 */
export const CARRY_OVER_WEAPONS: Readonly<Record<number, readonly number[]>> = { 9: [W.KATANA] };

/**
 * Which weapons the upgrade bar shows at `age`. `legal` = what the normal game offers (a weapon's
 * "pre" must be owned; every weapon on private servers). With `anyPre` (Show Every Upgrade,
 * on moomodding) `shown` also has the rest of that age's weapons, e.g. the Musket after a Katana,
 * plus the earlier weapons in CARRY_OVER_WEAPONS, like old MooMoo. Auto Upgrade keeps deciding
 * from `legal`, so its picks don't change.
 */
export function weaponOffers(age: number, weapons: readonly { age?: number; pre?: number }[], owned: readonly number[], anyPre: boolean, allLegal = false) {
    const shown: number[] = [];
    const legal: number[] = [];
    const carryOver = anyPre ? CARRY_OVER_WEAPONS[age] ?? [] : [];

    for (let i = 0; i < weapons.length; i++) {
        const wpn = weapons[i];

        if (wpn.age !== age) {
            if (carryOver.includes(i) && !owned.includes(i)) shown.push(i);
            continue;
        }

        const isLegal = allLegal || wpn.pre === undefined || owned.includes(wpn.pre);
        if (isLegal) legal.push(i);
        if (isLegal || anyPre) shown.push(i);
    }

    return { shown, legal };
}

/**
 * The weapon Auto Upgrade should send for this build at this age, or undefined to fall back to
 * the normal item choices. `offered` = upgrade ids the game shows; `weaponAge` = a weapon's age.
 */
export function buildUpgradePick(build: string, age: number, offered: readonly number[], weaponAge: (id: number) => number | undefined): number | undefined {
    const wanted = wantedWeapon(build, age);
    if (wanted === undefined) return undefined;
    if (offered.includes(wanted)) return wanted;
    if (WEAPON_BUILDS[build]?.skipPre && weaponAge(wanted) === age) return wanted;
    return undefined;
}

/** "Choose Ages 8 & 9 Yourself": Auto Upgrade leaves these ages to you (the bar stays open). */
export const MANUAL_PICK_AGES: readonly number[] = [8, 9];

/**
 * Should Auto Upgrade decide this age? (false = show the upgrade bar and let the player click)
 * `manualAllAges` = "Choose Every Age Yourself" (like the old game: you pick everything).
 */
export function autoPicksAge(age: number, manualAges89: boolean, manualAllAges = false) {
    if (manualAllAges) return false;
    return !(manualAges89 && MANUAL_PICK_AGES.includes(age));
}

/**
 * Which items the upgrade bar shows at `age`. In the data an item's "pre" is relative
 * (Castle Wall pre 1 = Stone Wall, id 5 - 1). `legal` = what the normal game offers (the earlier
 * item is owned); with `anyPre` ("Show Every Upgrade", moomodding) `shown` also has the rest,
 * e.g. Castle Wall without Stone Wall. Returned ids are item list indexes.
 */
export function itemOffers(age: number, list: readonly { id: number; age?: number; pre?: number }[], ownedItems: readonly number[], anyPre: boolean) {
    const shown: number[] = [];
    const legal: number[] = [];

    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item.age !== age) continue;

        const isLegal = item.pre === undefined || ownedItems.includes(item.id - item.pre);
        if (isLegal) legal.push(i);
        if (isLegal || anyPre) shown.push(i);
    }

    return { shown, legal };
}

/**
 * The build after `current` for the "Next Weapon Build" hotkey. Goes through every build in menu
 * order and wraps around; from "manual" (or an unknown value) it starts at the first build.
 */
export function nextWeaponBuild(current: string): string {
    const ids = Object.keys(WEAPON_BUILDS);
    const index = ids.indexOf(current);
    return ids[(index + 1) % ids.length];
}

/**
 * Does the player own upgrade `id`? Upgrade ids below `weaponCount` are weapons (compared with the
 * owned weapon ids); higher ids are items (`id - weaponCount` = item id).
 */
export function ownsUpgrade(id: number, weaponCount: number, weapons: readonly number[], items: readonly number[]) {
    return id < weaponCount ? weapons.includes(id) : items.includes(id - weaponCount);
}

/** One "old MooMoo" combo button: the weapon to take at age 8 and the one to take at age 9. */
export interface UpgradeCombo {
    label: string;
    age8: number;
    age9: number;
}

const titleCase = (name: string) => name.replace(/\b\w/g, c => c.toUpperCase());

/**
 * Combo buttons for age 8 ("Combo Buttons at Age 8"). The sandbox server checks a weapon's age
 * but not its "pre" (verified live 2026-11-13: Katana after Polearm, Great Axe after Short Sword,
 * Repeater and Musket without a Crossbow were all given; Musket sent at age 8 was ignored).
 * So any age-8 primary can be followed by any age-9 secondary, like old MooMoo.
 * "<your primary> + Musket" takes the Crossbow at 8 (keeps your primary) and the Musket at 9.
 */
export function oldStyleCombos(currentPrimary: number, weaponName: (id: number) => string | undefined): UpgradeCombo[] {
    const name = (id: number) => titleCase(weaponName(id) ?? `#${id}`);
    const secondaries = [W.MUSKET, W.REPEATER_CROSSBOW];
    const combos: UpgradeCombo[] = [];

    for (const primary of [W.KATANA, W.GREAT_AXE]) {
        for (const secondary of secondaries) {
            combos.push({ label: `${name(primary)} + ${name(secondary)}`, age8: primary, age9: secondary });
        }
    }

    // Keep the current primary (e.g. Polearm): Crossbow now, then the age-9 secondary.
    if (currentPrimary !== W.KATANA && currentPrimary !== W.GREAT_AXE) {
        for (const secondary of secondaries) {
            combos.push({ label: `${name(currentPrimary)} + ${name(secondary)}`, age8: W.CROSSBOW, age9: secondary });
        }
    }

    return combos;
}
