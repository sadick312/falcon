export interface PlayerSimulationState {
    sid: number;
    x: number;
    y: number;
    team: string | null;
    velX: number;
    velY: number;
    scale: number;
    health: number;
    maxHealth: number;
    skinIndex: number;
    tailIndex: number;
    lockMove: boolean;
    /** Highest zIndex of the objects touched last tick (1 = on a platform); the river skips players on platforms. */
    zIndex: number;
    weaponIndex: number;
    buildIndex: number;
    slowMult: number;
    spikeDamages: number;
}

export interface GameObjectSimulationState {
    active: boolean;
    sid: number;
    x: number;
    y: number;
    scale: number;
    type: number;
    dmg: number;
    health: number;
    teleport: boolean;
    boostSpeed: number;
    ignoreCollision: boolean;
    /** 1 for platforms: a player touching one counts as on it next tick. */
    zIndex: number;
    trap: boolean;
    ownerSID: number | undefined;
    dir: number;
    willBreak: boolean;
}