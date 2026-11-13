interface ITaskAction {
    dt: number;
    active: boolean;
    callback: () => void;
}

export default class TaskScheduler {
    private static lastPolled = performance.now();
    private static timers: ITaskAction[] = [];
    private static isRunning = false;
    private static channel = new MessageChannel();

    static minDt = Infinity;

    static init() {
        this.channel.port1.onmessage = () => this.poll();
    }

    static setTimeout(cb: () => void, speed: number) {
        if (speed <= this.minDt && isFinite(this.minDt)) return cb();

        const timers = this.timers;
        let hasScheduled = false;

        for (let i = 0, len = timers.length; i < len; i++) {
            const timer = timers[i];

            if (!timer.active) {
                timer.dt = speed;
                timer.callback = cb;
                timer.active = true;
                hasScheduled = true;
                break;
            }
        }

        if (!hasScheduled)
            this.timers.push({ callback: cb, dt: speed, active: true });

        if (!this.isRunning) {
            this.isRunning = true;
            this.lastPolled = performance.now();
            this.channel.port2.postMessage(null);
        }
    }

    private static poll() {
        const timers = this.timers;
        const dt = performance.now() - this.lastPolled;

        if (dt > 0 && dt < this.minDt) {
            this.minDt = dt;
        }

        const threshold = isFinite(this.minDt) ? this.minDt : 0;
        this.lastPolled = performance.now();
        let activeTimers = 0;

        for (let i = 0, len = timers.length; i < len; i++) {
            const timer = timers[i];
            if (!timer.active) continue;

            timer.dt -= dt;
            if (timer.dt <= threshold) {
                timer.active = false;
                // One failing job must not stop the scheduler: without this catch the loop below
                // never re-posts, isRunning stays true, and no later job would ever run again.
                try {
                    timer.callback();
                } catch (e) {
                    console.error("[Falcon] scheduled task failed:", e);
                }
            } else {
                activeTimers++;
            }
        }

        if (activeTimers === 0 && this.isRunning) {
            this.isRunning = false;
            return;
        }

        this.channel.port2.postMessage(null);
    }
}