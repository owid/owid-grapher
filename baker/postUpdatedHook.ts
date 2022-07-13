// This is used by owid-wordpress

import parseArgs from "minimist"
import { BAKE_ON_CHANGE } from "../settings/serverSettings.js"
import { DeployQueueServer } from "./DeployQueueServer.js"
import { exit } from "../db/cleanup.js"
import { PostRow } from "../clientUtils/owidTypes.js"
import * as wpdb from "../db/wpdb.js"
import * as db from "../db/db.js"
import { postsTable, selectPosts } from "../db/model/Post.js"
const argv = parseArgs(process.argv.slice(2))

const zeroDateString = "0000-00-00 00:00:00"

// Sync post from the wordpress database to OWID database
const syncPostToGrapher = async (
    postId: number
): Promise<string | undefined> => {
    const rows = await wpdb.singleton.query(
        "SELECT * FROM wp_posts WHERE ID = ? AND post_status != 'trash'",
        [postId]
    )

    const matchingRows = await db.knexTable(postsTable).where({ id: postId })
    const existsInGrapher = !!matchingRows.length

    const wpPost = rows[0]
    const postRow = wpPost
        ? ({
              id: wpPost.ID,
              title: wpPost.post_title,
              slug: wpPost.post_name.replace(/__/g, "/"),
              type: wpPost.post_type,
              status: wpPost.post_status,
              content: wpPost.post_content,
              published_at:
                  wpPost.post_date_gmt === zeroDateString
                      ? null
                      : wpPost.post_date_gmt,
              updated_at:
                  wpPost.post_modified_gmt === zeroDateString
                      ? "1970-01-01 00:00:00"
                      : wpPost.post_modified_gmt,
          } as PostRow)
        : undefined

    await db.knexInstance().transaction(async (transaction) => {
        if (!postRow && existsInGrapher)
            // Delete from grapher
            await transaction.table(postsTable).where({ id: postId }).delete()
        else if (postRow && !existsInGrapher)
            await transaction.table(postsTable).insert(postRow)
        else if (postRow && existsInGrapher)
            await transaction
                .table(postsTable)
                .where("id", "=", postRow.id)
                .update(postRow)
    })

    const newPost = (
        await selectPosts("slug").from(
            db.knexTable(postsTable).where({ id: postId })
        )
    )[0]
    return newPost ? newPost.slug : undefined
}

const main = async (
    email: string,
    name: string,
    postId: number,
    postSlug: string
) => {
    console.log(email, name, postId)
    const slug = await syncPostToGrapher(postId)

    if (BAKE_ON_CHANGE)
        await new DeployQueueServer().enqueueChange({
            timeISOString: new Date().toISOString(),
            authorName: name,
            authorEmail: email,
            message: slug ? `Updating ${slug}` : `Deleting ${postSlug}`,
        })

    exit()
}

main(argv._[0], argv._[1], parseInt(argv._[2]), argv._[3])
