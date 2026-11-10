import NameSpriteCache from "@rendering/core/NameSpriteCache";
import { ais } from "@constants/Ai";
import Player from "@constants/Player";
import Client from "@core/Client";
import PlayerManager from "@core/logic/players/PlayerManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import ModManager from "@core/ModManager";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import SpriteCache from "@rendering/core/SpriteCache";
import { mainContext } from "@rendering/RendererSystem";
import RendererUtils from "@rendering/RendererUtils";

export default function renderNames() {
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    const reloadBarToggle = Menu.getValue("reloadBars");
    const renderShameCount = Menu.getValue("renderShameCounter");
    const renderTurretReload = Menu.getValue("renderTurretReload");
    const renderPacketCounter = Menu.getValue("renderPacketCounter");
    const renderOwnership = Menu.getValue("renderOwnership");
    const renderNames = Menu.getValue("renderNames");
    const renderPlacementTime = Menu.getValue("renderPlacementTime");

    mainContext.strokeStyle = RendererUtils.darkOutlineColor;

    const players = PlayerManager.players.visible.all;
    const playersLen = players.length;
    const totalLen = playersLen + ais.all.length;
    const crownPad = 35;
    const tmpS = 60;

    for (let i = 0; i < totalLen; i++) {
        const entity = players[i] || ais.all[i - playersLen];

        if (entity && entity.visible) {
            const teamName = (entity as Player).team;
            const tmpName = renderNames ? `${teamName ? `[${teamName}] ` : ""}${entity.name || ""}` : "";

            let nameWidth = 0;

            if (tmpName) {
                // Cached sprite instead of strokeText/fillText every frame (see NameSpriteCache).
                const sprite = NameSpriteCache.get(tmpName, entity.nameScale || 30, entity.nameScale ? 11 : 8, "#ffffff", RendererUtils.darkOutlineColor);
                const nameX = entity.render_position.x - xOffset;
                const nameY = (entity.render_position.y - yOffset - entity.scale) - RendererUtils.nameY;
                mainContext.drawImage(sprite.canvas, nameX - sprite.width / 2, nameY - sprite.height / 2, sprite.width, sprite.height);
                nameWidth = sprite.textWidth;

                if (entity.isLeader && SpriteCache.iconSprites["crown"].isLoaded) {
                    const tmpX = entity.render_position.x - xOffset - (tmpS / 2) - (nameWidth / 2) - crownPad;

                    mainContext.drawImage(
                        SpriteCache.iconSprites["crown"],
                        tmpX,
                        (entity.render_position.y - yOffset - entity.scale) - RendererUtils.nameY - (tmpS / 2) - 5,
                        tmpS,
                        tmpS
                    );
                }

                if (entity.iconIndex == 1 && SpriteCache.iconSprites["skull"].isLoaded) {
                    const tmpX = entity.render_position.x - xOffset - (tmpS / 2) + (nameWidth / 2) + crownPad;

                    mainContext.drawImage(
                        SpriteCache.iconSprites["skull"],
                        tmpX,
                        (entity.render_position.y - yOffset - entity.scale) - RendererUtils.nameY - (tmpS / 2) - 5,
                        tmpS,
                        tmpS
                    );
                }
            }

            if (entity.isPlayer && ModManager.enemyData.nearest?.sid === entity.sid) {
                if (AttackManager.oneTicker.tapMode && SpriteCache.iconSprites["oneTickCrosshair"].isLoaded) {
                    mainContext.drawImage(
                        SpriteCache.iconSprites["oneTickCrosshair"],
                        entity.render_position.x - xOffset - tmpS / 2,
                        entity.render_position.y - yOffset - tmpS / 2,
                        tmpS,
                        tmpS
                    );
                } else if (AttackManager.autoInstaToggle && SpriteCache.iconSprites["crosshair"].isLoaded) {
                    mainContext.drawImage(
                        SpriteCache.iconSprites["crosshair"],
                        entity.render_position.x - xOffset - tmpS / 2,
                        entity.render_position.y - yOffset - tmpS / 2,
                        tmpS,
                        tmpS
                    );
                }
            }

            if (renderShameCount && entity.isPlayer) {
                const shameXCoords = entity.render_position.x - xOffset + (nameWidth / 2) + crownPad + (entity.clowned ? crownPad * .5 : 0) + (entity.iconIndex == 1 ? crownPad * 1.5 : 0)
                const shameYCoords = entity.render_position.y - yOffset - 35 - RendererUtils.nameY;
                const text = entity.clowned ? (entity.shameTimer / 1e3).toFixed(1) : entity.shameCount.toString();

                NameSpriteCache.draw(mainContext, text, shameXCoords, shameYCoords, entity.nameScale || 30, entity.nameScale ? 11 : 8, "#ff0000", RendererUtils.darkOutlineColor);
            }

            if (entity.isPlayer && entity.sid === Client.mySID) {
                if (renderPacketCounter) {
                    const packets = PacketTracker.getCurrent();
                    const minPackets = 30;
                    const maxPackets = 120;
                    const ratio = Math.min(1, Math.max(0, (packets - minPackets) / (maxPackets - minPackets)));
                    const gbValue = Math.round(255 * (1 - ratio));

                    const effectiveY = entity.render_position.y - yOffset - entity.scale - RendererUtils.nameY * 2;
                    NameSpriteCache.draw(mainContext, packets.toString(), entity.render_position.x - xOffset, effectiveY, 13, 4, `rgb(255, ${gbValue}, ${gbValue})`, RendererUtils.darkOutlineColor);
                }

                if (renderPlacementTime) {
                    const text = `[${Client.placementTime.join(", ")}]`;
                    const effectiveY = entity.render_position.y - yOffset - entity.scale - (RendererUtils.nameY / 2) + 5;
                    NameSpriteCache.draw(mainContext, text, entity.render_position.x - xOffset, effectiveY, 13, 4, "#fff", RendererUtils.darkOutlineColor);
                }
            }

            if (renderOwnership && entity.isPlayer) {
                NameSpriteCache.draw(mainContext, entity.sid.toString(), entity.render_position.x - xOffset, entity.render_position.y - yOffset, 14, 8, "#fff", RendererUtils.darkOutlineColor);
            }

            if (entity.health > 0) {
                const tmpWidth = RendererUtils.healthBarWidth;

                mainContext.fillStyle = RendererUtils.darkOutlineColor;
                mainContext.roundRect(
                    entity.render_position.x - xOffset - tmpWidth - RendererUtils.healthBarPad,
                    (entity.render_position.y - yOffset + entity.scale) + RendererUtils.nameY,
                    tmpWidth * 2 + RendererUtils.healthBarPad * 2,
                    17,
                    8
                );
                mainContext.fill();

                mainContext.fillStyle = (entity == Client.player || (teamName && teamName == Client.player?.team)) ? "#8ecc51" : "#cc5151";
                mainContext.roundRect(
                    entity.render_position.x - xOffset - tmpWidth,
                    (entity.render_position.y - yOffset + entity.scale) + RendererUtils.nameY + RendererUtils.healthBarPad,
                    (tmpWidth * 2) * (entity.health / entity.maxHealth),
                    17 - RendererUtils.healthBarPad * 2,
                    7
                );
                mainContext.fill();

                if (entity.isPlayer && reloadBarToggle) {
                    const primaryReloadPercent = entity.getReload(0);
                    const secondaryReloadPercent = entity.getReload(1);
                    const turretReloadPercent = entity.getReload(2);

                    // SECONDARY BAR:
                    if (secondaryReloadPercent !== 1) {
                        mainContext.fillStyle = RendererUtils.darkOutlineColor;
                        mainContext.roundRect(
                            entity.render_position.x - xOffset + 2 - RendererUtils.healthBarPad,
                            entity.render_position.y - yOffset + entity.scale + RendererUtils.nameY - 13,
                            2 * 23.5 + 2 * RendererUtils.healthBarPad,
                            17,
                            10
                        );
                        mainContext.fill();

                        mainContext.fillStyle = "#a5974c";
                        mainContext.roundRect(
                            entity.render_position.x - xOffset + 2,
                            entity.render_position.y - yOffset + entity.scale + RendererUtils.nameY - 13 + RendererUtils.healthBarPad,
                            2 * 23.5 * secondaryReloadPercent,
                            16 - 2 * RendererUtils.healthBarPad,
                            10
                        );
                        mainContext.fill();
                    }


                    // PRIMARY BAR:
                    if (primaryReloadPercent !== 1) {
                        mainContext.fillStyle = RendererUtils.darkOutlineColor;
                        mainContext.roundRect(
                            entity.render_position.x - xOffset - 50 - RendererUtils.healthBarPad,
                            entity.render_position.y - yOffset + entity.scale + RendererUtils.nameY - 13,
                            2 * 23.5 + 2 * RendererUtils.healthBarPad,
                            17,
                            10
                        );
                        mainContext.fill();

                        mainContext.fillStyle = "#a5974c";
                        mainContext.roundRect(
                            entity.render_position.x - xOffset - 50,
                            entity.render_position.y - yOffset + entity.scale + RendererUtils.nameY - 13 + RendererUtils.healthBarPad,
                            2 * 23.5 * primaryReloadPercent,
                            16 - 2 * RendererUtils.healthBarPad,
                            10
                        );
                        mainContext.fill();
                    }

                    // TURRET BAR:
                    if (turretReloadPercent !== 1 && renderTurretReload) {
                        const borderHeight = 10;
                        const height = 14;

                        mainContext.fillStyle = RendererUtils.darkOutlineColor;
                        mainContext.roundRect(
                            entity.render_position.x - xOffset - tmpWidth - RendererUtils.healthBarPad,
                            (entity.render_position.y - yOffset + entity.scale) + 14 + RendererUtils.nameY,
                            tmpWidth * 2 + RendererUtils.healthBarPad * 2,
                            borderHeight,
                            6
                        );
                        mainContext.fill();

                        mainContext.fillStyle = "#a5974c";
                        mainContext.roundRect(
                            entity.render_position.x - xOffset - tmpWidth,
                            (entity.render_position.y - yOffset + entity.scale) + 14 + RendererUtils.nameY + RendererUtils.healthBarPad / 2,
                            tmpWidth * 2 * turretReloadPercent,
                            height - RendererUtils.healthBarPad * 2,
                            5
                        );
                        mainContext.fill();
                    }
                }
            }
        }
    }
}