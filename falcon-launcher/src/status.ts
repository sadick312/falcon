// The message the dashboard sends the background worker to ask how the last game page load went.

export const STATUS_REQUEST = "falcon:get-status";

/** The last time Falcon was loaded into a game page, since the background worker last started. */
export interface LoadStatus {
    /** Host of the game page, e.g. sandbox.moomoo.io. */
    host: string;
    /** Date.now() when the load finished or failed. */
    time: number;
    ok: boolean;
    /** "<step>: <reason>" when ok is false. */
    error?: string;
}

export interface StatusReply {
    lastLoad: LoadStatus | null;
}
