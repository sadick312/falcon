// Every Auto Upgrade build must be reachable: one weapon per age and the weapon's age matches the
// slot. Builds without skipPre must also own the weapon's prerequisite ("pre") first, like the
// normal game requires. skipPre builds rely on the sandbox server not checking "pre".
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { WEAPON_BUILDS, wantedWeapon, buildUpgradePick, weaponOffers } = await loadTs("src/core/events/weaponBuilds.ts");
const items = (await loadTs("src/utils/constants/items.ts")).default;
const weaponAge = (id) => items.weapons[id]?.age;

test("every weapon build is reachable", () => {
    for (const [name, build] of Object.entries(WEAPON_BUILDS)) {
        const owned = new Set([0]); // tool hammer
        for (const [age, id] of Object.entries(build.ages).sort((a, b) => a[0] - b[0])) {
            const wpn = items.weapons[id];
            assert.ok(wpn, `${name}: weapon ${id} exists`);
            assert.equal(wpn.age, Number(age), `${name}: ${wpn.name} is offered at age ${wpn.age}, not ${age}`);
            if (wpn.pre !== undefined && !build.skipPre) assert.ok(owned.has(wpn.pre), `${name}: ${wpn.name} needs ${items.weapons[wpn.pre].name}`);
            owned.add(id);
        }
        assert.ok(build.label, `${name}: has a menu label`);
    }
});

test("Katana + Musket build: Katana at age 8, Musket at age 9 (sandbox, verified live)", () => {
    const build = WEAPON_BUILDS.katanaMusket;
    assert.equal(build.ages[8], 4, "katana");
    assert.equal(build.ages[9], 15, "musket");
    assert.equal(build.skipPre, true, "the game won't offer the Musket without a Crossbow");
    // Only the katana build skips the rule; the others stay normal-game legal.
    assert.deepEqual(Object.keys(WEAPON_BUILDS).filter((k) => WEAPON_BUILDS[k].skipPre), ["katanaMusket"]);
});

test("buildUpgradePick sends the Musket even when the game doesn't offer it", () => {
    // Age 9 without a Crossbow: the game offers e.g. McGrabby (14) only.
    assert.equal(buildUpgradePick("katanaMusket", 9, [14], weaponAge), 15);
    assert.equal(buildUpgradePick("katanaMusket", 8, [2, 4], weaponAge), 4);
    // Normal builds still only pick what is offered.
    assert.equal(buildUpgradePick("swordMusket", 9, [14], weaponAge), undefined);
    assert.equal(buildUpgradePick("swordMusket", 9, [13, 14, 15], weaponAge), 15);
    // Ages without a pick, unknown builds: no preference.
    assert.equal(buildUpgradePick("katanaMusket", 3, [17, 18], weaponAge), undefined);
    assert.equal(buildUpgradePick("manual", 9, [15], weaponAge), undefined);
});

test("weaponOffers: age 9 after a Katana shows the Musket only with 'any pre'", () => {
    const owned = [4, 9]; // Katana + Hunting Bow, no Crossbow
    const strict = weaponOffers(9, items.weapons, owned, false);
    assert.deepEqual(strict.shown, [], "normal game: no weapon at age 9 without a Crossbow");
    assert.deepEqual(strict.legal, []);

    const any = weaponOffers(9, items.weapons, owned, true);
    assert.deepEqual(any.shown, [13, 15], "Repeater and Musket shown");
    assert.deepEqual(any.legal, [], "Auto Upgrade still decides from the normal list");
});

test("weaponOffers: age 8 follows the owned weapons; private servers offer everything", () => {
    assert.deepEqual(weaponOffers(8, items.weapons, [3, 9], false).shown, [4, 12], "Short Sword + Bow: Katana, Crossbow");
    assert.deepEqual(weaponOffers(8, items.weapons, [3, 9], true).shown, [2, 4, 12], "any pre: Great Axe too");
    assert.deepEqual(weaponOffers(9, items.weapons, [5, 12], false).legal, [13, 15], "with a Crossbow the Musket is legal");
    assert.deepEqual(weaponOffers(9, items.weapons, [4, 9], false, true).legal, [13, 15], "private server: all legal");
});

test("wantedWeapon looks up the build's pick", () => {
    assert.equal(wantedWeapon("swordMusket", 9), 15);
    assert.equal(wantedWeapon("greatAxeHammer", 8), 2);
    assert.equal(wantedWeapon("manual", 8), undefined);
});

test("Choose Ages 8 & 9 Yourself: Auto Upgrade skips only ages 8 and 9", async () => {
    const { autoPicksAge } = await loadTs("src/core/events/weaponBuilds.ts");
    assert.equal(autoPicksAge(8, true), false, "age 8: you click");
    assert.equal(autoPicksAge(9, true), false, "age 9: you click");
    assert.equal(autoPicksAge(2, true), true, "age 2 still automatic");
    assert.equal(autoPicksAge(6, true), true, "age 6 still automatic");
    assert.equal(autoPicksAge(10, true), true);
    assert.equal(autoPicksAge(8, false), true, "toggle off: build picks 8 too (old behaviour)");
    assert.equal(autoPicksAge(9, false), true);
});
