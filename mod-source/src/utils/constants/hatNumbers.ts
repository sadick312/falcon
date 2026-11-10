// The hat and accessory numbers combat and defense do math with, read once from the game data (store.ts, items.ts)
// instead of being typed into each file. When the game changes a hat, store.ts is the only place to update.
import { getProjectile } from "@constants/items";
import { accessoryMap, hatMap, STORE_ACCESSORY_MAP, STORE_HAT_MAP } from "@constants/store";

function required(value: number | undefined, what: string): number {
    if (value === undefined) throw new Error(`[Falcon] store data is missing ${what}`);
    return value;
}

const hat = (id: number) => hatMap.get(id);
const accessory = (id: number) => accessoryMap.get(id);

/** Bull Helmet's melee damage multiplier (1.5): worst-case hits assume it. */
export const BULL_DAMAGE_MULT = required(hat(STORE_HAT_MAP.BULL_HELMET)?.dmgMultO, "Bull Helmet dmgMultO");

/** Health the Bull Helmet drains once a second (5). */
export const BULL_HEALTH_DRAIN = -required(hat(STORE_HAT_MAP.BULL_HELMET)?.healthRegen, "Bull Helmet healthRegen");

/** Share of damage that gets through a Soldier Helmet (0.75). */
export const SOLDIER_DAMAGE_TAKEN = required(hat(STORE_HAT_MAP.SOLDIER_HELMET)?.dmgMult, "Soldier Helmet dmgMult");

/** Damage of a turret bullet, from Turret Gear or a turret building (projectile 1: 25). An EMP Helmet stops it. */
export const TURRET_BULLET_DAMAGE = getProjectile(1).dmg;

/** Monkey Tail's multiplier on our own hit damage (0.2). */
export const MONKEY_TAIL_DAMAGE_MULT = required(accessory(STORE_ACCESSORY_MAP.MONKEY_TAIL)?.dmgMultO, "Monkey Tail dmgMultO");

/** Health Angel Wings regenerate once a second (3); with the Bull Helmet's drain the net loss is 5 - 3 = 2. */
export const ANGEL_WINGS_REGEN = required(accessory(STORE_ACCESSORY_MAP.ANGEL_WINGS)?.healthRegen, "Angel Wings healthRegen");
