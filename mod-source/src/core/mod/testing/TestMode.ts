import Endpoints from "@constants/Endpoints";
import items from "@constants/items";
import Player from "@constants/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import CombatController from "@core/mod/combat/core/CombatController";
import PerfMonitor from "@core/mod/utils/PerfMonitor";
import Menu from "@menu/Menu";
import PacketMap from "@root/utils/socket/PacketMap";
import getDir from "@utils/angle/getDir";
import getDistSq from "@utils/geometry/getDistSq";

/**
 * Test Mode: runs measured scenarios against the moomodding.io sandbox practice bot by typing its
 * chat commands for you. It only starts from the Start button, and Stop (or F9) always cleans up with "\c a".
 *
 * The practice bot is a dummy: it never attacks. So everything that needs incoming damage
 * (survival time, heal timing) can't be measured here; use a "\f" duel for that.
 */

// ───────────────────────────── Config ─────────────────────────────

export const TEST_CONFIG = {
    botName: "Target",
    /** Minimum gap between two chat commands, so the server's chat limit is never hit. */
    commandGapMs: 1500,
    /** How long to wait for a command's effect (bot appears, hat changes...) before moving on. */
    effectTimeoutMs: 4000,
    /** The bot counts as "next to me" inside this distance. */
    botNearDistance: 120,
    dpsDurationMs: 10_000,
    killTimeoutMs: 20_000,
    /** Bot hats for the kill test: none, Soldier Helmet. */
    killTestBotHats: [0, 6],
    /** My weapon variant tiers for the tier test (\v). */
    tierTestTiers: [0, 1, 2, 3],
    /** Bot loadouts for the defense reaction test: [weapon, tier, hat]. */
    defenseLoadouts: [[4, 3, 7], [5, 3, 0], [10, 0, 0]] as [number, number, number][],
    defenseWatchMs: 4000,
    buildWatchMs: 8000,
    perfSampleMs: 6000,
    /** Combat and defense modules switched off for the "Falcon off" performance phase. */
    perfModuleIds: [
        "velocityHits", "projectileSync", "turretGearKB", "barbKnockback", "shameGrind", "appleInsta",
        "spikeTick", "autoPlacing", "preplacer", "replacer", "meleeSync", "autoPush", "antiBull",
        "autoGrind", "autoBreak", "autoHeal", "defensiveHatSwitching", "safeWalk", "walkBreaker", "defensiveKB"
    ],
    stopKey: "F9",
    scenarioStorageKey: "falcon-testmode-scenarios"
} as const;

export type ScenarioId = "dps" | "kill" | "tier" | "defense" | "building" | "perf";

export const SCENARIOS: { id: ScenarioId; label: string; description: string }[] = [
    { id: "dps", label: "DPS", description: "Bot heals; hit it for 10s with each of your weapons and record damage." },
    { id: "kill", label: "Time to kill", description: "Bot heal off; time to kill with each weapon, bot with no hat and with Soldier Helmet." },
    { id: "tier", label: "Weapon tier", description: "Kill test with your primary at tiers 0-3 (\\v). Shows whether tiers change damage here." },
    { id: "defense", label: "Defense reaction", description: "Bot gets different weapons/hats; records which hat Falcon switches to and how fast." },
    { id: "building", label: "Building reaction", description: "Bot is brought next to you; records how fast Falcon's auto place reacts, then clears." },
    { id: "perf", label: "Performance", description: "FPS and ms per tick with Falcon's combat modules off, then on, in your current area." }
];

// ───────────────────────────── Types ─────────────────────────────

export interface TestResult {
    test: string;
    setup: string;
    result: string;
}

interface TestRun {
    name: string;
    run: () => Promise<void>;
}

class StopSignal extends Error { }

type Listener = () => void;

// ───────────────────────────── Runner ─────────────────────────────

export default class TestMode {
    static running = false;
    static currentName = "";
    static progress = 0;
    static total = 0;
    static results: TestResult[] = [];
    static notice = "";

    /** Aim override read by ModManager.getAttackDir; null when Test Mode isn't attacking. */
    static aim: number | null = null;

