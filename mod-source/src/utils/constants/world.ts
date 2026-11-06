// Numbers about the game world and combat ranges that several files share. Distances are in game units;
// *_DIST_SQ values are squared, to compare with getDistSq without taking a square root.
import ScriptConfig from "@utils/config/ScriptConfig";

/** The river crosses the middle of the map (y = MAP_SIZE / 2) and is this tall. */
export const RIVER_WIDTH = 724;
export const RIVER_HALF_WIDTH = RIVER_WIDTH / 2;

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
