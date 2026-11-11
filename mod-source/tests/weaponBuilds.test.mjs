// Every Auto Upgrade build must be reachable in 1.8.2: one weapon per age, the weapon's age
// matches the slot, and its prerequisite ("pre") was picked at an earlier age.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./loadTs.mjs";

const { WEAPON_BUILDS, wantedWeapon } = await loadTs("src/core/events/weaponBuilds.ts");
const items = (await loadTs("src/utils/constants/items.ts")).default;

test("every weapon build is legal in 1.8.2", () => {
    for (const [name, build] of Object.entries(WEAPON_BUILDS)) {
        const owned = new Set([0]); // tool hammer
        for (const [age, id] of Object.entries(build.ages).sort((a, b) => a[0] - b[0])) {
            const wpn = items.weapons[id];
            assert.ok(wpn, `${name}: weapon ${id} exists`);
            assert.equal(wpn.age, Number(age), `${name}: ${wpn.name} is offered at age ${wpn.age}, not ${age}`);
            if (wpn.pre !== undefined) assert.ok(owned.has(wpn.pre), `${name}: ${wpn.name} needs ${items.weapons[wpn.pre].name}`);
            owned.add(id);
        }
        assert.ok(build.label, `${name}: has a menu label`);
    }
});

test("katana + musket is not possible (one age-8 upgrade)", () => {
    assert.equal(items.weapons[15].pre, 12); // musket needs crossbow
    assert.equal(items.weapons[12].age, 8);
    assert.equal(items.weapons[4].age, 8);   // katana competes for the same upgrade
});

test("wantedWeapon looks up the build's pick", () => {
    assert.equal(wantedWeapon("swordMusket", 9), 15);
    assert.equal(wantedWeapon("greatAxeHammer", 8), 2);
    assert.equal(wantedWeapon("manual", 8), undefined);
});
