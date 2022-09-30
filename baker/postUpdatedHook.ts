// This is used by owid-wordpress

import parseArgs from "minimist"
import { BAKE_ON_CHANGE } from "../settings/serverSettings.js"
import { DeployQueueServer } from "./DeployQueueServer.js"
import { exit } from "../db/cleanup.js"
import { PostRow } from "../clientUtils/owidTypes.js"
import * as wpdb from "../db/wpdb.js"
import * as db from "../db/db.js"
import { blockRefRegex } from "../db/syncPostsToGrapher.js"
import { postsTable, select } from "../db/model/Post.js"
import { keyBy } from "../clientUtils/Util.js"
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
        else if (postRow) {
            const contentWithBlocksInlined = postRow.content
            let matches = contentWithBlocksInlined.matchAll(blockRefRegex)
            // Dereference WP refs that point to blocks. In a handful of cases blocks reference
            // blocks again so we have to deref in a loop until we don't have any refs left. To
            // avoid endless loops if a ref can't be dereferenced and we keep the original string
            // we limit the repeat runs to 3 which should be enough for all reasonable uses of blocks
            for (
                let recursionLevelsRemaining = 3;
                recursionLevelsRemaining > 0 && matches;
                recursionLevelsRemaining--
            ) {
                const matchesArray = [...matches]
                const blockIds = new Set(
                    matchesArray.map((match) => match.groups?.id)
                )
                const blockRows = await wpdb.singleton.query(
                    "SELECT ID, post_content FROM wp_posts WHERE ID in (?) AND post_type = 'wp_block' AND post_status != 'trash'",
                    [[...blockIds]]
                )
                const allBlocks = keyBy(blockRows, "ID")
                const replacer = (
                    _match: string,
                    _firstPattern: string,
                    _offset: number,
                    fullString: string,
                    matches: Record<string, string>
                ): string => {
                    const block = allBlocks[matches["id"].toString()]
                    if (block) return block.post_content
                    else return fullString
                }
                const contentWithBlocksInlined = postRow.content.replace(
                    blockRefRegex,
                    replacer
                )
                matches = contentWithBlocksInlined.matchAll(blockRefRegex)
                postRow.content = contentWithBlocksInlined
            }
            if (!existsInGrapher)
                await transaction.table(postsTable).insert(postRow)
            else if (existsInGrapher)
                await transaction
                    .table(postsTable)
                    .where("id", "=", postRow.id)
                    .update(postRow)
        }
    })

    const newPost = (
        await select("slug").from(
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
