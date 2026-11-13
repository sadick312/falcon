import Client from "@core/Client";
import { DangerHold, dangerLevel } from "@core/mod/utils/DangerLevel";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import { mainContext } from "@rendering/RendererSystem";
import RenderingConfig from "@rendering/RenderingConfig";

const hold = new DangerHold();

/**
 * Danger Warning (Menu > Visual): red screen edges + "DANGER" text when nearby enemies can deal a
 * lot of damage right now. Uses the expected damage Auto Healing already works out every tick
 * (ModManager.brainState.totalDamage), so it costs almost nothing per frame.
 */
export default function renderDangerWarning(now: number) {
    const player = Client.player;
    if (!Menu.getValue("dangerWarning") || !player || !Client.isAlive) {
        hold.reset();
        return;
    }

    const damage = ModManager.brainState.totalDamage;
    const warnFrom = Number(Menu.getValue("dangerWarningAt")) || 50;
    const level = hold.update(dangerLevel(damage, player.health, warnFrom), damage, now);
    if (level === 0) return;

    const w = RenderingConfig.maxScreenWidth;
    const h = RenderingConfig.maxScreenHeight;
    const pulse = .55 + .45 * Math.sin(now / (level === 2 ? 90 : 160));
    const edge = Math.min(w, h) * .12;

    mainContext.save();

    // Red glow on all four edges (stronger and faster when it can kill you).
    mainContext.globalAlpha = (level === 2 ? .55 : .35) * pulse;
    const red = level === 2 ? "220, 20, 20" : "230, 120, 20";
    const sides: [number, number, number, number, number, number, number, number][] = [
        [0, 0, 0, edge, 0, 0, w, edge],
        [0, h, 0, h - edge, 0, h - edge, w, edge],
        [0, 0, edge, 0, 0, 0, edge, h],
        [w, 0, w - edge, 0, w - edge, 0, edge, h],
    ];
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of sides) {
        const gradient = mainContext.createLinearGradient(x0, y0, x1, y1);
        gradient.addColorStop(0, `rgba(${red}, 1)`);
        gradient.addColorStop(1, `rgba(${red}, 0)`);
        mainContext.fillStyle = gradient;
        mainContext.fillRect(rx, ry, rw, rh);
    }

    // Message under the top of the screen.
    mainContext.globalAlpha = 1;
    mainContext.font = "36px Hammersmith One";
    mainContext.textAlign = "center";
    mainContext.textBaseline = "middle";
    mainContext.lineWidth = 8;
    mainContext.strokeStyle = "#3d3f42";
    mainContext.fillStyle = level === 2 ? "#ff4a4a" : "#ffb347";
    const text = level === 2 ? `CAN KILL YOU (~${Math.round(hold.damage)} dmg)` : `DANGER (~${Math.round(hold.damage)} dmg)`;
    mainContext.strokeText(text, w / 2, h * .16);
    mainContext.fillText(text, w / 2, h * .16);

    mainContext.restore();
}
