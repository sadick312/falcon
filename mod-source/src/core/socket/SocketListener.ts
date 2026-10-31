import Player, { ChatMessage } from "@entities/Player";
import Client, { deathText, pingDisplay } from "@core/Client";
import updateClanMenu, { allianceHolder } from "@core/events/updateClanMenu";
import updateItems from "@core/events/updateItems";
import updateNotifications from "@core/events/updateNotifications";
import updatePlayerValue from "@core/events/updatePlayerValue";
import updateUpgrades from "@core/events/updateUpgrades";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import PotentialObjectManager from "@core/logic/PotentialObjectManager";
import ProjectileManager from "@core/logic/ProjectileManager";
import TextManager from "@core/logic/TextManager";
import CombatController from "@core/mod/combat/core/CombatController";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import AutoBuyer from "@core/mod/utils/AutoBuyer";
import PingTracker from "@core/mod/utils/PingTracker";
import ModManager from "@core/ModManager";
import { packetReplayerUI } from "@core/PacketReplayer";
import AnimateAiEvent from "@core/socket/events/core/AnimateAiEvent";
import GatherAnimationEvent from "@core/socket/events/core/GatherAnimationEvent";
import HealthUpdateEvent from "@core/socket/events/core/HealthUpdateEvent";
import LoadAiEvent from "@core/socket/events/core/LoadAiEvent";
import PlayerUpdateEvent from "@core/socket/events/core/PlayerUpdateEvent";
import StoreItemsUpdateEvent from "@core/socket/events/core/StoreItemsUpdateEvent";
import FakeSocket from "@core/socket/FakeSocket";
import Socket, { respawnMainCard, socketHooks } from "@core/socket/Socket";
import PacketBatcher from "@core/utils/PacketBatcher";
import Menu, { ChatLog } from "@menu/Menu";
import { addChatLog } from "@menu/utils/drawChatLog";
import CameraManager from "@rendering/core/CameraManager";
import RendererSystem from "@rendering/RendererSystem";
import { IncomingServerPackets } from "@root/utils/socket/PacketLogging";
import PacketMap, { MOOMOO_SERVER_TO_CLIENT_MAP } from "@root/utils/socket/PacketMap";
import PacketRecorder from "@services/packet-recorder/PacketRecorder";
import { showServerRestarting } from "@ui/ConnectionError";
import { enterGameBtn } from "@ui/Hook";
import { gameUI, loadingCirclePage, respawnPage } from "@ui/Loader";
import ScriptConfig from "@utils/config/ScriptConfig";
import getElem from "@utils/dom/getElem";
import kFormat from "@utils/math/kFormat";
import shortnameToUnicode from "@utils/text/shortnameToUnicode";

const ageBar = getElem("age-bar");
const ageDisplay = getElem("age-display");
const leaderboardData = getElem("leaderboard");

/** Item group index (UPDATE_ITEM_COUNTS) -> the hotbar item ids whose count label shows it. */
const itemCountElements = {
    1: [19, 20, 21],
    2: [22, 23, 24, 25],
    3: [26, 27, 28],
    4: [29],
    5: [31],
    6: [32],
    7: [33],
    8: [34],
    9: [35],
    10: [36],
    11: [30],
    12: [37],
    13: [38]
};

export default class SocketListener {
    static isInitialized = false;

    private static socket: Socket | FakeSocket;
    private static lastPingSocket = 0;
    private static awaitingPong = false;

