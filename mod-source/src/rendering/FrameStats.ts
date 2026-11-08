/**
 * Frames drawn in the last second, updated by RendererSystem. In its own module so the code that only reads it
 * (the ping line, the Packet Replayer) doesn't import the whole renderer, which imports them back.
 */
export const frameStats = { fps: 0 };