    private static stopRequested = false;
    private static attacking = false;
    private static lastCommandAt = 0;
    private static listeners: Listener[] = [];
    private static changedTier = false;

    // Damage tracking, updated every tick while a run is attacking.
    private static botSid = -1;
    private static lastBotHealth = -1;
    private static damage = 0;
    private static hits = 0;
    private static firstDamageAt = 0;
    private static botDiedAt = 0;

    static enabledScenarios = TestMode.loadScenarioSelection();

    static onChange(listener: Listener) {
        this.listeners.push(listener);
    }

    private static emit() {
        for (let i = 0; i < this.listeners.length; i++) this.listeners[i]();
    }

    private static loadScenarioSelection(): Record<ScenarioId, boolean> {
        const all = { dps: true, kill: true, tier: true, defense: true, building: true, perf: true };
        try {
            const saved = JSON.parse(localStorage.getItem(TEST_CONFIG.scenarioStorageKey) ?? "null");
            if (saved && typeof saved === "object") Object.assign(all, saved);
        } catch { /* keep defaults */ }
        return all;
    }

    static setScenario(id: ScenarioId, enabled: boolean) {
        this.enabledScenarios[id] = enabled;
        try {
            localStorage.setItem(TEST_CONFIG.scenarioStorageKey, JSON.stringify(this.enabledScenarios));
        } catch { /* storage unavailable: selection lasts for this session */ }
    }

    /** Why Start is unavailable right now, or null when it can run. */
    static blockedReason(): string | null {
        if (Endpoints.mode !== "moomodding") return "Test Mode needs the moomodding.io sandbox (its \\b commands don't exist elsewhere).";
        if (Client.mode === "replay") return "Not available while watching a replay.";
        if (!Client.player || Client.player.health <= 0) return "Spawn in first.";
        if (!Object.values(this.enabledScenarios).some(Boolean)) return "Pick at least one test.";
        return null;
    }

    // ── Tick hook (called by ModManager.main every server tick) ──

    static onTick() {
        if (!this.running) return;

        const bot = this.findBot();
        const player = Client.player;

        if (bot) {
            if (bot.sid !== this.botSid) {
                this.botSid = bot.sid;
                this.lastBotHealth = bot.health;
            }

            if (this.attacking && bot.health < this.lastBotHealth) {
                this.damage += this.lastBotHealth - bot.health;
                this.hits++;
                if (!this.firstDamageAt) this.firstDamageAt = performance.now();
            }

            if (this.attacking && bot.health <= 0 && !this.botDiedAt) this.botDiedAt = performance.now();
            this.lastBotHealth = bot.health;
        } else if (this.attacking && this.firstDamageAt && !this.botDiedAt) {
            // A bot that took damage and vanished died.
            this.botDiedAt = performance.now();
        }

        if (this.attacking && bot && player) {
            this.aim = getDir(bot.real_position, player.real_position);
            CombatController.hitOnce();
        } else {
            this.aim = null;
        }
    }

    // ── Public controls ──

    static start() {
        if (this.running) return;

        const blocked = this.blockedReason();
        if (blocked) {
            this.notice = blocked;
            this.emit();
            return;
        }

        const runs = this.buildRuns();
        this.running = true;
        this.stopRequested = false;
        this.results = [];
        this.progress = 0;
        this.total = runs.length;
        this.notice = "";
        this.emit();

        this.execute(runs);
    }

    static stop() {
        if (!this.running) return;
        this.stopRequested = true;
        this.notice = "Stopping and cleaning up...";
        this.emit();
    }

    static resultsAsText() {
        const { reported } = Endpoints.version;
        const lines = [`Falcon Test Mode results (client v${reported}, ${new Date().toLocaleString()})`, "Test\tSetup\tResult"];
        for (const r of this.results) lines.push(`${r.test}\t${r.setup}\t${r.result}`);
        return lines.join("\n");
    }

    // ── Execution ──

