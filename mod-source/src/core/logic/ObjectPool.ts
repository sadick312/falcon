import GameObject from "@constants/GameObject";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import { GameObjectSimulationState } from "@simulation/SimulationStates";
import ScriptConfig from "@utils/config/ScriptConfig";

export default class ObjectPool {
    closeObjects: GameObject[] = [];
    simObjects: Readonly<GameObjectSimulationState>[] = [];

    allTraps: GameObject[] = [];
    allSpikes: GameObject[] = [];

    populate() {
        const player = Client.player;
        const closeObjects = this.closeObjects;
        const simObjects = this.simObjects;

        closeObjects.length = 0;
        simObjects.length = 0;

        ObjectManager.getObjects(player.real_position.x, player.real_position.y, closeObjects);
        closeObjects.sort((a, b) => a.sid - b.sid);

        const allSpikes = this.allSpikes;
        const allTraps = this.allTraps;

        allSpikes.length = 0;
        allTraps.length = 0;

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            if (!gameObject) continue;

            const isCactus = gameObject.type === 1 && gameObject.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;
            if (gameObject.trap) allTraps.push(gameObject);
            if (gameObject.dmg || isCactus) allSpikes.push(gameObject);

            simObjects.push(gameObject.getSimulationState());
        }
    }
}