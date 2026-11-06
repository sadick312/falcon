import Ai, { ais } from "@entities/Ai";
import aiTypes from "@constants/aiTypes";
import Client from "@core/Client";
import TextManager from "@core/logic/TextManager";
import PacketReplayer from "@core/PacketReplayer";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import Menu from "@menu/Menu";
import RendererUtils from "@rendering/RendererUtils";
import PacketMap from "@root/utils/socket/PacketMap";

type LoadAiPacket = typeof PacketMap.SERVER_TO_CLIENT.LOAD_AI;

export default class LoadAiEvent extends MessageHandler<LoadAiPacket> {
    run(data: number[], hidden: number[]) {
        const stackedText = Menu.getValue("stackedText");

        for (let i = 0; i < hidden.length; i++) {
            const ai = ais.get(hidden[i]);
            if (!ai) continue;
            ai.visible = false;
        }

        for (let i = 0; i < data.length; i += 8) {
            // An unknown animal type used to throw here, losing the rest of the packet.
            if (!aiTypes[data[i + 1]]) continue;

            let ai = ais.get(data[i]);

            // The server reuses an animal's sid for the next animal it spawns, possibly of another type; keeping the
            // old object would keep the old type's size, damage and name.
            if (ai && ai.index !== data[i + 1]) ai = undefined;

            if (ai) {
                ai.forcePos = Client.mode === "replay" && PacketReplayer.slowTime !== 0 ? true : !ai.visible;
                ai.last_render_position.x = ai.render_position.x;
                ai.last_render_position.y = ai.render_position.y;

                ai.still = ai.real_position.x == data[i + 2] && ai.real_position.y == data[i + 3];

                ai.real_position.x = data[i + 2];
                ai.real_position.y = data[i + 3];
                ai.d1 = ai.d2;
                ai.d2 = data[i + 4] / 100;

                ai.lastHealth = ai.health;
                ai.health = data[i + 5];
                ai.deltaTime = 0;

                if (stackedText && ai.forcePos) {
                    const d = ai.health - ai.lastHealth;

                    if (d < 0) {
                        TextManager.add(ai.real_position.x, ai.real_position.y, -(~~d), 0);
                    }

                    // > 0: an animal coming back into view with unchanged health showed a "0".
                    if (d > 0) {
                        TextManager.add(ai.real_position.x, ai.real_position.y, ~~d, 0);
                    }
                }
            } else {
                // The packet's direction is × 100 (the update branch above divides too); this one used to be passed as is.
                ai = new Ai(data[i + 2], data[i + 3], data[i + 4] / 100, data[i + 1]);
                // Only the drawn position was set, so until its next update every check saw the animal at (0, 0).
                ai.real_position.x = data[i + 2];
                ai.real_position.y = data[i + 3];
                ai.lastHealth = data[i + 5];
                ai.health = data[i + 5];

                if (!aiTypes[data[i + 1]].name)
                    ai.name = RendererUtils.cowNames[data[i + 6]];

                ai.forcePos = true;
                ai.sid = data[i];

                ais.replace(ai);
            }

            ai.visible = true;
        }
    }
}