/**
 * Aim report (Part 1 / 1D): how often Falcon's melee attacks would land, measured offline from replays.
 *
 * A melee attack is Falcon turning auto-gather on (AUTO_GATHER "K") while aiming with SEND_AIM "D". The server swings
 * on the next tick, in the last direction it received, and hits a player when (1.8.2 `player.gather`):
 *   distance - 35 × 1.8 <= weapon range   and   angle to them within 1.208 rad (~69°) of the aim.
 * So each attack sent while handling tick T is judged against everyone's positions after tick T + 1.
 *
 * The sample recordings are synthetic: their "server" never answers Falcon's own swings, so they can't say whether a
 * hit really landed. This report uses the rule above on the replayed positions instead. For real recordings (!plog)
 * the same numbers apply, and the recording's own GATHER_ANIMATION packets also say what really happened.
 *
 * Besides the aim Falcon sent ("sent"), it scores a "lead" aim: from our predicted next position to the target's
 * predicted next position (Player.next_position, which already includes knockback, the river current and slowdowns).
 *
 * Run: npx vitest run --config vitest.bench.config.mts mod-source/bench/aim-report.bench-run.ts
 *   AIM_RECORDINGS  folder or single .fpl (default mod-source/bench/recordings)
 */
import fs from "fs";
import path from "path";
import { describe, it } from "vitest";
import { readRecording, recordingsDir, replay, type ModApi } from "./replay";

const GATHER_ANGLE = 1.208304866765305;
const HIT_PAD = 35 * 1.8;

interface Pos { x: number; y: number }
interface Enemy extends Pos { sid: number }
interface Attack { tick: number }
/** After each tick: positions, plus the aim Falcon had sent by the end of it and what it would be with leading. */
interface TickState {
    me: Pos | null; weapon: number; enemies: Enemy[]; aim: number; enemyAngle: number | null; leadAim: number | null;
    /** The attack Falcon is running (AttackAction.reason), the nearest enemy, and our and their predicted next positions. */
    reason: string; nearestSid: number | null; meNext: Pos | null; nearestNext: Pos | null;
}

const angleDist = (a: number, b: number) => {
    const d = Math.abs(a - b) % (Math.PI * 2);
    return d > Math.PI ? Math.PI * 2 - d : d;
};
const dir = (to: Pos, from: Pos) => Math.atan2(to.y - from.y, to.x - from.x);

export interface AimResult {
    /** Attacks aimed elsewhere (a trap, a building, a custom aim): not scored. */
    otherAttacks: number;
    attacks: number;
    sent: { hit: number; outOfRange: number; outOfCone: number; noTarget: number };
    lead: { hit: number; outOfCone: number };
    /** For attacks the sent aim missed only on angle: tick and how far off (radians). */
    coneMisses: { tick: number; off: number }[];
    /** Attacks that missed because the target was out of reach on the swing tick, with the distances (edge to edge, minus range). */
    rangeMisses: { tick: number; reason: string; weapon: number; gapAtDecision: number; predictedGap: number | null; gapAtSwing: number; ourStep: number; theirStep: number }[];
    /** Smallest spare angle (cone half-width minus error) among sent-aim hits: how close the aim came to missing. */
    tightestHit: number | null;
}