    private static async execute(runs: TestRun[]) {
        try {
            for (const run of runs) {
                this.checkStop();
                this.currentName = run.name;
                this.emit();

                await run.run();

                this.progress++;
                this.emit();
            }

            this.notice = "Done.";
        } catch (err) {
            if (!(err instanceof StopSignal)) {
                console.error("[Falcon] Test Mode failed.", err);
                this.notice = `Stopped by an error: ${(err as Error).message}`;
            } else {
                this.notice = "Stopped.";
            }
        } finally {
            await this.cleanUp();
            this.running = false;
            this.currentName = "";
            this.emit();
        }
    }

    private static async cleanUp() {
        this.attacking = false;
        this.aim = null;
        this.stopRequested = false;

        try {
            if (this.changedTier) {
                await this.command("\\v 0");
                this.changedTier = false;
            }
            await this.command("\\c a");
        } catch (err) {
            console.warn("[Falcon] Test Mode cleanup did not finish.", err);
        }
    }

    private static buildRuns(): TestRun[] {
        const runs: TestRun[] = [];
        const on = this.enabledScenarios;
        const slots = this.weaponSlots();

        if (on.dps) for (const slot of slots) {
            runs.push({ name: `DPS: ${this.weaponName(slot)}`, run: () => this.runDps(slot) });
        }

        if (on.kill) for (const slot of slots) for (const hat of TEST_CONFIG.killTestBotHats) {
            runs.push({ name: `Kill: ${this.weaponName(slot)}, bot hat ${hat}`, run: () => this.runKill(slot, hat, "Time to kill") });
        }

        if (on.tier) for (const tier of TEST_CONFIG.tierTestTiers) {
            runs.push({ name: `Tier ${tier}: ${this.weaponName(0)}`, run: () => this.runTier(tier) });
        }

        if (on.defense) for (const loadout of TEST_CONFIG.defenseLoadouts) {
            runs.push({ name: `Defense: bot w${loadout[0]} v${loadout[1]} h${loadout[2]}`, run: () => this.runDefense(loadout) });
        }

        if (on.building) runs.push({ name: "Building reaction", run: () => this.runBuilding() });
        if (on.perf) runs.push({ name: "Performance", run: () => this.runPerf() });

        return runs;
    }

    // ── Scenarios ──

    private static async runDps(slot: number) {
        await this.prepareBot({ heal: true, hat: 0 });
        this.selectSlot(slot);

        this.resetDamage();
        this.attacking = true;
        await this.sleep(TEST_CONFIG.dpsDurationMs);
        this.attacking = false;

        const seconds = TEST_CONFIG.dpsDurationMs / 1000;
        const died = this.botDiedAt ? " (bot died, so this is a lower bound)" : "";
        this.record("DPS", `${this.weaponName(slot)}, bot heal on`,
            `${Math.round(this.damage)} dmg in ${seconds}s = ${(this.damage / seconds).toFixed(1)} DPS, ${this.hits} hits${died}`);
    }

    private static async runKill(slot: number, botHat: number, label: string, setupExtra = "") {
        await this.prepareBot({ heal: false, hat: botHat });
        this.selectSlot(slot);

        this.resetDamage();
        this.attacking = true;
        await this.waitFor(() => this.botDiedAt > 0, TEST_CONFIG.killTimeoutMs);
        this.attacking = false;

        const setup = `${this.weaponName(slot)}, bot hat ${botHat}${setupExtra}`;
        if (!this.botDiedAt) {
            this.record(label, setup, `no kill in ${TEST_CONFIG.killTimeoutMs / 1000}s (${Math.round(this.damage)} dmg, ${this.hits} hits)`);
            return;
        }

        const ttk = (this.botDiedAt - (this.firstDamageAt || this.botDiedAt)) / 1000;
        this.record(label, setup, `${ttk.toFixed(2)}s to kill, ${this.hits} hits`);
    }

    private static async runTier(tier: number) {
        this.selectSlot(0);
        await this.sleep(300);

        const applied = await this.command(`\\v ${tier}`, () => Client.player?.weaponVariant === tier);
        this.changedTier = tier !== 0;
        const note = applied ? `, my tier ${tier}` : `, my tier ${tier} (not confirmed)`;

        await this.runKill(0, 0, "Weapon tier", note);
    }

