import * as db from "../db/db"
import * as wpdb from "../db/wpdb"
import { getRedirectsFromDb } from "../db/model/Redirect.js"
import { stripTrailingSlash, resolveRedirectFromMap } from "./redirects.js"
import { Redirect, Url } from "@ourworldindata/utils"

// A close cousing of the getWordpressRedirectsMap() function from
// redirects.ts.
const getWordpressRedirectsMapFromRedirects = (
    redirects: Redirect[]
): Map<string, string> => {
    return new Map(redirects.map((r) => [r.source, r.target]))
}

export const syncRedirectsToGrapher = async (): Promise<void> => {
    const allWordpressRedirectsRaw = await wpdb.FOR_SYNC_ONLY_getRedirects()

    const allWordpressRedirects = allWordpressRedirectsRaw.map((r) => ({
        ...r,
        source: stripTrailingSlash(r.source),
        target: stripTrailingSlash(r.target),
    }))

    const existingRedirectsFromDb = await getRedirectsFromDb()

    await db.knexInstance().transaction(async (t) => {
        for (const { source, code } of allWordpressRedirects) {
            // We only want to insert redirects for which we don't have a redirected source yet
            if (existingRedirectsFromDb.some((r) => r.source === source)) {
                console.log(
                    `Skipping, a redirect already exists for "${source}"`
                )
                continue
            }

            // Resolve the target of the redirect, recursively following any
            // Wordpress redirects until we reach a final target
            const resolvedUrl = await resolveRedirectFromMap(
                Url.fromURL(source),
                getWordpressRedirectsMapFromRedirects(allWordpressRedirects)
            )

            // Use the no-trailing slash version of the resolved target URL.
            // This is to handle the case where parsing a URL with no pathname
            // (e.g. https://africaindata.org) still results in a trailing slash
            // being added by url-parse when creating a new Url object. This
            // solves the issue at hand, although it's debatable whether the
            // issue needed fixing for the one case this script will ever come
            // across (https://africaindata.org). It might just make more sense
            // to fix this edge case manually and avoid polluting the Url class
            // with code that won't be used after the migration.
            const resolvedTarget = resolvedUrl.fullUrlNoTrailingSlash

            console.log(
                `Adding redirect: ${source} -> ${resolvedTarget} (${code})`
            )
            await t.raw(
                `INSERT INTO redirects (source, target, code) VALUES (?, ?, ?)`,
                [source, resolvedTarget, code]
            )
        }
    })
}

const main = async (): Promise<void> => {
    try {
        await db.getConnection()
        await syncRedirectsToGrapher()
    } finally {
        await wpdb.singleton.end()
        await db.closeTypeOrmAndKnexConnections()
    }
}

main()
