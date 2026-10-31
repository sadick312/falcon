import EntityHandler from "@constants/EntityHandler";
import Player from "@entities/Player";
import PlayerEntityHandler from "@core/logic/players/PlayerEntityHandler";

interface IPlayers {
    handler: PlayerEntityHandler;
    visible: EntityHandler<Player>;
}

export default class PlayerManager {
    static players: IPlayers = {
        handler: new PlayerEntityHandler(),
        visible: new EntityHandler()
    };

    static get(val: string | number) {
        return this.players.handler.get(val);
    }

    static add(player: Player) {
        this.players.handler.add(player);
    }

    static remove(player: Player) {
        this.players.handler.remove(player.id);
        // Otherwise a player who left stays in the visible list as a ghost that the mod keeps targeting.
        this.players.visible.remove(player.sid);
        player.visible = false;
    }

    static removeAll() {
        this.players.handler.removeAll();
        this.players.visible.removeAll();
    }
}