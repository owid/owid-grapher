import * as db from "./db"
import * as wpdb from "./wpdb"
import { getRedirectsFromDb } from "./model/Redirect.js"

export const syncRedirectsToGrapher = async (): Promise<void> => {
    const allWordpressRedirects = await wpdb.FOR_SYNC_ONLY_getRedirects()
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
