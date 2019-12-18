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
