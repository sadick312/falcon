import Client from "@core/Client";
import AimAssist from "@core/mod/combat/modules/AimAssist";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RenderContext";
import RendererUtils from "@rendering/RendererUtils";

/** "Aim Assist" → "Show Markers": a ring on the target and a dot where a ranged shot is aimed. */
export default function renderAimAssist() {
    if (!AimAssist.enabled() || !Menu.getValue("aimAssist:markers")) return;
    const target = AimAssist.target;
    if (!target || !Client.player) return;

    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    mainContext.save();
    mainContext.globalAlpha = 0.9;
    mainContext.lineWidth = 4;
    mainContext.strokeStyle = AimAssist.locked ? "#e10000" : "#ecec00";
    RendererUtils.drawCircle(target.render_position.x - xOffset, target.render_position.y - yOffset, mainContext, target.scale + 12, false, true);

    const point = AimAssist.aimPoint;
    if (point && (point.x !== target.real_position.x || point.y !== target.real_position.y)) {
        mainContext.fillStyle = "#ecec00";
        RendererUtils.drawCircle(point.x - xOffset, point.y - yOffset, mainContext, 7, true);
    }
    mainContext.restore();
}
