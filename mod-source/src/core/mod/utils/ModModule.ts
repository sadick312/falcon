/**
 * Shared shape of every pluggable attack module (the list in AttackManager.modules).
 *
 * Each tick, AttackManager calls init() (first time only) and update() on every module in list order, then run()
 * on every module in list order. A module switches itself on or off by reading its menu setting in canExecute(),
 * so a toggle flipped mid-fight takes effect on the next tick without anything else to call.
 *
 * The core systems (DefenseSystem, HatSystem, AutoBreaker, PlacementSystem...) are not modules: ModManager.main
 * calls them in a fixed order that the combat logic relies on (see GOLD_TECH.md).
 */
export default abstract class ModModule {
    private isInitialized = false;

    /** Sets the module up the first time it's used, e.g. claims its attack queue. */
    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.initialize();
    }

    /** Runs the module for this tick if it may act now (its setting is on and the situation fits). */
    run() {
        if (!this.canExecute()) return;
        this.execute();
    }

    /** Bookkeeping every tick, before any module runs, whether or not the module is switched on. */
    update(): void { }

    /** Forgets what the module remembered from the previous life. Called when we spawn. */
    reset(): void { }

    protected abstract initialize(): void;
    protected abstract canExecute(): boolean;
    protected abstract execute(): void;
}
