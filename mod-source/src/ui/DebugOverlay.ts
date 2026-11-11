import items from "@constants/items";
import { accessoryMap, hatMap } from "@constants/store";
import Client from "@core/Client";
import DebugStats from "@core/DebugStats";
import installDebugApi from "@core/DebugApi";
import AttackManager from "@core/mod/combat/core/AttackManager";
import CombatController from "@core/mod/combat/core/CombatController";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import Latency from "@core/mod/utils/Latency";
import PingTracker from "@core/mod/utils/PingTracker";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import RendererSystem from "@rendering/RendererSystem";

/**
 * Debug Mode panel (Menu > Utility > Debug Mode). Refreshes 4x per second, not every frame,
 * and does nothing while the toggle is off.
 */
export default class DebugOverlay {
    private static element: HTMLDivElement | null = null;
    private static lastSent = 0;
    private static lastReceived = 0;
    private static lastAt = performance.now();
    private static sentPerSec = 0;
    private static receivedPerSec = 0;

    static init() {
        const el = document.createElement("div");
        el.id = "falcon-debug-overlay";
        el.style.cssText = "position:fixed;left:20px;top:170px;z-index:50;pointer-events:none;display:none;" +
            "font:12px/1.45 Consolas,monospace;color:#e8e8e8;background:rgba(0,0,0,.55);padding:8px 10px;border-radius:6px;white-space:pre;max-width:460px";
        document.body.appendChild(el);
        this.element = el;

        window.setInterval(() => this.update(), 250);
    }

    private static name(id: number | undefined, kind: "hat" | "acc" | "weapon") {
        if (id === undefined || id === null) return "-";
        if (kind === "weapon") return `${items.weapons[id]?.name ?? "?"} (${id})`;
        if (id === 0) return "none";
        const entry = kind === "hat" ? hatMap.get(id) : accessoryMap.get(id);
        return `${entry?.name ?? "?"} (${id})`;
    }

    private static update() {
        const el = this.element;
        if (!el) return;

        const enabled = !!Menu.getValue("debugMode");
        DebugStats.logPackets = enabled && !!Menu.getValue("debugLogPackets");
        el.style.display = enabled ? "block" : "none";
        if (!enabled) return;
        installDebugApi(true);

        const now = performance.now();
        const seconds = (now - this.lastAt) / 1000;
        if (seconds >= 1) {
            this.sentPerSec = Math.round((DebugStats.sentTotal - this.lastSent) / seconds);
            this.receivedPerSec = Math.round((DebugStats.receivedTotal - this.lastReceived) / seconds);
            this.lastSent = DebugStats.sentTotal;
            this.lastReceived = DebugStats.receivedTotal;
            this.lastAt = now;
        }

        const player = Client.player;
        const sim = Menu.getValue("artificialPing") ? ` | sim +${Menu.getValue("artificialPingAmt")} ms` : "";
        const lines = [
            "FALCON DEBUG",
            `Ping ${Math.round(PingTracker.getMedianPing())} ms ±${Math.round(PingTracker.getJitter())} | lead ${Math.round(Latency.getActionLeadMs())} ms${sim}${Latency.isLagging() ? " | LAG SPIKE" : ""}`,
            `FPS ${RendererSystem.fps} | packets out ${this.sentPerSec}/s, in ${this.receivedPerSec}/s`,
        ];

        if (player && Client.isAlive) {
            const primaryReload = Math.round(player.getReload(0) * 100);
            const secondaryReload = Math.round(player.getReload(1) * 100);
            lines.push(
                `Holding: ${this.name(player.weaponIndex, "weapon")}${player.buildIndex >= 0 ? ` | building item ${player.buildIndex}` : ""}`,
                `Reload: primary ${primaryReload}% | secondary ${secondaryReload}% | HP ${Math.round(player.health)} | shame ${player.shameCount}`,
                `Hat: ${this.name(player.skinIndex, "hat")} | Acc: ${this.name(player.tailIndex, "acc")}`,
                `In control: attack=${AttackManager.currentAttackAction?.reason ?? "-"} | combat=${CombatController.currentMode} | forced hat=${DefenseSystem.skinIndex >= 0 ? this.name(DefenseSystem.skinIndex, "hat") : "-"}`,
                `Heal: ${ModManager.brainState.healingResponse} | predicted dmg ${Math.round(ModManager.brainState.totalDamage)}`,
                `Activity: ${ModManager.brainState.activityList.slice(0, 6).join(", ") || "-"}`,
                `Auto Place: ${DebugStats.autoPlace.best} spots, ${DebugStats.autoPlace.allowed} allowed | items sent: ${Object.entries(DebugStats.itemSelects).map(([id, n]) => `${items.list[+id]?.name ?? id} x${n}`).join(", ") || "-"}`,
            );
        } else {
            lines.push(Client.socket ? "Not spawned / dead" : "Not connected");
        }

        lines.push(`Errors: ${DebugStats.errorCount}${DebugStats.lastError ? ` | last: ${DebugStats.lastError}` : ""}`);
        el.textContent = lines.join("\n");
    }
}
