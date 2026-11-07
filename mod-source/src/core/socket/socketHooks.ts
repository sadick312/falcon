import type { MOOMOO_SERVER_TO_CLIENT_MAP } from "@root/utils/socket/PacketMap";

/**
 * Filled in by SocketListener when it loads (before any socket exists), so Socket doesn't import SocketListener back.
 * In its own module with no runtime imports, so it exists whichever of the two loads first.
 */
export const socketHooks = {
    onDispatch: (_type: keyof MOOMOO_SERVER_TO_CLIENT_MAP, _data: unknown) => { },
    onClose: () => { }
};
