// This is used by owid-wordpress

import parseArgs from "minimist"
import { BAKE_ON_CHANGE } from "../settings/serverSettings.js"
import { DeployQueueServer } from "./DeployQueueServer.js"
import { exit } from "../db/cleanup.js"
import {
    DbEnrichedPost,
    extractFormattingOptions,
    sortBy,
    serializePostRow,
} from "@ourworldindata/utils"
import * as wpdb from "../db/wpdb.js"
import * as db from "../db/db.js"
import {
    buildReusableBlocksResolver,
    buildTablePressResolver,
    getLinksToAddAndRemoveForPost,
} from "../db/syncPostsToGrapher.js"
import { postsTable, select } from "../db/model/Post.js"
import { PostLink } from "../db/model/PostLink.js"
const argv = parseArgs(process.argv.slice(2))

const zeroDateString = "0000-00-00 00:00:00"

// Sync post from the wordpress database to OWID database
const syncPostToGrapher = async (
    postId: number
): Promise<string | undefined> => {
    const rows = await wpdb.singleton.query(
        `-- sql
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
        -- now we select collect json array aggregate the authors. The authors come as strings like
        -- Charlie Giattino Charlie Giattino Charlie Giattino 44 charlie@ourworldindata.org
        -- so we use regexp_replace to cut out the first two words
        post_ids_with_authors as (
        SELECT
            p.ID,
            JSON_ARRAYAGG(
                JSON_OBJECT('author',
                    regexp_replace(t.description, '^([[:alnum:]-]+) ([[:alnum:]-]+) .+$' , '$1 $2'),
                    'order',
                    r.term_order
                )) as authors
            FROM wp_posts p
            left join wp_term_relationships r on p.id = r.object_id
            left join wp_term_taxonomy t on t.term_taxonomy_id = r.term_taxonomy_id
            WHERE t.taxonomy = 'author' and p.ID = ?
            group by p.ID
        ),
        post_featured_image AS (
        SELECT
            p.ID,
            (
            SELECT
                meta_value
            FROM
                wp_postmeta
            WHERE
                post_id = p.ID
                AND meta_key = '_thumbnail_id') AS featured_image_id
        FROM
            wp_posts p
        WHERE
            p.ID = ?
            )
        -- finally here we select all the fields from posts_with_authors and
        -- then we join in the first_revision to get the created_at field
        select
            p.*,
            pwa.authors,
            fr.created_at as created_at,
            regexp_replace((SELECT guid FROM wp_posts WHERE ID = fi.featured_image_id), '^https://owid.cloud/(app|wp-content)/', 'https://ourworldindata.org/wp-content/') AS featured_image
        from wp_posts p
        left join post_ids_with_authors pwa on pwa.id = p.id
        left join first_revision fr on fr.post_id = p.id
        left join post_featured_image fi on fi.ID = p.id
        where p.id = ?`,
        [postId, postId, postId, postId]
    )
    const dereferenceReusableBlocksFn = await buildReusableBlocksResolver()
    const dereferenceTablePressFn = await buildTablePressResolver()

    const matchingRows = await db.knexTable(postsTable).where({ id: postId })
    const existsInGrapher = !!matchingRows.length

    const wpPost = rows[0]

    const formattingOptions = extractFormattingOptions(wpPost.post_content)
    const authors: string[] = sortBy(
        JSON.parse(wpPost.authors),
        (item: { author: string; order: number }) => item.order
    ).map((author: { author: string; order: number }) => author.author)
    const postRow = wpPost
        ? ({
              id: wpPost.ID,
              title: wpPost.post_title,
              slug: wpPost.post_name.replace(/__/g, "/"),
              type: wpPost.post_type,
              status: wpPost.post_status,
              content: wpPost.post_content,
              featured_image: wpPost.featured_image || "",
              published_at:
                  wpPost.post_date_gmt === zeroDateString
                      ? null
                      : wpPost.post_date_gmt,
              updated_at_in_wordpress:
                  wpPost.post_modified_gmt === zeroDateString
                      ? "1970-01-01 00:00:00"
                      : wpPost.post_modified_gmt,
              authors: authors,
              excerpt: wpPost.post_excerpt,
              created_at_in_wordpress:
                  wpPost.created_at === zeroDateString
                      ? "1970-01-01 00:00:00"
                      : wpPost.created_at,
              formattingOptions: formattingOptions,
          } as DbEnrichedPost)
        : undefined

    await db.knexInstance().transaction(async (transaction) => {
        if (!postRow && existsInGrapher)
            // Delete from grapher
            await transaction.table(postsTable).where({ id: postId }).delete()
        else if (postRow) {
            const contentWithBlocksInlined = dereferenceTablePressFn(
                dereferenceReusableBlocksFn(postRow.content)
            )
            postRow.content = contentWithBlocksInlined

            const rowForDb = serializePostRow(postRow)

            if (!existsInGrapher)
                await transaction.table(postsTable).insert(rowForDb)
            else if (existsInGrapher)
                await transaction
                    .table(postsTable)
                    .where("id", "=", rowForDb.id)
                    .update(rowForDb)
        }
    })

    const newPost = (
        await select("slug").from(
            db.knexTable(postsTable).where({ id: postId })
        )
    )[0]

    if (postRow) {
        const existingLinksForPost = await PostLink.findBy({
            sourceId: wpPost.ID,
        })

        const { linksToAdd, linksToDelete } = getLinksToAddAndRemoveForPost(
            postRow,
            existingLinksForPost,
            postRow!.content,
            wpPost.ID
        )

        // TODO: unify our DB access and then do everything in one transaction
        if (linksToAdd.length) {
            console.log("linksToAdd", linksToAdd.length)
            await PostLink.createQueryBuilder()
                .insert()
                .into(PostLink)
                .values(linksToAdd)
                .execute()
        }

        if (linksToDelete.length) {
            console.log("linksToDelete", linksToDelete.length)
            await PostLink.createQueryBuilder()
                .where("id in (:ids)", { ids: linksToDelete.map((x) => x.id) })
                .delete()
                .execute()
        }
    }
    return newPost ? newPost.slug : undefined
}

const main = async (
    email: string,
    name: string,
    postId: number,
    postSlug: string
) => {
    console.log(email, name, postId)
    try {
        const slug = await syncPostToGrapher(postId)

        if (BAKE_ON_CHANGE)
            await new DeployQueueServer().enqueueChange({
                timeISOString: new Date().toISOString(),
                authorName: name,
                authorEmail: email,
                message: slug ? `Updating ${slug}` : `Deleting ${postSlug}`,
            })
    } catch (err) {
        console.error(err)
        throw err
    }
    exit()
}

main(argv._[0], argv._[1], parseInt(argv._[2]), argv._[3])
