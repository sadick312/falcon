// Numbers about the game world and combat ranges that several files share. Distances are in game units;
// *_DIST_SQ values are squared, to compare with getDistSq without taking a square root.
import ScriptConfig from "@utils/config/ScriptConfig";

/** The river crosses the middle of the map (y = MAP_SIZE / 2) and is this tall. */
export const RIVER_WIDTH = 724;
export const RIVER_HALF_WIDTH = RIVER_WIDTH / 2;
/** 1.8.2 `waterCurrent`: speed added eastward per ms in the river (× 0.4 with a water-immune hat). */
export const WATER_CURRENT = 0.0011;
/** 1.8.2 `snowSpeed`: movement multiplier at y <= SNOW_BIOME_TOP without a cold-immune hat (coldM). */
export const SNOW_SPEED = 0.75;

/**
 * Whether 1.8.2's water rules (slowdown and current) apply: inside the river band and not on a platform. Player.update
 * checks `!this.zIndex` before resetting it, so it's the zIndex from the previous tick's collisions, which is what
 * the server sends us in each player update.
 */
export function isInWater(y: number, zIndex: number) {
    return !zIndex && Math.abs(y - ScriptConfig.MAP_SIZE / 2) <= RIVER_HALF_WIDTH;
}

/** A player's collision radius (1.8.2 `scale: 35`): placement distance and touch checks are this + the object's size. */
export const PLAYER_SCALE = 35;

/** Bull Helmet's melee damage multiplier (1.8.2 `dmgMultO: 1.5`); worst-case hits assume it. */
export const BULL_DAMAGE_MULT = 1.5;

/** Owner sid given to map objects (trees, stones, bushes, cacti) so they never match a player's sid. */
export const NATURAL_OBJECT_OWNER = 6967;

/** Enemies within this distance count as nearby (ModManager.enemyData.nearby). */
export const NEARBY_ENEMY_DIST_SQ = 370 ** 2;

/** Distance band in which a diamond polearm + crossbow "boost tick" can reach us. */
export const BOOST_TICK_MIN_DIST_SQ = 300 ** 2;
export const BOOST_TICK_MAX_DIST_SQ = 370 ** 2;

/** Distance band in which a bow insta can reach us. */
export const BOW_INSTA_MIN_DIST_SQ = 500 ** 2;
export const BOW_INSTA_MAX_DIST_SQ = 750 ** 2;

/** Bushes (type 1) in the desert at the bottom of the map are cacti, which damage whoever touches them. */
export function isCactusObject(gameObject: { type: number; y: number }) {
    return gameObject.type === 1 && gameObject.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;
}