    private static async runDefense([weapon, tier, hat]: [number, number, number]) {
        await this.ensureBot();
        await this.command(`\\b w ${weapon}`, () => this.findBot()?.weaponIndex === weapon);
        await this.command(`\\b v ${tier}`, () => this.findBot()?.weaponVariant === tier);
        await this.command(`\\b h ${hat}`, () => this.findBot()?.skinIndex === hat);

        const hatBefore = Client.player.skinIndex;
        await this.command("\\b t", () => this.botIsNear());
        // Timed from when the bot is actually next to me, not from when the command was queued.
        const broughtAt = performance.now();

        const changed = await this.waitFor(() => Client.player.skinIndex !== hatBefore, TEST_CONFIG.defenseWatchMs);
        const reaction = changed ? `switched to hat ${Client.player.skinIndex} after ${Math.round(performance.now() - broughtAt)} ms` : "kept its hat";

        this.record("Defense reaction", `bot ${items.weapons[weapon]?.name ?? weapon} tier ${tier}, hat ${hat}`, reaction);
    }

    private static async runBuilding() {
        const autoPlacing = !!Menu.getValue("autoPlacing");

        // Start with no bot and no structures; the fresh bot spawns next to me, which starts the clock.
        if (this.findBot()) await this.command("\\b d", () => !this.findBot());
        await this.command("\\c", () => this.myObjectCount() === 0);
        await this.command(`\\b ${TEST_CONFIG.botName}`, () => this.botIsNear());
        const broughtAt = performance.now();

        const placed = await this.waitFor(() => this.myObjectCount() > 0, TEST_CONFIG.buildWatchMs);
        const reactionMs = Math.round(performance.now() - broughtAt);
        await this.sleep(1000);
        const count = this.myObjectCount();

        this.record("Building reaction", `auto place ${autoPlacing ? "on" : "off"}`,
            placed ? `first placement after ${reactionMs} ms, ${count} objects placed` : `nothing placed in ${TEST_CONFIG.buildWatchMs / 1000}s`);

        await this.command("\\c", () => this.myObjectCount() === 0);
    }

    private static async runPerf() {
        const saved = new Map<string, unknown>();

        try {
            for (const id of TEST_CONFIG.perfModuleIds) {
                const item = Menu.itemMap[id];
                if (!item || typeof item.status !== "boolean") continue;
                saved.set(id, item.status);
                item.status = false;
            }

            const off = await this.samplePerf();
            this.restoreModules(saved);
            const on = await this.samplePerf();

            this.record("Performance", `Falcon modules off, ${off.nearbyObjects} objects nearby`, this.perfText(off));
            this.record("Performance", `Falcon modules on, ${on.nearbyObjects} objects nearby`, this.perfText(on));
        } finally {
            this.restoreModules(saved);
        }
    }

    private static async samplePerf() {
        PerfMonitor.reset();
        await this.sleep(TEST_CONFIG.perfSampleMs);
        return PerfMonitor.snapshot();
    }

    private static perfText(s: ReturnType<typeof PerfMonitor.snapshot>) {
        return `${s.fps} FPS, tick ${s.tickAvgMs.toFixed(2)} ms avg / ${s.tickMaxMs.toFixed(2)} max, frame ${s.frameAvgMs.toFixed(2)} ms, ping ${s.ping} ms`;
    }

    private static restoreModules(saved: Map<string, unknown>) {
        for (const [id, status] of saved) {
            const item = Menu.itemMap[id];
            if (item) item.status = status;
        }
        saved.clear();
    }

    // ── Bot helpers ──

    private static findBot(): Player | undefined {
        const player = Client.player;
        if (!player) return undefined;

        const visible = PlayerManager.players.visible.all;
        let best: Player | undefined;
        let bestDist = Infinity;

        for (let i = 0; i < visible.length; i++) {
            const other = visible[i];
            if (other.sid === Client.mySID || other.name !== TEST_CONFIG.botName) continue;

            const dist = getDistSq(other.real_position, player.real_position);
            if (dist < bestDist) {
                bestDist = dist;
                best = other;
            }
        }

        return best;
    }

