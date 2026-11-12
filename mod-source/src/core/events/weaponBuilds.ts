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
