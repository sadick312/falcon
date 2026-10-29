/**
 * Kinds of placement, kept in a module with no imports.
 *
 * Placer.ts imports PlacementSystem, which imports AutoPlacer, which extends Placer. Anything that only needs these
 * constants (the renderer, PlacementSystem) must import them from here: importing them from Placer.ts could load
 * Placer before AutoPlacer and crash at startup with "Class extends value undefined".
 */
export const PlacementTypes = {
    NORMAL: 1,
    REPLACE: 2,
    PREPLACE: 3,
    RESERVED: 4,
    PREDICTIVE: 5
} as const;

export type PlacementType = typeof PlacementTypes[keyof typeof PlacementTypes];
