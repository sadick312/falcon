/**
 * Danger Warning logic (no drawing here, so it can be unit tested).
 *
 * 0 = safe, 1 = danger (expected damage >= the "Warn From" setting),
 * 2 = can kill you (expected damage >= your health).
 */
export type DangerLevel = 0 | 1 | 2;

/** How long a warning stays on screen after the danger is gone, so it doesn't flicker. */
export const DANGER_HOLD_MS = 500;

export function dangerLevel(expectedDamage: number, health: number, warnFrom: number): DangerLevel {
    if (!(expectedDamage > 0) || !(health > 0)) return 0;
    if (expectedDamage >= health) return 2;
    if (expectedDamage >= warnFrom) return 1;
    return 0;
}

/**
 * Keeps the highest level seen in the last DANGER_HOLD_MS. The server updates about 9 times a
 * second, so the raw level can blink on and off between updates; this holds it steady.
 */
export class DangerHold {
    private level: DangerLevel = 0;
    private until = 0;
    damage = 0;

    update(level: DangerLevel, damage: number, now: number): DangerLevel {
        if (level > 0 && (level >= this.level || now >= this.until)) {
            this.level = level;
            this.damage = damage;
            this.until = now + DANGER_HOLD_MS;
        } else if (level > 0 && level === this.level) {
            this.until = now + DANGER_HOLD_MS;
        }

        if (now >= this.until) this.level = 0;
        return this.level;
    }

    reset() {
        this.level = 0;
        this.until = 0;
        this.damage = 0;
    }
}
