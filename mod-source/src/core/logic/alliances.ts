import Player from "@entities/Player";
import Client from "@core/Client";

/** Moves `player` from their old clan to `newTeam` in Client.allianceMap, dropping a clan left without members. */
export function handleAllianceUpdates(player: Player, newTeam: string) {
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
