/**
 * Hat report (hat brief, Phase 0 baseline): how well the Hat System keeps the wanted hat and accessory on, measured
 * offline from replays.
 *
 * The sample recordings are synthetic: their "server" never answers Falcon's equips, so the hat the server reports
 * never changes and Falcon would re-send the same equip forever. Unless HAT_CONFIRM=0, this report plays the server's
 * part for our own player: an equip Falcon sends ("c", buy=false) is what `skinIndex` / `tailIndex` read from the next
 * tick on (like a real server with under ~110 ms ping). A change the recording itself reports (real !plog
 * recordings) is taken as it is. This only changes what the replay sees, not the mod.
 *
 * Per tick it counts:
 *   late hat / late acc   the Hat System wanted an item that wasn't worn and sent nothing for it this tick
 *                         (blocked: one equip per tick, item not owned, ...); keyed by the rule that wanted it
 *   no-op equips          an equip for the item already worn
 *   flicker               an equip that swaps back to the item worn two ticks ago (X -> Y -> X)
 *   conflicts             Defense System, the attack combo and Combat Controller asked for different hats
 *   wrong-hat damage      health lost on a tick when the worn hat wasn't the one picked the tick before
 * and, with the profiler, HatSystem.main's time per tick.
 *
 * Run: npx vitest run --config vitest.bench.config.mts mod-source/bench/hat-report.bench-run.ts
 *   HAT_RECORDINGS  folder or single .fpl (default mod-source/bench/recordings)
 *   HAT_CONFIRM=0   don't play the server's part (see above)
 */
import fs from "fs";
import path from "path";
import { describe, it } from "vitest";
import { readRecording, recordingsDir, replay, type ModApi } from "./replay";

export interface HatResult {
    ticks: number;
    hatEquips: number;
    accEquips: number;
    lateHat: Record<string, number>;
    lateAcc: Record<string, number>;
    noOpEquips: number;
    flicker: number;
    flickerKinds: Record<string, number>;
    conflicts: number;
    conflictKinds: Record<string, number>;
    wrongHatDamage: number;
    totalDamage: number;
    hatRules: Record<string, number>;
    accRules: Record<string, number>;
    hatMain: { calls: number; meanUs: number; p95Us: number } | null;
}

const bump = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

/** Our player's skinIndex / tailIndex as a server would report them: the last equip we sent, from the next tick on. */
interface Slot { server: number; worn: number; pending: number | null }

function confirmEquips(player: object, hat: Slot, acc: Slot) {
    for (const [key, slot] of [["skinIndex", hat], ["tailIndex", acc]] as const) {
        slot.server = slot.worn = (player as Record<string, number>)[key] ?? 0;
        Object.defineProperty(player, key, {
            configurable: true,
            get: () => slot.worn,
            // The recording reports a change itself (a real server, a death, shame): take it.
            set: (value: number) => { if (value !== slot.server) { slot.server = value; slot.worn = value; } }
        });
    }
}

