import { execFile } from "child_process"
import { promisify } from "util"
import pRetry from "p-retry"
import {
    BASE_DIR,
    CLOUDFLARE_ACCOUNT_ID,
    EMAIL_NOTIFICATIONS_CLOUDFLARE_API_TOKEN,
    EMAIL_NOTIFICATIONS_D1_DATABASE_ID,
} from "../../settings/serverSettings.js"

const execFileAsync = promisify(execFile)

export type D1Param = string | number | null

/**
 * Minimal client for the email notifications D1 database. The send job runs
 * on our own infra (not on Cloudflare), so it doesn't have a D1 binding and
 * accesses the database remotely instead.
 */
export interface D1Client {
    query<T>(sql: string, params?: D1Param[]): Promise<T[]>
}

/** A failed D1 query, marked with whether it's worth retrying. */
export class D1QueryError extends Error {
    constructor(
        message: string,
        readonly retryable: boolean
    ) {
        super(message)
        this.name = "D1QueryError"
    }
}

// Transient errors D1 recommends retrying.
// https://developers.cloudflare.com/d1/observability/debug-d1/#list-of-d1_errors
const RETRYABLE_D1_ERROR_MESSAGES = [
    "Network connection lost",
    "storage caused object to be reset",
    "reset because its code was updated",
    "Cannot resolve D1 DB due to transient issue",
    "Replica disconnected from primary",
    "client disconnected",
]

/**
 * Run a query, retrying transient failures with exponential backoff and
 * jitter. D1 only retries read-only queries itself.
 * https://developers.cloudflare.com/d1/best-practices/retry-queries/
 *
 * A failed write may still have been committed, so only use this for
 * statements that are safe to run twice.
 */
export async function queryWithRetry<T>(
    d1: D1Client,
    sql: string,
    params: D1Param[] = [],
    { retries = 4, minTimeout = 1000 } = {}
): Promise<T[]> {
    const isRetryable = (error: unknown): boolean =>
        error instanceof D1QueryError && error.retryable
    return pRetry(() => d1.query<T>(sql, params), {
        retries,
        minTimeout,
        randomize: true,
        shouldRetry: ({ error }) => isRetryable(error),
        // Called before shouldRetry, so it checks retryability itself.
        onFailedAttempt: ({
            error,
            attemptNumber,
            retriesLeft,
            retryDelay,
        }) => {
            if (!isRetryable(error) || retriesLeft === 0) return
            console.warn(
                `D1 query failed, retrying attempt=${attemptNumber} delayMs=${Math.round(retryDelay)} error=${JSON.stringify(String(error))}`
            )
        },
    })
}

/**
 * Query D1 remotely via the Cloudflare HTTP API.
 * https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
 */
export function createRemoteD1Client(): D1Client {
    if (
        !CLOUDFLARE_ACCOUNT_ID ||
        !EMAIL_NOTIFICATIONS_CLOUDFLARE_API_TOKEN ||
        !EMAIL_NOTIFICATIONS_D1_DATABASE_ID
    ) {
        throw new Error(
            "CLOUDFLARE_ACCOUNT_ID, EMAIL_NOTIFICATIONS_CLOUDFLARE_API_TOKEN and EMAIL_NOTIFICATIONS_D1_DATABASE_ID must be set to query D1 remotely (or use --local)"
        )
    }
    return {
        query: async <T>(sql: string, params: D1Param[] = []): Promise<T[]> => {
            let response: Response
            try {
                response = await fetch(
                    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${EMAIL_NOTIFICATIONS_D1_DATABASE_ID}/query`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${EMAIL_NOTIFICATIONS_CLOUDFLARE_API_TOKEN}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ sql, params }),
                    }
                )
            } catch (error) {
                // The request didn't complete, e.g. a network error.
                throw new D1QueryError(`D1 request failed: ${error}`, true)
            }
            // Error responses, e.g. Cloudflare API rate limiting, aren't
            // necessarily JSON.
            const data = (await response.json().catch(() => undefined)) as
                | {
                      success: boolean
                      errors: { message: string }[]
                      result: { success: boolean; results: T[] }[]
                  }
                | undefined
            if (!response.ok || !data?.success) {
                const message = `D1 query failed (${response.status}): ${JSON.stringify(data?.errors)}`
                // 429 means the database is overloaded or we hit the
                // Cloudflare API rate limit.
                throw new D1QueryError(
                    message,
                    response.status === 429 ||
                        response.status >= 500 ||
                        RETRYABLE_D1_ERROR_MESSAGES.some((retryable) =>
                            message.includes(retryable)
                        )
                )
            }
            return data.result[0]?.results ?? []
        },
    }
}

/**
 * The remote database's size in bytes, via the Cloudflare HTTP API.
 * https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/get/
 */
export async function fetchRemoteD1DatabaseSize(): Promise<number> {
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${EMAIL_NOTIFICATIONS_D1_DATABASE_ID}`,
        {
            headers: {
                Authorization: `Bearer ${EMAIL_NOTIFICATIONS_CLOUDFLARE_API_TOKEN}`,
            },
        }
    )
    const data = (await response.json().catch(() => undefined)) as
        | { success: boolean; result: { file_size: number } }
        | undefined
    if (!response.ok || !data?.success) {
        throw new Error(
            `Fetching the D1 database size failed (${response.status})`
        )
    }
    return data.result.file_size
}

/**
 * Query the local D1 database by shelling out to wrangler, for testing the
 * send job against the same local database that `wrangler pages dev` uses.
 * Wrangler's CLI can't bind parameters, so they are inlined with basic
 * escaping — fine for local development, never used in production.
 */
export function createLocalD1Client(databaseName: string): D1Client {
    const inlineParam = (param: D1Param): string => {
        if (param === null) return "NULL"
        if (typeof param === "number") return String(param)
        return `'${param.replaceAll("'", "''")}'`
    }
    return {
        query: async <T>(sql: string, params: D1Param[] = []): Promise<T[]> => {
            const inlinedSql = sql.replace(/\?(\d+)/g, (_, index) =>
                inlineParam(params[Number(index) - 1])
            )
            const { stdout } = await execFileAsync(
                "npx",
                [
                    "wrangler",
                    "d1",
                    "execute",
                    databaseName,
                    "--local",
                    "--json",
                    "--command",
                    inlinedSql,
                ],
                { cwd: BASE_DIR }
            )
            const data = JSON.parse(stdout) as {
                success: boolean
                results: T[]
            }[]
            return data[0]?.results ?? []
        },
    }
}
