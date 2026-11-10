// Ping/lag brief, Phase 1: measuring ping. SocketListener pings once a second and times the reply; PingTracker keeps
// the current ping, the stable ping (median of the last 5) and the jitter (how much it jumps between samples).
// Samples that measure something other than the network are left out: a reply that may belong to an older ping we
// gave up on, a ping that was out while the tab was hidden, and round trips over 2 s (stalls). A reconnect starts over.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function connected() {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000 });
    const { default: SocketListener } = await import("@core/socket/SocketListener");
    const { default: PingTracker } = await import("@core/mod/utils/PingTracker");
    return { SocketListener, PingTracker, Client: game.Client };
}

/** One ping answered after `ms`, then the 1 s wait before the next. */
function roundTrip(SocketListener: { pingSocket(): void }, ms: number) {
    SocketListener.pingSocket();
    vi.advanceTimersByTime(ms);
    game!.handlers["0"]();
    vi.advanceTimersByTime(1_000 - ms);
}

const display = () => document.getElementById("ping-display")!.innerText;
const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event("visibilitychange"));
};

describe("ping measurement", () => {
    it("steady ping: current, stable and jitter settle on the real value", async () => {
        const { SocketListener, PingTracker } = await connected();
        for (let i = 0; i < 6; i++) roundTrip(SocketListener, 60);

        expect(PingTracker.getCurrentPing()).toBe(60);
        expect(PingTracker.getStablePing()).toBe(60);
        expect(PingTracker.getJitter()).toBe(0);
        // The display uses the original Falcon format: ping, FPS and batch window only.
        expect(display()).toMatch(/^Ping: 60 ms \| FPS: \d+ \| BWin: [\d.]+ ms$/);
    });

    it("one spike moves the current ping and the jitter, not the stable ping", async () => {
        const { SocketListener, PingTracker } = await connected();
        for (const ms of [60, 60, 60, 400, 60]) roundTrip(SocketListener, ms);

        expect(PingTracker.getStablePing()).toBe(60);
        expect(PingTracker.getJitter()).toBeGreaterThan(50);
    });

    it("a real change (3 samples in a row) moves the stable ping within 3 s", async () => {
        const { SocketListener, PingTracker } = await connected();
        for (let i = 0; i < 5; i++) roundTrip(SocketListener, 50);
        for (let i = 0; i < 3; i++) roundTrip(SocketListener, 150);
        expect(PingTracker.getStablePing()).toBe(150);
    });

    it("jitter follows how much the ping jumps", async () => {
        const { SocketListener, PingTracker } = await connected();
        for (let i = 0; i < 12; i++) roundTrip(SocketListener, i % 2 ? 40 : 80);
        expect(PingTracker.getStablePing()).toBeGreaterThanOrEqual(40);
        expect(PingTracker.getJitter()).toBeGreaterThan(30);
        expect(PingTracker.getJitter()).toBeLessThanOrEqual(40);
    });

    it("a late reply after giving up (5 s) isn't timed against the newer ping", async () => {
        const { SocketListener, PingTracker } = await connected();
        roundTrip(SocketListener, 50);

        SocketListener.pingSocket(); // no reply: a 5.2 s stall
        vi.advanceTimersByTime(5_000);
        SocketListener.pingSocket(); // gives up, pings again
        vi.advanceTimersByTime(200);
        game!.handlers["0"](); // the old ping's late reply: 200 ms after the new ping, but not a 200 ms ping

        expect(PingTracker.getCurrentPing()).toBe(50);
        expect(PingTracker.sampleCount).toBe(1);

        // Measuring goes on normally afterwards.
        vi.advanceTimersByTime(1_000);
        roundTrip(SocketListener, 70);
        expect(PingTracker.getCurrentPing()).toBe(70);
    });

    it("a lost reply doesn't stop ping measurement", async () => {
        const { SocketListener, PingTracker } = await connected();
        SocketListener.pingSocket(); // never answered
        vi.advanceTimersByTime(5_000);
        SocketListener.pingSocket();
        vi.advanceTimersByTime(60);
        game!.handlers["0"](); // can't tell which ping it answers: no sample, but the wait ends
        vi.advanceTimersByTime(1_000);

        for (let i = 0; i < 3; i++) roundTrip(SocketListener, 60);
        expect(PingTracker.sampleCount).toBe(3);
        expect(PingTracker.getStablePing()).toBe(60);
    });

    it("leaves out a ping that was out while the tab was hidden", async () => {
        const { SocketListener, PingTracker } = await connected();
        roundTrip(SocketListener, 50);

        SocketListener.pingSocket();
        setHidden(true);
        vi.advanceTimersByTime(900);
        setHidden(false);
        game!.handlers["0"]();
        expect(PingTracker.getCurrentPing()).toBe(50);

        // A ping sent while hidden counts neither.
        setHidden(true);
        vi.advanceTimersByTime(1_000);
        roundTrip(SocketListener, 700);
        setHidden(false);
        expect(PingTracker.sampleCount).toBe(1);
        roundTrip(SocketListener, 55);
        expect(PingTracker.getCurrentPing()).toBe(55);
    });

    it("leaves out round trips over 2 s (a stall, not the network)", async () => {
        const { SocketListener, PingTracker } = await connected();
        roundTrip(SocketListener, 50);
        SocketListener.pingSocket();
        vi.advanceTimersByTime(2_500);
        game!.handlers["0"]();
        expect(PingTracker.getCurrentPing()).toBe(50);
        expect(PingTracker.sampleCount).toBe(1);
    });

    it("starts over after a reconnect, so another server's ping isn't mixed in", async () => {
        const { SocketListener, PingTracker, Client } = await connected();
        for (let i = 0; i < 5; i++) roundTrip(SocketListener, 250);
        expect(PingTracker.getStablePing()).toBe(250);

        await import("@core/Connection");
        await Client.connect();

        expect(PingTracker.sampleCount).toBe(0);
        expect(PingTracker.getStablePing()).toBe(50); // the default until the new server answers
        expect(PingTracker.getJitter()).toBe(0);
        expect(Client.pingTime).toBe(0);
    });
});
