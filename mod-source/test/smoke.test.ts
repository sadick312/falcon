import { describe, expect, it } from "vitest";

describe("test environment", () => {
    it("loads the modules that read the game page when they load", async () => {
        const modules = await Promise.all([
            import("@core/utils/PacketManager"),
            import("@menu/Menu"),
            import("@core/socket/SocketListener"),
            import("@services/packet-recorder/PacketRecorder")
        ]);
        for (const m of modules) expect(m.default).toBeDefined();
    });
});
