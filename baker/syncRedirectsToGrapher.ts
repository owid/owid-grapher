import * as db from "../db/db"
import * as wpdb from "../db/wpdb"
import { getRedirectsFromDb } from "../db/model/Redirect.js"

const removeTrailingSlashIfNotRoot = (str: string): string => {
    return str.replace(/\/$/, "") || "/"
}

export const syncRedirectsToGrapher = async (): Promise<void> => {
    const allWordpressRedirectsRaw = await wpdb.FOR_SYNC_ONLY_getRedirects()
    const allWordpressRedirects = allWordpressRedirectsRaw.map((r) => {
        return {
            // In absolute terms, redirecting the "/" path is unlikely but there
            // could be rare temporary use cases for it. In the context of this
            // short-lived script, this doesn't really matter either way given
            // none of the redirects this script will parse are from the root
            // path, but we keep it here for completeness.
            source: removeTrailingSlashIfNotRoot(r.source),
            target: removeTrailingSlashIfNotRoot(r.target),
            code: r.code,
        }
    })
    const existingRedirectsFromDb = await getRedirectsFromDb()

    await db.knexInstance().transaction(async (t) => {
        for (const { source, target, code } of allWordpressRedirects) {
            // We only want to insert redirects for which we don't have a redirected source yet
            if (existingRedirectsFromDb.some((r) => r.source === source)) {
                console.log(
                    `Skipping, a redirect already exists for "${source}"`
                )
                continue
            }
            console.log(`Adding redirect: ${source} -> ${target} (${code})`)
            await t.raw(
                `INSERT INTO redirects (source, target, code) VALUES (?, ?, ?)`,
                [source, target, code]
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
