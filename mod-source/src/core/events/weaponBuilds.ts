import { WEAPON_ID_MAP } from "@constants/items";

const W = WEAPON_ID_MAP;

/**
 * Auto Upgrade weapon builds: age -> weapon id to pick at that age.
 * 1.8.2 gives ONE upgrade per age. Age 8 offers Great Axe / Katana (primary) OR Crossbow
 * (secondary), and Musket / Repeater (age 9) need the Crossbow, so a Katana or Great Axe
 * build can never reach a Musket. tests/weaponBuilds.test.mjs checks every build is legal.
 */
export const WEAPON_BUILDS: Record<string, { label: string; ages: Record<number, number> }> = {
    polearmMusket: { label: "Polearm + Musket", ages: { 2: W.POLEARM, 6: W.HUNTING_BOW, 8: W.CROSSBOW, 9: W.MUSKET } },
    swordMusket: { label: "Short Sword + Musket (closest to Katana + Musket)", ages: { 2: W.SHORT_SWORD, 6: W.HUNTING_BOW, 8: W.CROSSBOW, 9: W.MUSKET } },
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