    private static botIsNear() {
        const bot = this.findBot();
        const near = TEST_CONFIG.botNearDistance;
        return !!bot && getDistSq(bot.real_position, Client.player.real_position) <= near * near;
    }

    private static async ensureBot() {
        if (!this.findBot()) {
            const spawned = await this.command(`\\b ${TEST_CONFIG.botName}`, () => !!this.findBot());
            if (!spawned) throw new Error(`the bot "${TEST_CONFIG.botName}" did not appear`);
        }
    }

    /** Bot next to me, at full health, with the given heal mode and hat, holding its default weapon. */
    private static async prepareBot(opts: { heal: boolean; hat: number }) {
        await this.ensureBot();
        await this.command("\\b hl on", () => (this.findBot()?.health ?? 0) >= 100);
        if (!opts.heal) await this.command("\\b hl off");
        await this.command(`\\b h ${opts.hat}`, () => this.findBot()?.skinIndex === opts.hat);
        await this.command("\\b t", () => this.botIsNear());
    }

    private static objectBuffer: ReturnType<typeof ObjectManager.getObjects> = [];

    private static myObjectCount() {
        const player = Client.player;
        const nearby = this.objectBuffer;
        nearby.length = 0;
        ObjectManager.getObjects(player.real_position.x, player.real_position.y, nearby);

        let count = 0;
        for (let i = 0; i < nearby.length; i++) if (nearby[i].ownerSID === Client.mySID) count++;
        nearby.length = 0;
        return count;
    }

    private static weaponSlots() {
        const weapons = Client.player?.weapons ?? [];
        return weapons.length > 1 ? [0, 1] : [0];
    }

    private static weaponName(slot: number) {
        const id = Client.player?.weapons[slot];
        return typeof id === "number" ? items.weapons[id]?.name ?? `weapon ${id}` : `slot ${slot}`;
    }

    private static selectSlot(slot: number) {
        const id = Client.player.weapons[slot];
        if (typeof id === "number") CombatController.selectWeapon(id);
    }

    private static resetDamage() {
        const bot = this.findBot();
        this.botSid = bot?.sid ?? -1;
        this.lastBotHealth = bot?.health ?? -1;
        this.damage = this.hits = 0;
        this.firstDamageAt = this.botDiedAt = 0;
    }

    private static record(test: string, setup: string, result: string) {
        this.results.push({ test, setup, result });
        this.emit();
    }

    // ── Timing helpers ──

    private static checkStop() {
        if (this.stopRequested) throw new StopSignal();
        if (!Client.player || Client.player.health <= 0) throw new Error("you died");
    }

    private static sleep(ms: number) {
        return this.waitFor(() => false, ms);
    }

    /** Resolves true when `done` holds, false after `timeoutMs`. Rejects on Stop or death. */
    private static waitFor(done: () => boolean, timeoutMs: number) {
        const start = performance.now();

        return new Promise<boolean>((resolve, reject) => {
            const poll = () => {
                if (this.stopRequested) return reject(new StopSignal());
                if (!Client.player || Client.player.health <= 0) return reject(new Error("you died"));
                if (done()) return resolve(true);
                if (performance.now() - start >= timeoutMs) return resolve(false);
                setTimeout(poll, 50);
            };
            poll();
        });
    }

    /**
     * Sends a chat command, never closer than commandGapMs to the previous one, then waits for
     * `effect` (if given). Returns whether the effect was seen. Cleanup commands ignore Stop.
     */
    private static async command(text: string, effect?: () => boolean) {
        const wait = this.lastCommandAt + TEST_CONFIG.commandGapMs - performance.now();
        if (wait > 0) await new Promise(r => setTimeout(r, wait));

        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_CHAT, text);
        this.lastCommandAt = performance.now();

        if (!effect) return true;
        return this.waitFor(effect, TEST_CONFIG.effectTimeoutMs);
    }
}
