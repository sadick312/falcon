import Client from "@core/Client";
import PlayerManager from "@core/logic/players/PlayerManager";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RendererSystem";
import RenderingConfig from "@rendering/RenderingConfig";
import { edgeArrowPoint, isOnScreen } from "@rendering/utils/mod/tracerMath";

/** Enemies closer than this get a red tracer (about melee range plus a step). */
const CLOSE_RANGE = 300;
const ARROW_MARGIN = 40;

/**
 * Player Tracers (Menu > Visual): a line from you to every player the server shows you, and an
 * arrow on the screen edge for players that are off screen (when zoomed in). Red = enemy close,
 * white = enemy, green = teammate (only with "Show Teammates").
 * The server only sends players near you, so far-away players can't be shown.
 */
export default function renderTracers() {
    const me = Client.player;
    if (!Menu.getValue("playerTracers") || !me || !Client.isAlive) return;

    const mode = String(Menu.getValue("playerTracersMode") ?? "both");
    const showTeam = !!Menu.getValue("playerTracersTeam");
    const drawLines = mode !== "arrows";
    const drawArrows = mode !== "lines";

    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];
    const w = RenderingConfig.maxScreenWidth;
    const h = RenderingConfig.maxScreenHeight;
    const myX = me.render_position.x - xOffset;
    const myY = me.render_position.y - yOffset;

    const players = PlayerManager.players.visible.all;
    mainContext.save();
    mainContext.lineCap = "round";

    for (let i = 0; i < players.length; i++) {
        const other = players[i];
        if (!other || !other.visible || other.sid === me.sid) continue;

        const friendly = Client.isFriendly(other.sid);
        if (friendly && !showTeam) continue;

        const x = other.render_position.x - xOffset;
        const y = other.render_position.y - yOffset;
        const dist = Math.hypot(other.render_position.x - me.render_position.x, other.render_position.y - me.render_position.y);
        const color = friendly ? "#5fdc7a" : dist < CLOSE_RANGE ? "#ff4a4a" : "#ffffff";

        if (isOnScreen(x, y, w, h)) {
            if (!drawLines) continue;
            mainContext.globalAlpha = .55;
            mainContext.strokeStyle = color;
            mainContext.lineWidth = 3;
            mainContext.beginPath();
            mainContext.moveTo(myX, myY);
            mainContext.lineTo(x, y);
            mainContext.stroke();
        } else if (drawArrows) {
            const [ax, ay, angle] = edgeArrowPoint(w / 2, h / 2, x, y, w, h, ARROW_MARGIN);
            mainContext.globalAlpha = .9;
            mainContext.fillStyle = color;
            mainContext.strokeStyle = "#3d3f42";
            mainContext.lineWidth = 3;

            mainContext.save();
            mainContext.translate(ax, ay);
            mainContext.rotate(angle);
            mainContext.beginPath();
            mainContext.moveTo(18, 0);
            mainContext.lineTo(-12, -12);
            mainContext.lineTo(-6, 0);
            mainContext.lineTo(-12, 12);
            mainContext.closePath();
            mainContext.stroke();
            mainContext.fill();
            mainContext.restore();

            // Distance next to the arrow.
            mainContext.font = "18px Hammersmith One";
            mainContext.textAlign = "center";
            mainContext.textBaseline = "middle";
            const label = `${Math.round(dist)}`;
            const lx = ax - Math.cos(angle) * 30;
            const ly = ay - Math.sin(angle) * 30;
            mainContext.strokeText(label, lx, ly);
            mainContext.fillText(label, lx, ly);
        }
    }

    mainContext.restore();
}
