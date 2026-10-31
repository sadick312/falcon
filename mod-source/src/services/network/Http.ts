export class NetworkError extends Error {
    constructor(
        public readonly step: string,
        message: string,
        public readonly status?: number,
        public readonly retryable = false
    ) {
        super(message);
        this.name = "NetworkError";
    }
}

interface FetchJsonOptions {
    step: string;
    timeoutMs: number;
    retries?: number;
    backoffMs?: number;
}

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

async function attempt<T>(url: string, init: RequestInit, opts: FetchJsonOptions): Promise<T> {
    let res: Response;

    try {
        res = await fetch(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs) });
    } catch (err) {
        const timedOut = err instanceof DOMException && err.name === "TimeoutError";
        throw new NetworkError(
            opts.step,
            timedOut ? `Request timed out after ${opts.timeoutMs / 1000}s` : `Network error: ${(err as Error).message}`,
            undefined,
            true
        );
    }

    if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 120).trim();
        throw new NetworkError(
            opts.step,
            `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}${body ? `: ${body}` : ""}`,
            res.status,
            res.status >= 500 || res.status === 429
        );
    }

    try {
        return (await res.json()) as T;
    } catch {
        throw new NetworkError(opts.step, "Server returned a response that is not valid JSON");
    }
}

/** fetch + JSON with a timeout, and exponential-backoff retries for network errors, 5xx and 429. */
export async function fetchJson<T>(url: string, init: RequestInit, opts: FetchJsonOptions): Promise<T> {
    const retries = opts.retries ?? 0;
    const backoff = opts.backoffMs ?? 500;

    for (let i = 0; ; i++) {
        try {
            return await attempt<T>(url, init, opts);
        } catch (err) {
            const retryable = err instanceof NetworkError && err.retryable;
            if (!retryable || i >= retries) throw err;
            await sleep(backoff * 2 ** i);
        }
    }
}
