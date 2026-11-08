import { tickState } from "@core/TickState";
import { IncomingServerPackets } from "@root/utils/socket/PacketLogging";
import PacketMap, { MOOMOO_SERVER_TO_CLIENT_MAP } from "@root/utils/socket/PacketMap";
import PacketRecorder from "@services/packet-recorder/PacketRecorder";

/**
 * Records a server packet (or a packet Falcon logs for itself, such as a predicted building health) in the packet log,
 * with the brain state on player updates. Lives apart from SocketListener so the event handlers don't import it back.
 */
export function logPacket(type: keyof MOOMOO_SERVER_TO_CLIENT_MAP, typedData: unknown) {
    if (!PacketRecorder.shouldRecord(type)) return;

    PacketRecorder.add(type, {
        timestamp: performance.now(),
        brainState: type === PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS ? tickState.brainState : undefined,
        packetData: {
            type: type,
            data: typedData
        } as IncomingServerPackets
    });
}
