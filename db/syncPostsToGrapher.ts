// Comes in handy when the post update hook fails for some reason, and we need
// to batch update the grapher posts metadata without manually triggering individual WP updates.

import * as wpdb from "./wpdb.js"
import * as db from "./db.js"
import { keyBy } from "../clientUtils/Util.js"
import { PostRow } from "../clientUtils/owidTypes.js"
import { postsTable, select } from "./model/Post.js"

const zeroDateString = "0000-00-00 00:00:00"

export const blockRefRegex = /<!-- wp:block \{"ref":(?<id>\d+)\} \/-->/g

const syncPostsToGrapher = async (): Promise<void> => {
    const blocks: { ID: number; post_content: string }[] =
        await wpdb.singleton.query(
            "select ID, post_content from wp_posts where post_type='wp_block' AND post_status = 'publish'"
        )

    const allBlocks = keyBy(blocks, "ID")
    console.log(typeof blocks[0].ID)

    const rows = await wpdb.singleton.query(
        "select * from wp_posts where (post_type='page' or post_type='post') AND post_status != 'trash'"
    )

    const doesExistInWordpress = keyBy(rows, "ID")
    const existsInGrapher = await select("id").from(
        db.knexInstance().from(postsTable)
    )
    const doesExistInGrapher = keyBy(existsInGrapher, "id")

    const toDelete = existsInGrapher
        .filter((p) => !doesExistInWordpress[p.id])
        .map((p) => p.id)
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
    const toInsert = rows.map((post: any) => {
        // Now resolve references by using replace with a regex and a function.
        // There are two special cases - one is that not all refs resolve (🤨)
        // in which case we leave the original ref comment as is; the second is
        // that some blocks reference other blocks (🎉 recursion!) and so we
        // check in a loop if the regexp still matches and run replace again.
        // Because not all refs we have to limit the number of attempts, for now
        // we try it 3 times which should be plenty for all reasonably sane
        // scenarios
        const content = post.post_content as string
        let contentWithBlocksInlined = content.replace(blockRefRegex, replacer)
        for (
            let recursionLevelsRemaining = 3;
            recursionLevelsRemaining > 0 &&
            contentWithBlocksInlined.match(blockRefRegex);
            recursionLevelsRemaining--
        ) {
            contentWithBlocksInlined = contentWithBlocksInlined.replace(
                blockRefRegex,
                replacer
            )
        }

        return {
            id: post.ID,
            title: post.post_title,
            slug: post.post_name.replace(/__/g, "/"),
            type: post.post_type,
            status: post.post_status,
            content: contentWithBlocksInlined,
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

    await db.knexInstance().transaction(async (t) => {
        if (toDelete.length)
            await t.whereIn("id", toDelete).delete().from(postsTable)

        for (const row of toInsert) {
            if (doesExistInGrapher[row.id])
                await t.update(row).where("id", "=", row.id).into(postsTable)
            else await t.insert(row).into(postsTable)
        }
    })
}

const main = async (): Promise<void> => {
    try {
        await syncPostsToGrapher()
    } finally {
        await wpdb.singleton.end()
        await db.closeTypeOrmAndKnexConnections()
    }
}

main()
