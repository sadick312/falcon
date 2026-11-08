import Ai, { ais } from "@entities/Ai";
import { at } from "@utils/array/at";
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

        for (const sid of hidden) {
            const ai = ais.get(sid);
            if (!ai) continue;
            ai.visible = false;
        }

        // Whole records only: [sid, type, x, y, dir * 100, health, nameIndex, 0].
        for (let i = 0; i + 8 <= data.length; i += 8) {
            const sid = at(data, i);
            const typeId = at(data, i + 1);
            const x = at(data, i + 2);
            const y = at(data, i + 3);
            const dir = at(data, i + 4) / 100;
            const health = at(data, i + 5);

            // An unknown animal type used to throw here, losing the rest of the packet.
            const type = aiTypes[typeId];
            if (!type) continue;

            let ai = ais.get(sid);

            // The server reuses an animal's sid for the next animal it spawns, possibly of another type; keeping the
            // old object would keep the old type's size, damage and name.
            if (ai && ai.index !== typeId) ai = undefined;

            if (ai) {
                ai.forcePos = Client.mode === "replay" && PacketReplayer.slowTime !== 0 ? true : !ai.visible;
                ai.last_render_position.x = ai.render_position.x;
                ai.last_render_position.y = ai.render_position.y;

                ai.still = ai.real_position.x == x && ai.real_position.y == y;

                ai.real_position.x = x;
                ai.real_position.y = y;
                ai.d1 = ai.d2;
                ai.d2 = dir;

                ai.lastHealth = ai.health;
                ai.health = health;
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
                ai = new Ai(x, y, dir, typeId);
                // Only the drawn position was set, so until its next update every check saw the animal at (0, 0).
                ai.real_position.x = x;
                ai.real_position.y = y;
                ai.lastHealth = health;
                ai.health = health;

                if (!type.name)
                    ai.name = RendererUtils.cowNames[at(data, i + 6)];

                ai.forcePos = true;
                ai.sid = sid;

                ais.replace(ai);
            }

            ai.visible = true;
        }
    }
}