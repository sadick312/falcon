import { ChatMessage } from "@entities/Player";
import Client from "@core/Client";
import PingTracker from "@core/mod/utils/PingTracker";
import SocketListener from "@core/socket/SocketListener";
import PacketTracker from "@core/utils/PacketTracker";
import Menu, { ChatLog } from "@menu/Menu";
import { addChatLog } from "@menu/utils/drawChatLog";

interface ChatCommand {
    desc: string;
    run: (args: string[]) => string | void;
}

/**
 * Client-side "!" chat commands. They run locally and are never sent, so other players don't see them.
 * "/" commands (moomodding.io: /fight, /bot, /var, /clear, /help) are server commands and are sent as typed.
 */
export default class ChatCommands {
    private static readonly commands: Record<string, ChatCommand> = {
        help: {
            desc: "list commands",
            run: () => `!${Object.keys(ChatCommands.commands).join(" !")}`
        },
        clear: {
            desc: "clear the chat log",
            run: () => {
                Menu.chatLogs.length = 0;
                return "Cleared chat log.";
            }
        },
        plog: {
            desc: "download the packet log",
            run: () => {
                SocketListener.exportPacketLog(true);
                return "Downloading packet log.";
            }
        },
        pl: {
            desc: "same as !plog",
            run: (args) => ChatCommands.commands.plog.run(args)
        },
        ping: {
            desc: "show ping",
            run: () => `Ping ${Math.round(PingTracker.getCurrentPing())}ms, stable ${Math.round(PingTracker.getStablePing())}ms`
        },
        packets: {
            desc: "packets used this second",
            run: () => {
                const limit = parseInt(Menu.getValue("packetBudgetLimit"));
                return `Packets ${PacketTracker.getCurrent()}/${isNaN(limit) ? 110 : limit} in the last second`;
            }
        },
        shame: {
            desc: "show shame count",
            run: () => `Shame ${Client.player?.shameCount ?? 0}/8`
        },
    };

    /** moomodding.io server commands, offered as suggestions only. */
    private static readonly serverCommands: Record<string, string> = {
        bot: "spawn a bot (server)",
        fight: "start a fight (server)",
        var: "set a server variable",
        clear: "clear (server)",
        help: "server help",
    };

    /** Commands matching what has been typed so far, as `[command, description]`. Empty for normal chat. */
    static suggest(input: string): [string, string][] {
        const prefix = input[0];
        if (prefix !== "!" && prefix !== "/") return [];

        const typed = input.slice(1).split(" ")[0].toLowerCase();
        const source = prefix === "!" ?
            Object.entries(this.commands).map(([name, cmd]) => [name, cmd.desc] as const) :
            Object.entries(this.serverCommands);

        const matches: [string, string][] = [];
        for (const [name, desc] of source) {
            if (name.startsWith(typed)) matches.push([prefix + name, desc]);
        }

        return matches;
    }

    /** Runs `input` if it is a known "!" command. Returns true when it was handled and must not be sent. */
    static run(input: string) {
        if (!input.startsWith("!")) return false;

        const [name, ...args] = input.slice(1).trim().split(/\s+/);
        const key = name.toLowerCase();
        // Own commands only: "!constructor" or "!tostring" used to find Object's built-ins and throw on `.run`.
        if (!Object.hasOwn(this.commands, key)) return false;
        const command = this.commands[key];

        const reply = command.run(args);
        if (reply) this.reply(reply);
        return true;
    }

    private static reply(msg: string) {
        addChatLog(new ChatLog(msg));

        const player = Client.player;
        if (!player) return;

        player.chatMessages.unshift(new ChatMessage(msg));
        if (player.chatMessages.length > 3) player.chatMessages.length = 3;
    }
}
