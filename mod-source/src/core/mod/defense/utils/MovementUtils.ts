export default class MovementUtils {
    static getFrictionMult(accelX: number, accelY: number, delta: number) {
        const r = Math.pow(0.993, delta);
        const logR = Math.log(r);
        const invOneMinusR = 1 / (1 - r);

        const accelMagSq = accelX * accelX + accelY * accelY;

        let frictionMult = 0;

        if (accelMagSq >= .0001) {
            const n = Math.ceil(Math.log(.0001 / accelMagSq) / logR);
            frictionMult = (1 - Math.pow(r, n)) * invOneMinusR;
        }

        return frictionMult;
    }
}