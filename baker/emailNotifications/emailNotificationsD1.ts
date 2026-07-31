import { execFile } from "child_process"
import { promisify } from "util"
import {
    BASE_DIR,
    EMAIL_NOTIFICATIONS_CLOUDFLARE_ACCOUNT_ID,
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

/**
 * Query D1 remotely via the Cloudflare HTTP API.
 * https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
 */
export function createRemoteD1Client(): D1Client {
    if (
        !EMAIL_NOTIFICATIONS_CLOUDFLARE_ACCOUNT_ID ||
        !EMAIL_NOTIFICATIONS_CLOUDFLARE_API_TOKEN ||
        !EMAIL_NOTIFICATIONS_D1_DATABASE_ID
    ) {
        throw new Error(
            "EMAIL_NOTIFICATIONS_CLOUDFLARE_ACCOUNT_ID, EMAIL_NOTIFICATIONS_CLOUDFLARE_API_TOKEN and EMAIL_NOTIFICATIONS_D1_DATABASE_ID must be set to query D1 remotely (or use --local)"
        )
    }
    return {
        query: async <T>(sql: string, params: D1Param[] = []): Promise<T[]> => {
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${EMAIL_NOTIFICATIONS_CLOUDFLARE_ACCOUNT_ID}/d1/database/${EMAIL_NOTIFICATIONS_D1_DATABASE_ID}/query`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${EMAIL_NOTIFICATIONS_CLOUDFLARE_API_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ sql, params }),
                }
            )
            const data = (await response.json()) as {
                success: boolean
                errors: unknown[]
                result: { success: boolean; results: T[] }[]
            }
            if (!response.ok || !data.success) {
                throw new Error(
                    `D1 query failed (${response.status}): ${JSON.stringify(data.errors)}`
                )
            }
            return data.result[0]?.results ?? []
        },
    }
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
