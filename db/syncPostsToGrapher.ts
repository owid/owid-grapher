// Comes in handy when the post update hook fails for some reason, and we need
// to batch update the grapher posts metadata without manually triggering individual WP updates.

import * as wpdb from "./wpdb"
import * as db from "./db"
import { Post } from "./model/Post"
import { keyBy } from "../clientUtils/Util"
import { PostRow } from "../clientUtils/owidTypes"

const zeroDateString = "0000-00-00 00:00:00"

export const syncPostsToGrapher = async () => {
    const rows = await wpdb.singleton.query(
        "select * from wp_posts where (post_type='page' or post_type='post') AND post_status != 'trash'"
    )

    const doesExistInWordpress = keyBy(rows, "ID")
    const existsInGrapher = await Post.select("id").from(
        db.knex().from(Post.table)
    )
    const doesExistInGrapher = keyBy(existsInGrapher, "id")

    const toDelete = existsInGrapher
        .filter((p) => !doesExistInWordpress[p.id])
        .map((p) => p.id)
    const toInsert = rows.map((post: any) => {
        return {
            id: post.ID,
            title: post.post_title,
            slug: post.post_name.replace(/__/g, "/"),
            type: post.post_type,
            status: post.post_status,
            content: post.post_content,
            published_at:
                post.post_date_gmt === zeroDateString
                    ? null
                    : post.post_date_gmt,
            updated_at:
                post.post_modified_gmt === zeroDateString
                    ? "1970-01-01 00:00:00"
                    : post.post_modified_gmt,
        }
    }) as PostRow[]

    await db.knex().transaction(async (t) => {
        if (toDelete.length)
            await t.whereIn("id", toDelete).delete().from(Post.table)

        for (const row of toInsert) {
            if (doesExistInGrapher[row.id])
                await t.update(row).where("id", "=", row.id).into(Post.table)
            else await t.insert(row).into(Post.table)
        }
    })
}

const main = async () => {
    try {
        await syncPostsToGrapher()
    } finally {
        await wpdb.singleton.end()
        await db.closeTypeOrmAndKnexConnections()
    }
}

main()
