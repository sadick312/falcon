export default class Angle {
    isTrap: boolean;
    isSpike: boolean;

    grade = 0;
    priority = false;
    dontUse = false;

    spikePush = new Set<number>();
    pitSpike = new Set<number>();
    kill = new Set<number>();
    reasons: string[] = [];
    spikeTick = false;
    appleInsta = false;
    preplace = false;
    overlap = false;
    alignment = 0;
    breaking = false;
    predict = false;
    replace = false;
    predictBoost = 0;

    constructor(
        public x: number,
        public y: number,
        public scale: number,
        public angle: number,
        public id: number
    ) {
        this.isTrap = this.id === 15;
        this.isSpike = !this.isTrap;
    }

    redefine(x: number, y: number, scale: number, angle: number, id: number, isPreplacement: boolean = false, predict?: boolean) {
        this.x = x;
        this.y = y;
        this.scale = scale;
        this.angle = angle;
        this.id = id;

        this.isTrap = this.id === 15;
        this.isSpike = !this.isTrap;
        this.grade = 0;

        this.priority = false;
        this.dontUse = false;
        this.overlap = false;
        this.alignment = 0;
        this.breaking = false;
        this.predict = predict ?? false;
        this.replace = false;
        this.predictBoost = 0;

        // Set.clear() allocates a new backing table even when the set is already empty, and this runs for every candidate angle.
        if (this.spikePush.size) this.spikePush.clear();
        if (this.pitSpike.size) this.pitSpike.clear();
        if (this.kill.size) this.kill.clear();

        this.reasons.length = 0;
        this.spikeTick = false;
        this.appleInsta = false;
        this.preplace = isPreplacement;
    }
}