    static pingSocket() {
        if (!this.isInitialized) return;

        // A reply slower than the 1s interval would otherwise be timed against the newer ping and read far too low.
        const now = performance.now();
        if (this.awaitingPong && now - this.lastPingSocket < 5e3) return;

        this.awaitingPong = true;
        this.lastPingSocket = now;
        this.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.PING_SOCKET);
    }

    static logPacket(type: keyof MOOMOO_SERVER_TO_CLIENT_MAP, typedData: unknown) {
        if (!PacketRecorder.shouldRecord(type)) return;

        PacketRecorder.add(type, {
            timestamp: performance.now(),
            brainState: type === PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS ? ModManager.brainState : undefined,
            packetData: {
                type: type,
                data: typedData
            } as IncomingServerPackets
        });
    }

    static handleAllianceUpdates(player: Player, newTeam: string) {
        const oldTeam = player.team;
        const allianceMap = Client.allianceMap;

        if (newTeam !== oldTeam && allianceMap.has(oldTeam)) {
            const members = allianceMap.get(oldTeam)!;
            members.delete(player.sid);
            if (members.size === 0) allianceMap.delete(oldTeam);
        }

        player.team = newTeam;

        if (newTeam) {
            if (!allianceMap.has(newTeam)) {
                allianceMap.set(newTeam, new Set());
            }

            allianceMap.get(newTeam)!.add(player.sid);
        }
    }

    /** Downloads the last ~15s of packets as an .fpl file (always when manual; on death, depending on the logging toggles). */
    static exportPacketLog(manual: boolean = false) {
        if (this.socket instanceof FakeSocket) return;

        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');

        const fileName = `${manual ? "m" : "d"}_log_${date}_${time}.fpl`;
        const buffer = PacketRecorder.compileBinaryLog();
        if (!buffer) return;

        if (!Menu.getValue("improvementLogging") || Menu.getValue("improvementLoggingLCopy") || ScriptConfig.IS_DEVELOPMENT_MODE || manual) {
            const blob = new Blob([buffer], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);

            link.click();
            link.remove();

            // Revoking in the same task can cancel the download in some browsers.
            setTimeout(() => URL.revokeObjectURL(url), 1e3);
        }
    }

    private static pingTimer: number | undefined;

    /** Stops the 1s ping loop. Called when the socket closes so the interval doesn't outlive it. */
    static stopPinging() {
        this.awaitingPong = false;
        if (this.pingTimer === undefined) return;
        clearInterval(this.pingTimer);
        this.pingTimer = undefined;
    }

    static hookEvents(socket: Socket | FakeSocket) {
        if (this.isInitialized) return;

        this.isInitialized = true;
        this.socket = socket;

        if (socket instanceof Socket) {
            // Stop first: stopPinging() clears awaitingPong, which would make us ignore the reply to this first ping.
            this.stopPinging();
            this.pingSocket();
            this.pingTimer = window.setInterval(() => this.pingSocket(), 1e3);
        }

        const playerUpdateEvent = new PlayerUpdateEvent(this.socket);
        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS, (positions, attributes, hidden) => playerUpdateEvent.run(positions, attributes, hidden));

        const gatherAnimationEvent = new GatherAnimationEvent(this.socket);
        this.socket.on(PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION, (sid, didHit, index) => gatherAnimationEvent.run(sid, didHit, index));

        const healthUpdateEvent = new HealthUpdateEvent(this.socket);
        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_HEALTH, (sid, health) => healthUpdateEvent.run(sid, health));

        const storeItemsUpdateEvent = new StoreItemsUpdateEvent(this.socket);
        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_STORE_ITEMS, (type, id, index) => storeItemsUpdateEvent.run(type, id, index));

        const loadAiEvent = new LoadAiEvent(this.socket);
        this.socket.on(PacketMap.SERVER_TO_CLIENT.LOAD_AI, (data, hidden) => loadAiEvent.run(data, hidden));

        const animateAiEvent = new AnimateAiEvent(this.socket);
        this.socket.on(PacketMap.SERVER_TO_CLIENT.ANIMATE_AI, (sid) => animateAiEvent.run(sid));

        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_UPGRADES, (points, age) => {
            updateUpgrades(points, age);
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.SET_ALLIANCE_PLAYERS, (data) => {
            // Every tick reads and truncates this list; a non-array here would make each later tick throw.
            Client.alliancePlayers = Array.isArray(data) ? data : [];
            if (allianceHolder.style.display === "flex") updateClanMenu();
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.SET_UP_GAME, (yourSID) => {
            Client.mySID = yourSID;
            ObjectManager.removeAll(6967);
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.SET_PLAYER_TEAM, (team, isOwner) => {
            const player = Client.player;
            if (!player) return;

            this.handleAllianceUpdates(player, team);
            player.isOwner = isOwner;
            if (allianceHolder.style.display === "flex") updateClanMenu();
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.ALLIANCE_NOTIFICATION, (sid, name) => {
            Client.allianceNotifications.push({ sid, name });
            updateNotifications();
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.KILL_OBJECTS, (ownerSID) => {
            PotentialObjectManager.remove(ownerSID);
            ObjectManager.removeAll(ownerSID);
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.KILL_OBJECT, (sid) => {
            ObjectManager.remove(sid);
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.REMOVE_PLAYER, (id) => {
            const player = PlayerManager.get(id);

            if (player) {
                addChatLog(new ChatLog(`${player.name} {${player.sid}} has left the game`, "leave"));
                PlayerManager.remove(player);

                const allySet = Client.allianceMap.get(player.team);
                if (allySet) allySet.delete(player.sid);
                if (player.isLeader || allySet?.size === 0) Client.allianceMap.delete(player.team);
            }
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.PING_RESPONSE, () => {
            if (!this.awaitingPong) return;
            this.awaitingPong = false;

            const rawPing = performance.now() - this.lastPingSocket;
            PingTracker.update(rawPing);

            Client.pingTime = Math.round(rawPing * 1e3) / 1e3;
            pingDisplay.innerText = `Ping: ${Client.pingTime} ms | FPS: ${RendererSystem.fps} | BWin: ${PacketBatcher.effectiveBatchWindow.toFixed(1)} ms | Jitter: ${PacketBatcher.tickJitter.toFixed(1)} ms`;
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.ADD_ALLIANCE, (data) => {
            Client.alliances.push(data);
            Client.allianceMap.set(data.sid, new Set([data.owner]));
            if (allianceHolder.style.display === "flex") updateClanMenu();
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.SHOW_TEXT, (x, y, value, type) => {
            if (Menu.getValue("stackedText")) return;
            TextManager.add(x, y, value, type);
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_AGE, (xp, mxp, age) => {
            const player = Client.player;
            if (!player) return;

            if (xp != undefined) player.XP = xp;
            if (mxp != undefined) player.maxXP = mxp;
            if (age != undefined) player.age = age;
            if (age === 1) Client.upgradesObtained.clear();

            ageDisplay.innerHTML = `age ${player.age}`;
            ageBar.style.width = ((player.XP / player.maxXP) * 100) + "%";
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.SET_INIT_DATA, (data) => {
            const teams = data.teams;
            Client.alliances = teams;

            for (let i = 0, len = teams.length; i < len; i++) {
                const team = teams[i];
                Client.allianceMap.set(team.sid, new Set([team.owner]));
            }

            if (allianceHolder.style.display === "flex") updateClanMenu();
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.DELETE_ALLIANCE, (sid) => {
            const alliances = Client.alliances;
            Client.allianceMap.delete(sid);

            for (let i = 0; i < alliances.length; i++) {
                const team = alliances[i];

                if (team && team.sid == sid) {
                    alliances.splice(i, 1);
                    break;
                }
            }

            if (allianceHolder.style.display === "flex") updateClanMenu();
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.ADD_PLAYER, (data, isYou) => {
            let tmpPlayer = PlayerManager.get(data[0]);

            if (!tmpPlayer) {
                tmpPlayer = new Player(data[0], data[1]);
                PlayerManager.add(tmpPlayer);
            }

            tmpPlayer.spawn();
            tmpPlayer.setData(data);
            tmpPlayer.visible = false;

            if (isYou) {
                Client.upgradesObtained.clear();
                Client.mySID = tmpPlayer.sid;
                Client.player = tmpPlayer;
                CameraManager.camX = tmpPlayer.render_position.x;
                CameraManager.camY = tmpPlayer.render_position.y;

                if (Client.mode === "normal") {
                    gameUI.style.display = "block";
                    respawnPage.style.display = "none";
                    loadingCirclePage.style.display = "none";

                    ageBar.style.width = "0%";
                    ageDisplay.innerText = "age 1";
                } else {
                    respawnPage.style.display = "none";
                    packetReplayerUI.style.display = "block";
                }

                updatePlayerValue();
                updateItems(null, false);
            } else {
                addChatLog(new ChatLog(`encountered ${tmpPlayer.name} {${tmpPlayer.sid}}`, "encounter"));
            }
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_MINIMAP, (data) => {
            Client.minimapData = data;
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.RECEIVE_CHAT, (sid, msg) => {
            const player = PlayerManager.get(sid);

            if (player) {
                msg = shortnameToUnicode(msg);
                msg = msg.replace(/\/shrug|\/shrg|\/shurg|\/shrgu/g, "¯\\_(ツ)_/¯");

                player.chatMessages.unshift(new ChatMessage(msg));

                if (!/@@@@@/g.test(msg) && msg.trim()) {
                    addChatLog(new ChatLog(`${player.name} {${player.sid}} - ${msg}`));
                }

                if (player.chatMessages.length > 3) player.chatMessages.length = 3;
            }
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYER_VALUE, (index, value) => {
            const player = Client.player;

            if (player) {
                if (Menu.getValue("killChat") && index === "kills" && value > player.kills) {
                    Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_CHAT, `Dumbasses Down: ${value}`);

                    setTimeout(() => {
                        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_CHAT, `I'm Super Pro`);
                    }, 750);
                }

                Client.player[index] = value;
                if (index === "points") AutoBuyer.main(value);
            }

            updatePlayerValue();
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT, (data) => {
            for (let i = 0; i < data.length; i += 8) {
                ObjectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4], data[i + 5], data[i + 6], true, data[i + 7]);
            }
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_ITEM_COUNTS, (index, value) => {
            if (!Client.player) return;
            Client.player.itemCounts[index] = value;

            const itemRanges = itemCountElements[index as keyof typeof itemCountElements];
            if (itemRanges) {
                for (const itemId of itemRanges) {
                    getElem(`item-count-${itemId}`).innerText = `${value}`;
                }
            }
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.SHOOT_TURRET, (sid, dir) => {
            const gameObject = ObjectManager.getObject(sid);

            if (gameObject) {
                gameObject.dir = dir;
                gameObject.xWiggle += Math.cos(dir + Math.PI) * ScriptConfig.GATHER_WIGGLE;
                gameObject.yWiggle += Math.sin(dir + Math.PI) * ScriptConfig.GATHER_WIGGLE;
                gameObject.reload = 0;
            }
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.WIGGLE_GAME_OBJECT, (dir, sid) => {
            const gameObject = ObjectManager.getObject(sid);
            if (!gameObject) return;

            gameObject.xWiggle += Math.cos(dir) * ScriptConfig.GATHER_WIGGLE;
            gameObject.yWiggle += Math.sin(dir) * ScriptConfig.GATHER_WIGGLE;

            if (gameObject.maxHealth)
                Client.buildingsHit.push(gameObject);
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.ADD_PROJECTILE, (x, y, dir, range, speed, indx, layer, sid) => {
            ProjectileManager.add(x, y, dir, range, speed, indx, layer, sid);
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.REMOVE_PROJECTILE, (sid, range) => {
            ProjectileManager.remove(sid, range);
            Client.buildingsHit = [];
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_LEADERBOARD, (data) => {
            leaderboardData.innerHTML = "";
            let placementCounter = 1;

            for (let i = 0; i < data.length; i += 3) {
                const leaderHolder = document.createElement("div");
                leaderHolder.classList.add("leaderboard-item");

                const nameDisplay = document.createElement("div");
                nameDisplay.classList.add("leaderboard-label");
                nameDisplay.innerText = `${placementCounter}. ${data[i + 1] || "unknown"} {${data[i]}}`;

                const leaderScore = document.createElement("div");
                leaderScore.classList.add("leaderboard-score");
                leaderScore.innerText = `${kFormat(data[i + 2] as number)}`;

                if (data[i] == Client.mySID) {
                    nameDisplay.classList.add("is-owner");
                    leaderScore.classList.add("is-owner");
                }

                leaderHolder.append(nameDisplay, leaderScore);
                leaderboardData.append(leaderHolder);
                placementCounter++;
            }
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.KILL_PLAYER, () => {
            Client.upgradesObtained.clear();
            CombatController.attackState.confirm = false;
            CombatController.attackState.status = false;

            if (Client.player) Client.lastDeath = {
                x: Client.player.render_position.x,
                y: Client.player.render_position.y
            };

            respawnPage.style.display = "flex";
            gameUI.style.display = "none";
            respawnMainCard.style.display = "none";
            deathText.style.display = "flex";

            setTimeout(() => {
                if (!document.documentElement.hasAttribute("uhohboring")) this.exportPacketLog();
            }, 1e3);

            if (Client.mode === "normal") setTimeout(() => {
                deathText.style.display = "none";
                respawnMainCard.style.display = "flex";

                if (Menu.getValue("autoRespawn"))
                    enterGameBtn.click();
            }, 2e3);
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.UPDATE_ITEMS, (data, wpn) => {
            updateItems(data, wpn);
        });

        this.socket.on(PacketMap.SERVER_TO_CLIENT.SERVER_RESTARTING, (secondsLeft) => {
            showServerRestarting(secondsLeft);
        });

        this.socket.on(PacketMap.CUSTOM_PACKETS.SERVER_TO_CLIENT.ADD_PLACEMENT_MARKER, (x, y, angle, id, placementType) => {
            PlacementSystem.addMarkerRaw(x, y, angle, id, placementType);
        });

        this.socket.on(PacketMap.CUSTOM_PACKETS.SERVER_TO_CLIENT.UPDATE_OBJECT_HEALTH, (sid, health) => {
            const gameObject = ObjectManager.getObject(sid);
            if (gameObject) gameObject.health = health;
        });
    }
}

// Socket calls these instead of importing this module (see socketHooks in Socket.ts).
socketHooks.onDispatch = (type, data) => SocketListener.logPacket(type, data);
socketHooks.onClose = () => SocketListener.stopPinging();
