import { ChatMessage } from "@constants/Player";
import Client from "@core/Client";
import PingTracker from "@core/mod/utils/PingTracker";
import SocketListener from "@core/socket/SocketListener";
import PacketTracker from "@core/utils/PacketTracker";
import Menu, { ChatLog } from "@menu/Menu";
import drawChatLog from "@menu/utils/drawChatLog";

type CommandHandler = (args: string[]) => string | void;

/**
 * Client-side "!" chat commands. They run locally and are never sent, so other players don't see them.
 * "/" commands (moomodding.io: /fight, /bot, /var, /clear, /help) are server commands and are sent as typed.
 */
export default class ChatCommands {
    private static readonly commands: Record<string, CommandHandler> = {
        help: () => `!${Object.keys(ChatCommands.commands).join(" !")}`,
        clear: () => {
            Menu.chatLogs.length = 0;
            return "Cleared chat log.";
        },
        plog: () => {
            SocketListener.sendFplToDiscord(true);
            return "Downloading packet log.";
        },
        pl: (args) => ChatCommands.commands.plog(args),
        ping: () => `Ping ${Math.round(PingTracker.getCurrentPing())}ms, stable ${Math.round(PingTracker.getStablePing())}ms`,
        packets: () => {
            const limit = parseInt(Menu.getValue("packetBudgetLimit"));
            return `Packets ${PacketTracker.getCurrent()}/${isNaN(limit) ? 110 : limit} in the last second`;
        },
        shame: () => `Shame ${Client.player?.shameCount ?? 0}/8`,
    };

    /** Runs `input` if it is a known "!" command. Returns true when it was handled and must not be sent. */
    static run(input: string) {
        if (!input.startsWith("!")) return false;

        const [name, ...args] = input.slice(1).trim().split(/\s+/);
        const handler = this.commands[name.toLowerCase()];
        if (!handler) return false;

        const reply = handler(args);
        if (reply) this.reply(reply);
        return true;
    }

    private static reply(msg: string) {
        Menu.chatLogs.push(new ChatLog(msg));
        if (Menu.selectedTab === 5) drawChatLog();

        const player = Client.player;
        if (!player) return;

        player.chatMessages.unshift(new ChatMessage(msg));
        if (player.chatMessages.length > 3) player.chatMessages.length = 3;
    }
}
