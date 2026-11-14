import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import Menu from "@menu/Menu";
import { mainContext } from "@rendering/RenderContext";
import RendererUtils from "@rendering/RendererUtils";
import RenderingConfig from "@rendering/RenderingConfig";

/** Auto Break → "Show Breaker State": one line on the left of the screen with what the trap breaker is doing. */
export default function renderBreakerHud() {
    if (!Menu.getValue("autoBreak") || !Menu.getValue("autoBreak:debugHud")) return;
    const s = AutoBreaker.status();
    const text = s.state === "idle" ? "Breaker: idle" : `Breaker: ${s.state} | ${s.target} | ${s.weapon}`;

    const ctx = mainContext;
    ctx.save();
    ctx.font = "18px Hammersmith One";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const x = 20;
    const y = RenderingConfig.maxScreenHeight * 0.3;
    const width = ctx.measureText(text).width + 20;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = RendererUtils.darkOutlineColor;
    ctx.beginPath();
    ctx.roundRect(x, y - 16, width, 32, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = s.state === "breaking" ? "#8ecc51" : s.state === "idle" ? "#ffffff" : "#ecec00";
    ctx.fillText(text, x + 10, y);
    ctx.restore();
}
