/*
 * Retries a Google API call that was rate limited (429) or hit a transient
 * server error (503), with exponential backoff: 2s, 4s, 8s. Any other
 * failure is rethrown at once — a malformed request never gets better.
 */

export const RETRY_DELAYS_MS = [2_000, 4_000, 8_000]

const RETRYABLE_STATUSES = new Set([429, 503])

export type Sleep = (ms: number) => Promise<void>

export const realSleep: Sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))

export async function withRetry<T>(
    call: () => Promise<T>,
    options: { sleep?: Sleep; log?: (message: string) => void } = {}
): Promise<T> {
    const sleep = options.sleep ?? realSleep
    for (const [attempt, delay] of RETRY_DELAYS_MS.entries()) {
        try {
            return await call()
        } catch (error) {
            if (!isRetryable(error)) throw error
            options.log?.(
                `Google returned ${httpStatus(error)}; retrying in ${delay / 1000}s (${attempt + 1}/${RETRY_DELAYS_MS.length})`
            )
            await sleep(delay)
        }
    }
    return await call()
}

/** The HTTP status of a googleapis error, from whichever field carries it */
export function httpStatus(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null) return undefined
    const candidate = error as {
        code?: unknown
        status?: unknown
        response?: { status?: unknown }
    }
    for (const value of [
        candidate.code,
        candidate.status,
        candidate.response?.status,
    ]) {
        const status = Number(value)
        if (Number.isInteger(status) && status >= 100) return status
    }
    return undefined
}

export function isRetryable(error: unknown): boolean {
    const status = httpStatus(error)
    return status !== undefined && RETRYABLE_STATUSES.has(status)
}
