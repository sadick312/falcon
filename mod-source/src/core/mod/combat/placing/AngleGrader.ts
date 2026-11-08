import { at } from "@utils/array/at";
import { tickState } from "@core/TickState";
import AngleFinder, { FinderOptions } from "@placing/AngleFinder";
import SpikeGrader from "@placing/grader-modules/SpikeGrader";
import TrapGrader from "@placing/grader-modules/TrapGrader";

export default class AngleGrader {
    private static spikeGrader = new SpikeGrader();
    private static trapGrader = new TrapGrader();

    static grade(index: number, options: Readonly<FinderOptions>) {
        const angleData = at(AngleFinder.angleBuffer, index);
        const nearby = tickState.enemyData.nearby;
        const grader = angleData.isSpike ? this.spikeGrader : this.trapGrader;

        grader.prepare(angleData, nearby, !!options.preplace, options.obj);
        if (angleData.dontUse) return;

        for (let i = 0, len = nearby.length; i < len; i++) {
            const enemy = nearby[i];
            if (enemy === undefined) continue;
            grader.grade(angleData, enemy);
            if (angleData.dontUse) return;
        }
    }
}