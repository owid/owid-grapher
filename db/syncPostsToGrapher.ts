// Comes in handy when the post update hook fails for some reason, and we need
// to batch update the grapher posts metadata without manually triggering individual WP updates.

import * as wpdb from "db/wpdb"
import * as db from "db/db"
import { syncPostsToGrapher } from "db/model/Post"

async function main() {
    try {
        await syncPostsToGrapher()
    } finally {
        await wpdb.end()
        await db.end()
    }
}

main()
