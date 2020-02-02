import * as db from "db/db"
import { syncPostsToGrapher } from "db/model/Post"
import * as wpdb from "db/wpdb"

async function main() {
    try {
        await syncPostsToGrapher()
    } finally {
        await wpdb.end()
        await db.end()
    }
}

main()
