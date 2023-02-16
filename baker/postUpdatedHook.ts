// This is used by owid-wordpress

import parseArgs from "minimist"
import { BAKE_ON_CHANGE } from "../settings/serverSettings.js"
import { DeployQueueServer } from "./DeployQueueServer.js"
import { exit } from "../db/cleanup.js"
import { PostRow } from "@ourworldindata/utils"
import * as wpdb from "../db/wpdb.js"
import * as db from "../db/db.js"
import { buildReusableBlocksResolver } from "../db/syncPostsToGrapher.js"
import { postsTable, select } from "../db/model/Post.js"
const argv = parseArgs(process.argv.slice(2))

const zeroDateString = "0000-00-00 00:00:00"

// Sync post from the wordpress database to OWID database
const syncPostToGrapher = async (
    postId: number
): Promise<string | undefined> => {
    const rows = await wpdb.singleton.query(
        `--sql
        -- This query extracts all the fields from the wp_posts table and then
        -- adds a json array of authors, and a created_at field which is
        -- constructed by finding the revisions related to this post/page and
        -- taking the earliest one post_date.

        -- We use a CTE to find the first revisions for the post/page
        with first_revision as (
            select
                post_date as created_at,
                post_parent as post_id
            from
                wp_posts
            where
                post_type = 'revision' and post_parent = ?
            order by post_date
            limit 1
        ),
        -- now we select all the fields from wp_posts and then we also
        -- json array aggregate the authors. The authors come as strings like
        -- Charlie Giattino Charlie Giattino Charlie Giattino 44 charlie@ourworldindata.org
        -- so we use regexp_replace to cut out the first two words
        posts_with_authors as (
        SELECT
            p.*,
            JSON_ARRAYAGG(
                JSON_OBJECT('author',
                    regexp_replace(t.description, '^([[:alnum:]-]+) ([[:alnum:]-]+) .+$' , '$1 $2'),
                    'order',
                    r.term_order
                )) as authors
            FROM wp_posts p
            left join wp_term_relationships r on p.id = r.object_id
            left join wp_term_taxonomy t on t.term_taxonomy_id = r.term_taxonomy_id
            WHERE p.ID = ? AND p.post_status != 'trash' AND t.taxonomy = 'author'
        )
        -- finally here we select all the fields from posts_with_authors and
        -- then we join in the first_revision to get the created_at field
        select
            pwa.*,
            fr.created_at as created_at
        from posts_with_authors pwa
        left join first_revision fr on fr.post_id = pwa.id`,
        [postId, postId]
    )
    const dereferenceReusableBlocksFn = await buildReusableBlocksResolver()

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
              authors: wpPost.authors,
              excerpt: wpPost.post_excerpt,
              created_at_in_wordpress:
                  wpPost.created_at === zeroDateString
                      ? "1970-01-01 00:00:00"
                      : wpPost.created_at,
          } as PostRow)
        : undefined

    await db.knexInstance().transaction(async (transaction) => {
        if (!postRow && existsInGrapher)
            // Delete from grapher
            await transaction.table(postsTable).where({ id: postId }).delete()
        else if (postRow) {
            const contentWithBlocksInlined = dereferenceReusableBlocksFn(
                postRow.content
            )
            postRow.content = contentWithBlocksInlined

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
