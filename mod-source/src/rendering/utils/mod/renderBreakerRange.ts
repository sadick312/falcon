import { getWeapon } from "@constants/items";
import Client from "@core/Client";
import CombatController from "@core/mod/combat/core/CombatController";
import ObjectBreaker from "@core/mod/defense/modules/ObjectBreaker";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RenderContext";

/**
 * "Show Range" (Auto Object Breaker): our break reach and Detection Range around us, and a ring on the building being
 * hit (red) or walked to (yellow). Reach is measured to a building's edge, so a building is in reach when its edge
 * touches the white circle.
 */
export default function renderBreakerRange() {
    if (!Menu.getValue("walkBreaker") || !Menu.getValue("walkBreaker:showRange")) return;
    const player = Client.player;
    if (!player) return;

    const [xOffset, yOffset] = CameraManager.getOffset();
    const ctx = mainContext;
    let reach: number;
    try {
        reach = getWeapon(CombatController.bestWeaponForBreak()).range - 1;
    } catch {
        return;
    }
    const detectExtra = Number(Menu.getValue("walkBreaker:detectRange")) || 0;
    const x = player.render_position.x - xOffset;
    const y = player.render_position.y - yOffset;

    ctx.save();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([12, 8]);

    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, reach, 0, Math.PI * 2);
    ctx.stroke();

    if (detectExtra > 0) {
        ctx.strokeStyle = "#ecec00";
        ctx.beginPath();
        ctx.arc(x, y, reach + detectExtra, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 5;
    const target = ObjectBreaker.currentTarget ?? ObjectBreaker.farTarget;
    if (target) {
        ctx.strokeStyle = target === ObjectBreaker.currentTarget ? "#e10000" : "#ecec00";
        ctx.beginPath();
        ctx.arc(target.x - xOffset, target.y - yOffset, target.scale + 8, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}
