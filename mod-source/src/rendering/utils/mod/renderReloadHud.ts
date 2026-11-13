import Player from "@entities/Player";
import { getWeapon } from "@constants/items";
import Client from "@core/Client";
import { tickState } from "@core/TickState";
import Menu from "@menu/Menu";
import { mainContext } from "@rendering/RenderContext";
import RendererUtils from "@rendering/RendererUtils";
import RenderingConfig from "@rendering/RenderingConfig";
import ScriptConfig from "@utils/config/ScriptConfig";

interface ReloadHudRow {
    /** "You" or "Enemy". */
    who: string;
    /** The weapon's name, or "?" when it is only a guess (an enemy weapon not seen yet). */
    weapon: string;
    /** 0 (just swung) to 1 (ready). */
    reload: number;
    /** Server ticks until ready: 0 = ready now. */
    ticksLeft: number;
}

/** Server ticks left until a weapon at `reload` (0..1) with a full reload of `reloadMs` is ready. */
export function ticksUntilReady(reload: number, reloadMs: number) {
    if (!(reload < 1)) return 0;
    const msLeft = (1 - Math.max(0, reload)) * reloadMs;
    return Math.ceil(msLeft / ScriptConfig.SERVER_UPDATE_SPEED);
}

function rowFor(player: Player, group: 0 | 1, who: string): ReloadHudRow | null {
    const data = player.weaponData;
    const id = group === 0 ? data.primary : data.secondary;
    if (id === undefined || id === null || isNaN(id)) return null;
    const confirmed = group === 0 ? data.primaryConfirmed : data.secondaryConfirmed;
    let name: string;
    try {
        name = getWeapon(id).name;
    } catch {
        return null;
    }
    const reload = player.getReload(group);
    const reloadMs = player.reloadTimes[id] ?? getWeapon(id).speed;
    return {
        who,
        weapon: confirmed ? name : `${name}?`,
        reload: isNaN(reload) ? 1 : reload,
        ticksLeft: ticksUntilReady(isNaN(reload) ? 1 : reload, reloadMs)
    };
}

/** The HUD's rows: our primary and secondary, then the nearest enemy's (when there is one). */
export function reloadHudRows(me: Player | undefined, enemy: Player | null | undefined): ReloadHudRow[] {
    const rows: ReloadHudRow[] = [];
    if (me) {
        const a = rowFor(me, 0, "You");
        const b = me.weapons[1] === undefined ? null : rowFor(me, 1, "You");
        if (a) rows.push(a);
        if (b) rows.push(b);
    }
    if (enemy) {
        const a = rowFor(enemy, 0, "Enemy");
        const b = rowFor(enemy, 1, "Enemy");
        if (a) rows.push(a);
        if (b) rows.push(b);
    }
    return rows;
}

const ROW_H = 34;
const PANEL_W = 330;
const BAR_W = 120;

/** "Reload HUD": a fixed panel on the left of the screen with both of our reloads and the nearest enemy's. */
export default function renderReloadHud() {
    if (!Menu.getValue("reloadBars") || !Menu.getValue("reloadBars:hud")) return;
    const rows = reloadHudRows(Client.player, tickState.enemyData.nearest);
    if (rows.length === 0) return;

    const x = 20;
    const height = rows.length * ROW_H + 12;
    const y = RenderingConfig.maxScreenHeight * 0.45 - height / 2;
    const ctx = mainContext;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = RendererUtils.darkOutlineColor;
    ctx.beginPath();
    ctx.roundRect(x, y, PANEL_W, height, 10);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.font = "18px Hammersmith One";
    ctx.textBaseline = "middle";

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const rowY = y + 6 + i * ROW_H + ROW_H / 2;

        ctx.textAlign = "left";
        ctx.fillStyle = row.who === "You" ? "#8ecc51" : "#cc5151";
        ctx.fillText(`${row.who}: ${row.weapon}`, x + 10, rowY);

        const barX = x + PANEL_W - BAR_W - 52;
        ctx.fillStyle = "#3d3f42";
        ctx.fillRect(barX, rowY - 6, BAR_W, 12);
        ctx.fillStyle = row.reload >= 1 ? "#8ecc51" : "#a5974c";
        ctx.fillRect(barX, rowY - 6, BAR_W * Math.max(0, Math.min(1, row.reload)), 12);

        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(row.ticksLeft === 0 ? "ready" : `${row.ticksLeft}t`, x + PANEL_W - 8, rowY);
    }

    ctx.restore();
}
