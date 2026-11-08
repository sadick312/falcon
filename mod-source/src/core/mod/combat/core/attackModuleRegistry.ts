// Holds the attack modules for AttackManager. attackModules.ts registers a function that creates them, and they are
// created the first time AttackManager asks. Creating them while the files load (as before) only worked when
// AttackManager happened to finish loading first, which depended on the order other files imported things.
// Creating a module has no side effects (no random numbers, clocks or page lookups), so when this happens doesn't
// matter.
import type AntiBuller from "@combat-modules/AntiBuller";
import type AppleInstakiller from "@combat-modules/AppleInstakiller";
import type OneTicker from "@combat-modules/OneTicker";
import type ShameGrinder from "@combat-modules/ShameGrinder";
import type SpikeTicker from "@combat-modules/SpikeTicker";
import type ModModule from "@core/mod/utils/ModModule";

export interface AttackModules {
    spikeTicker: SpikeTicker;
    appleInstakiller: AppleInstakiller;
    shameGrinder: ShameGrinder;
    antiBuller: AntiBuller;
    oneTicker: OneTicker;
    /** Every attack module, in the order they run (and win ties). */
    modules: ModModule[];
}

let create: (() => AttackModules) | null = null;
let created: AttackModules | null = null;

export function registerAttackModules(factory: () => AttackModules) {
    create = factory;
}

export function getAttackModules(): AttackModules {
    if (created) return created;
    if (!create) throw new Error("The attack modules aren't registered yet (attackModules.ts, loaded by ModManager).");
    created = create();
    return created;
}
