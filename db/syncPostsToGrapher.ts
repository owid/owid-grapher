// Comes in handy when the post update hook fails for some reason, and we need
// to batch update the grapher posts metadata without manually triggering individual WP updates.

import * as wpdb from "./wpdb"
import * as db from "./db"
import { syncPostsToGrapher } from "./model/Post"

const main = async () => {
    try {
        await syncPostsToGrapher()
    } finally {
        await wpdb.end()
        await db.end()
    }
}

main()