export async function hatReport(file: string, confirm = process.env.HAT_CONFIRM !== "0"): Promise<HatResult> {
    const r: HatResult = {
        ticks: 0, hatEquips: 0, accEquips: 0, lateHat: {}, lateAcc: {}, noOpEquips: 0, flicker: 0, flickerKinds: {},
        conflicts: 0, conflictKinds: {}, wrongHatDamage: 0, totalDamage: 0, hatRules: {}, accRules: {}, hatMain: null
    };

    let wrapped = false;
    const patched = new WeakSet<object>();
    const hat: Slot = { server: 0, worn: 0, pending: null };
    const acc: Slot = { server: 0, worn: 0, pending: null };
    let sentHat: number | null = null, sentAcc: number | null = null;
    // What was worn on the last two ticks (before their equips): for flicker.
    const hatHistory: number[] = [], accHistory: number[] = [];
    let wornHatBefore = 0, wornAccBefore = 0;
    let prevPick = -1;
    let prevHealth: number | null = null;

    const result = await replay(readRecording(file), {
        profile: true,
        onTick: (_t: number, mod: ModApi) => {
            const { Client, AttackManager, CombatController, HatSystem, DefenseSystem } = mod;
            if (!HatSystem || !DefenseSystem) throw new Error("hat report needs replay mode \"modules\"");
            const me = Client.player;

            if (!wrapped) {
                wrapped = true;
                const socket = Client.socket as unknown as { sendMsg: (type: string, ...args: unknown[]) => void };
                const original = socket.sendMsg.bind(socket);
                socket.sendMsg = (type: string, ...args: unknown[]) => {
                    original(type, ...args);
                    if (type !== "c" || args[0] !== false) return;
                    const id = args[1] as number;
                    if (args[2]) { sentAcc = id; acc.pending = id; } else { sentHat = id; hat.pending = id; }
                };
            }

            const readyForNext = () => {
                if (me && confirm && !patched.has(me)) { patched.add(me); confirmEquips(me, hat, acc); }
                // This tick's equips have reached the server by the next update (not every update lists us).
                for (const slot of [hat, acc]) {
                    if (confirm && slot.pending !== null) slot.worn = slot.pending;
                    slot.pending = null;
                }
                wornHatBefore = me?.skinIndex ?? 0;
                wornAccBefore = me?.tailIndex ?? 0;
                sentHat = sentAcc = null;
            };

            if (!me || !Client.isAlive) { prevHealth = null; readyForNext(); return; }
            r.ticks++;

            // With confirm on, the getter already shows this tick's equip only from the next update; wornHatBefore
            // is what was worn while this tick was decided.
            const wornHat = confirm ? wornHatBefore : me.skinIndex;
            const wornAcc = confirm ? wornAccBefore : me.tailIndex;

            if (prevHealth !== null && me.health < prevHealth) {
                const lost = prevHealth - me.health;
                r.totalDamage += lost;
                if (prevPick !== -1 && wornHat !== prevPick) r.wrongHatDamage += lost;
            }
            prevHealth = me.health;

            const hatPick = HatSystem.hatPick, accPick = HatSystem.accPick;
            bump(r.hatRules, HatSystem.hatRule);
            bump(r.accRules, HatSystem.accRule);

            if (sentHat !== null) {
                r.hatEquips++;
                if (sentHat === wornHat) r.noOpEquips++;
                const twoAgo = hatHistory[hatHistory.length - 2];
                if (twoAgo === sentHat && wornHat !== sentHat) { r.flicker++; bump(r.flickerKinds, `hat ${sentHat}->${wornHat}->${sentHat}`); }
            } else if (hatPick !== -1 && hatPick !== wornHat) {
                bump(r.lateHat, HatSystem.hatRule + (me.skins[hatPick] || hatPick === 0 ? "" : " (not owned)"));
            }

            if (sentAcc !== null) {
                r.accEquips++;
                if (sentAcc === wornAcc) r.noOpEquips++;
                const twoAgo = accHistory[accHistory.length - 2];
                if (twoAgo === sentAcc && wornAcc !== sentAcc) { r.flicker++; bump(r.flickerKinds, `acc ${sentAcc}->${wornAcc}->${sentAcc}`); }
            } else if (accPick !== -1 && accPick !== wornAcc) {
                bump(r.lateAcc, HatSystem.accRule + (me.tails[accPick] || accPick === 0 ? "" : " (not owned)") + (sentHat !== null ? " (hat sent this tick)" : ""));
            }

            const asks: [string, number][] = [];
            if (DefenseSystem.skinIndex !== -1) asks.push(["defense", DefenseSystem.skinIndex]);
            const action = AttackManager.currentAttackAction;
            if (action && !action.skinData[1] && action.skinData[0] !== -1) asks.push([`attack:${action.reason}`, action.skinData[0]]);
            if (CombatController.skinIndex !== -1) asks.push([`controller:${CombatController.currentMode}`, CombatController.skinIndex]);
            if (asks.length > 1 && new Set(asks.map(a => a[1])).size > 1) {
                r.conflicts++;
                bump(r.conflictKinds, asks.map(a => `${a[0]}=${a[1]}`).join(" vs ") + ` -> ${hatPick}`);
            }

            hatHistory.push(wornHat); accHistory.push(wornAcc);
            if (hatHistory.length > 2) hatHistory.shift();
            if (accHistory.length > 2) accHistory.shift();
            prevPick = hatPick;
            readyForNext();
        }
    });

    const p = result.profile["fn.HatSystem.main"];
    if (p) r.hatMain = { calls: p.calls, meanUs: +(p.avgMs * 1000).toFixed(2), p95Us: +((p.p95Ms ?? 0) * 1000).toFixed(2) };
    return r;
}

const source = process.env.HAT_RECORDINGS ?? recordingsDir;
const files = fs.statSync(source).isDirectory()
    ? fs.readdirSync(source).filter(f => f.endsWith(".fpl")).sort().map(f => path.join(source, f))
    : [source];

describe("hat report", () => {
    for (const file of files) {
        it(path.basename(file), async () => {
            const r = await hatReport(file);
            // replay() silences console.log, so write straight to stdout.
            process.stdout.write(`${path.basename(file)}\n${JSON.stringify(r, null, 2)}\n`);
        }, 120_000);
    }
});