export async function aimReport(file: string): Promise<AimResult> {
    const states: TickState[] = [];
    const attacks: Attack[] = [];
    let tick = 0;
    let lastAim = 0;
    let wrapped = false;

    await replay(readRecording(file), {
        onTick: (t: number, mod: ModApi) => {
            tick = t;
            const { Client, ModManager, PlayerManager, AttackManager, CombatController } = mod;
            if (!wrapped) {
                wrapped = true;
                const socket = Client.socket as unknown as { sendMsg: (type: string, ...args: unknown[]) => void };
                const original = socket.sendMsg.bind(socket);
                socket.sendMsg = (type: string, ...args: unknown[]) => {
                    original(type, ...args);
                    if (type === "D" && typeof args[0] === "number") lastAim = args[0];
                    if (type === "K") {
                        // AUTO_GATHER toggles: Falcon sends it once to start attacking (attackState.status just set to true)
                        // and once to stop. Counting toggles would drift after a death, which resets it on both sides.
                        if (!CombatController.attackState.status) return;
                        attacks.push({ tick: tick + 1 }); // sent while handling the tick after the last onTick
                    }
                };
            }

            const me = Client.player;
            const nearest = ModManager.enemyData.nearest;
            states[t] = {
                reason: AttackManager.currentAttackAction?.reason ?? "(none)",
                nearestSid: nearest?.sid ?? null,
                meNext: me ? { x: me.next_position.x, y: me.next_position.y } : null,
                nearestNext: nearest ? { x: nearest.next_position.x, y: nearest.next_position.y } : null,
                aim: lastAim,
                enemyAngle: nearest ? ModManager.enemyData.angle : null,
                leadAim: me && nearest ? dir(nearest.next_position, me.next_position) : null,
                me: me ? { x: me.real_position.x, y: me.real_position.y } : null,
                weapon: me?.weaponIndex ?? 0,
                enemies: PlayerManager.players.visible.all
                    .filter(p => p.sid !== Client.mySID && !Client.isFriendly(p.sid))
                    .map(p => ({ sid: p.sid, x: p.real_position.x, y: p.real_position.y }))
            };
        }
    });

    const { getWeapon } = await import("@constants/items");
    const result: AimResult = { otherAttacks: 0, attacks: 0, sent: { hit: 0, outOfRange: 0, outOfCone: 0, noTarget: 0 }, lead: { hit: 0, outOfCone: 0 }, coneMisses: [], rangeMisses: [], tightestHit: null };

    for (const attack of attacks) {
        // The aim is the one in effect when the server swings (sent by the end of the attack's tick).
        const sentIn = states[attack.tick];
        const judged = states[attack.tick + 1];
        if (!sentIn || !judged?.me) continue;
        // Only attacks aimed at the nearest enemy (not at a trap, a building being broken, or a custom aim).
        if (sentIn.enemyAngle === null || angleDist(sentIn.aim, sentIn.enemyAngle) > 1e-6) { result.otherAttacks++; continue; }
        const sentAim = sentIn.aim;
        const leadAim = sentIn.leadAim;
        const range = getWeapon(judged.weapon).range;
        if (!(range > 0)) continue; // ranged weapon: not a melee swing
        result.attacks++;

        const inRange = judged.enemies.filter(e => Math.hypot(e.x - judged.me!.x, e.y - judged.me!.y) - HIT_PAD <= range);
        if (!judged.enemies.length) { result.sent.noTarget++; continue; }
        if (!inRange.length) {
            result.sent.outOfRange++;
            const gap = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.y - b.y) - HIT_PAD - range;
            const target = sentIn.enemies.find(e => e.sid === sentIn.nearestSid);
            const targetLater = judged.enemies.find(e => e.sid === sentIn.nearestSid);
            if (target && targetLater && sentIn.me) result.rangeMisses.push({
                tick: attack.tick, reason: sentIn.reason, weapon: judged.weapon,
                gapAtDecision: +gap(target, sentIn.me).toFixed(1),
                predictedGap: sentIn.meNext && sentIn.nearestNext ? +gap(sentIn.nearestNext, sentIn.meNext).toFixed(1) : null,
                gapAtSwing: +gap(targetLater, judged.me).toFixed(1),
                ourStep: +Math.hypot(judged.me.x - sentIn.me.x, judged.me.y - sentIn.me.y).toFixed(1),
                theirStep: +Math.hypot(targetLater.x - target.x, targetLater.y - target.y).toFixed(1)
            });
            continue;
        }

        const bestOff = Math.min(...inRange.map(e => angleDist(dir(e, judged.me!), sentAim)));
        if (bestOff <= GATHER_ANGLE) {
            result.sent.hit++;
            result.tightestHit = Math.min(result.tightestHit ?? Infinity, GATHER_ANGLE - bestOff);
        } else {
            result.sent.outOfCone++;
            result.coneMisses.push({ tick: attack.tick, off: +bestOff.toFixed(3) });
        }

        if (leadAim !== null) {
            const leadOff = Math.min(...inRange.map(e => angleDist(dir(e, judged.me!), leadAim)));
            if (leadOff <= GATHER_ANGLE) result.lead.hit++;
            else result.lead.outOfCone++;
        }
    }

    return result;
}

const source = process.env.AIM_RECORDINGS ?? recordingsDir;
const files = fs.statSync(source).isDirectory()
    ? fs.readdirSync(source).filter(f => f.endsWith(".fpl")).sort().map(f => path.join(source, f))
    : [source];

describe("aim report", () => {
    for (const file of files) {
        it(path.basename(file), async () => {
            const r = await aimReport(file);
            const pct = (n: number) => r.attacks ? `${(100 * n / r.attacks).toFixed(1)}%` : "-";
            console.log(`${path.basename(file)}: ${r.attacks} melee attacks at the nearest enemy (${r.otherAttacks} aimed elsewhere, not scored) | sent aim would hit ${r.sent.hit} (${pct(r.sent.hit)}), ` +
                `out of range ${r.sent.outOfRange}, out of the aim cone ${r.sent.outOfCone}, no enemy ${r.sent.noTarget} | ` +
                `lead aim would hit ${r.lead.hit} (${pct(r.lead.hit)}) | tightest sent hit had ${r.tightestHit?.toFixed(2) ?? "-"} rad to spare` +
                (r.coneMisses.length ? ` | cone misses: ${JSON.stringify(r.coneMisses.slice(0, 10))}` : ""));
            for (const m of r.rangeMisses) console.log(`  range miss tick ${m.tick} (${m.reason}, weapon ${m.weapon}): gap ${m.gapAtDecision} when decided, Falcon predicted ${m.predictedGap}, ${m.gapAtSwing} at the swing; we moved ${m.ourStep}, they moved ${m.theirStep}`);
        });
    }
});
