// Comes in handy when the post update hook fails for some reason, and we need
// to batch update the grapher posts metadata without manually triggering individual WP updates.

import * as wpdb from "./wpdb.js"
import * as db from "./db.js"
import {
    excludeNullish,
    extractFormattingOptions,
    groupBy,
    keyBy,
    DbEnrichedPost,
    sortBy,
    serializePostRow,
    DbPlainPostLink,
    DbInsertPostLink,
} from "@ourworldindata/utils"
import { postsTable, select } from "./model/Post.js"
import {
    deleteManyPostLinks,
    getAllPostLinks,
    insertManyPostLinks,
    postLinkCreateFromUrl,
} from "./model/PostLink.js"
import { renderTablePress } from "../site/Tablepress.js"
import pMap from "p-map"

const zeroDateString = "0000-00-00 00:00:00"

const blockRefRegex = /<!-- wp:block \{"ref":(?<id>\d+)\} \/-->/g
const tablePressRegex = /\[table id=(?<id>\d+)\s*\/\]/g
const prominentLinkRegex = /"linkUrl":"(?<url>[^"]+)"/g
const anyHrefRegex = /href="(?<url>[^"]+)"/g
const anySrcRegex = /src="(?<url>[^"]+)"/g

interface ReusableBlock {
    ID: number
    post_content: string
}

const fetchAllReusableBlocks = async (): Promise<
    Record<string, ReusableBlock>
> => {
    const blocks: ReusableBlock[] = await wpdb.singleton.query(
        "select ID, post_content from wp_posts where post_type='wp_block' AND post_status = 'publish'"
    )

    const allBlocks = keyBy(blocks, "ID")
    return allBlocks
}

type ReplacerFunction = (
    _match: string,
    _firstPattern: string,
    _offset: number,
    _fullString: string,
    matches: Record<string, string>
) => string

/** Function that takes an object where the keys are reusable block ids and the values are
    ReusableBlocks and returns a replacer function that can be used as a replacer when using
    string.replace(regex, replacer_function) to replace matches that capture the id with
    the content of the block from the blocks input param with the same id as the key */
function buildReplacerFunction(
    blocks: Record<string, ReusableBlock>
): ReplacerFunction {
    return (
        _match: string,
        _firstPattern: string,
        _offset: number,
        _fullString: string,
        matches: Record<string, string>
    ) => {
        const block = blocks[matches["id"].toString()]
        return block
            ? `<!-- wp-block-tombstone ${matches["id"]} -->\n` +
                  block.post_content
            : ""
    }
}

function replaceReusableBlocksRecursive(
    content: string,
    replacerFunction: ReplacerFunction
): string {
    // Resolve references by using replace with a regex and a function.
    // There are two special cases - one is that not all refs resolve (🤨)
    // in which case we leave the original ref comment as is; the second is
    // that some blocks reference other blocks (🎉 recursion!) and so we
    // check in a loop if the regexp still matches and run replace again.
    // Because not all refs resolve we have to limit the number of attempts - for now
    // we try it 3 times which should be plenty for all reasonably sane scenarios
    let contentWithBlocksInlined = content
    for (
        let recursionLevelsRemaining = 3;
        recursionLevelsRemaining > 0 &&
        contentWithBlocksInlined.match(blockRefRegex);
        recursionLevelsRemaining--
    ) {
        contentWithBlocksInlined = contentWithBlocksInlined.replace(
            blockRefRegex,
            replacerFunction
        )
    }
    return contentWithBlocksInlined
}

type BlockResolveFunction = (content: string) => string

/** This function fetches all reusable blocks and then returns a function that
    takes a post content and returns the content with all references to blocks resolved.
    To do its work this function uses a database connection to fetch all blocks when it is called
    that has to be awaited but then the function that is returned is then a simple lookup implementation.
    This was implemented as a closure for nicer re-use and encapsulation.

    @example
    const content = "some content with a <!-- wp:block {\"ref\":123} /--> reference"
    const replacerFn = await buildReusableBlocksResolver()
    const dereferencedContent = replacerFn(content)
     */
export async function buildReusableBlocksResolver(): Promise<BlockResolveFunction> {
    const allBlocks = await fetchAllReusableBlocks()
    const replacerFunction = buildReplacerFunction(allBlocks)
    return (content: string) =>
        replaceReusableBlocksRecursive(content, replacerFunction)
}

/**
 * This function takes all tables from the tablepress plugin and returns a
 * function that can be used as a replacer when using string.replaceAll(regex,
 * replacer_function) to replace all tables with their rendered HTML
 * representation.
 */
export function buildTablePressReplacerFunction(
    tables: Map<string, wpdb.FOR_SYNC_ONLY_TablepressTable>
): ReplacerFunction {
    return (
        _match: string,
        _firstPattern: string,
        _offset: number,
        _fullString: string,
        matches: Record<string, string> // capturing groups from the regex
    ) => {
        const table = tables.get(matches["id"].toString())
        if (!table) {
            console.log(`Table ${matches["id"]} not found`)
            return ""
        }

        return renderTablePress(table.data)
    }
}

function replaceTablePressShortcodes(
    content: string,
    replacerFunction: ReplacerFunction
): string {
    return content.replaceAll(tablePressRegex, replacerFunction)
}

export async function buildTablePressResolver(): Promise<BlockResolveFunction> {
    const allTables = await wpdb.FOR_SYNC_ONLY_getTables()
    const replacerFunction = buildTablePressReplacerFunction(allTables)
    return (content: string) =>
        replaceTablePressShortcodes(content, replacerFunction)
}

export const postLinkCompareStringGenerator = (item: DbPlainPostLink): string =>
    `${item.linkType} - ${item.target} - ${item.hash} - ${item.queryString}`

export function getLinksToAddAndRemoveForPost(
    post: DbEnrichedPost,
    existingLinksForPost: DbPlainPostLink[],
    content: string,
    postId: number
): {
    linksToAdd: Omit<DbPlainPostLink, "id">[]
    linksToDelete: DbPlainPostLink[]
} {
    const linksInDb = groupBy(
        existingLinksForPost,
        postLinkCompareStringGenerator
    )

    const allHrefs = excludeNullish(
        [...content.matchAll(anyHrefRegex)].map((x) =>
            x.groups?.["url"]
                ? {
                      url: x.groups?.["url"].substring(0, 2046),
                      sourceId: postId,
                      componentType: "href",
                  }
                : undefined
        )
    )
    const allSrcs = excludeNullish(
        [...content.matchAll(anySrcRegex)].map((x) =>
            x.groups?.["url"]
                ? {
                      url: x.groups?.["url"].substring(0, 2046),
                      sourceId: postId,
                      componentType: "src",
                  }
                : undefined
        )
    )
    const allProminentLinks = excludeNullish(
        [...content.matchAll(prominentLinkRegex)].map((x) =>
            x.groups?.["url"]
                ? {
                      url: x.groups?.["url"].substring(0, 2046),
                      sourceId: postId,
                      componentType: "prominent-link",
                  }
                : undefined
        )
    )
    const linksInDocument = keyBy(
        [
            ...allHrefs.map((link) => postLinkCreateFromUrl(link)),
            ...allSrcs.map((link) => postLinkCreateFromUrl(link)),
            ...allProminentLinks.map((link) => postLinkCreateFromUrl(link)),
        ],
        postLinkCompareStringGenerator
    )

    const linksToAdd: Omit<DbPlainPostLink, "id">[] = []
    const linksToDelete: DbPlainPostLink[] = []

    // This is doing a set difference, but we want to do the set operation on a subset
    // of fields (the ones we stringify into the compare key) while retaining the full
    // object so that we can e.g. delete efficiently by id later on.
    for (const [linkInDocCompareKey, linkInDoc] of Object.entries(
        linksInDocument
    ))
        if (!(linkInDocCompareKey in linksInDb))
            linksToAdd.push(linkInDoc as Omit<DbPlainPostLink, "id">)
    for (const [linkInDbCompareKey, linkInDb] of Object.entries(linksInDb))
        if (!(linkInDbCompareKey in linksInDocument))
            linksToDelete.push(...linkInDb)
    return { linksToAdd, linksToDelete }
}

const syncPostsToGrapher = async (
    knex: db.KnexReadWriteTransaction
): Promise<void> => {
    const dereferenceReusableBlocksFn = await buildReusableBlocksResolver()
    const dereferenceTablePressFn = await buildTablePressResolver()

    const rows = await wpdb.singleton.query(
        `-- sql
        -- CTE to get all posts joined with the authors via the wp_term_relationships and wp_term_taxonomy tables
        -- A post with 3 authors will result in three rows in this CTE like this:
        -- 418, Charlie Giattino Charlie Giattino Charlie Giattino 44 charlie@ourworldindata.org
        -- 418, Esteban Ortiz-Ospina Esteban Ortiz-Ospina EOO 10 esteban@ourworldindata.org
        -- 418, Max Roser Max Roser 1942max1944 2 max@ourworldindata.org
        -- The author text comes from a WP plugin and is a bit weird. It seems to always be separated by
        -- spaces with the names the first two things so we extract only those.
        with posts_authors as (
            select
              p.ID as id,
              regexp_replace(t.description, '^([[:alnum:]-]+) ([[:alnum:]-]*) .+$' , '$1 $2') as author,
              r.term_order as term_order
            from wp_posts p
            left join wp_term_relationships r on p.ID = r.object_id
            left join wp_term_taxonomy t on t.term_taxonomy_id = r.term_taxonomy_id
            where p.post_type in ('post', 'page') and t.taxonomy = 'author' AND post_status != 'trash'
        ),
        -- CTE to get the revision for each post so we can construct a meaningful created_at date
        revisions as (
            select
                post_date,
                post_parent,
                -- this window function partitions by post_parent and orders by post_date. Later we will
                -- keep only the first (oldest) row for each post_parent
                row_number() over
                        ( partition by post_parent
                          order by post_date) row_num
            from
                wp_posts
            where
                post_type = 'revision'
        ),
        -- CET to now only keep the first revision for each post
        first_revision as (
            select
                post_date as created_at,
                post_parent as post_id
            from
                revisions
            where
                row_num = 1),
        -- CTE to group by post id and aggregate the authors into a json array called authors
        -- unfortunately JSON_ARRAYAGG does not obey the order, nor does it have its own order by clause
        -- (like some proper databases do). This makes it necessary to build up an object for each
        -- author with the term_order.
        post_ids_with_authors as (
            select
                p.ID,
                JSON_ARRAYAGG(JSON_OBJECT('author', pa.author, 'order', pa.term_order)) as authors
            from wp_posts p
			left join posts_authors pa on p.ID = pa.id
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
            )
        -- Finally collect all the fields we want to keep - this is everything from wp_posts, the authors from the
        -- posts_with_authors CTE and the created_at from the first_revision CTE
        select
            p.*,
            pwa.authors as authors,
            fr.created_at as created_at,
            -- select the featured image url and normalize the to point to our full domain at the wp-content folder
            regexp_replace((SELECT guid FROM wp_posts WHERE ID = fi.featured_image_id), '^https://owid.cloud/(app|wp-content)/', 'https://ourworldindata.org/wp-content/') AS featured_image
        from wp_posts p
		left join post_ids_with_authors pwa   on p.ID = pwa.ID
        left join first_revision fr on fr.post_id = pwa.ID
        left join post_featured_image fi on fi.ID = p.id
        where p.post_type in ('post', 'page', 'wp_block') AND post_status != 'trash'
        `
    )

    const doesExistInWordpress = keyBy(rows, "ID")
    const existsInGrapher = await select("id").from(knex.from(postsTable))
    const doesExistInGrapher = keyBy(existsInGrapher, "id")

    const toDelete = existsInGrapher
        .filter((p) => !doesExistInWordpress[p.id])
        .map((p) => p.id)

    const toInsert = (await pMap(
        rows,
        async (post: any) => {
            console.log("Processing post", post.ID, post.post_title)
            const content = post.post_content as string
            const formattingOptions = extractFormattingOptions(content)
            const authors: string[] = sortBy(
                JSON.parse(post.authors),
                (item: { author: string; order: number }) => item.order
            ).map((author: { author: string; order: number }) => author.author)

            return {
                id: post.ID,
                title: post.post_title,
                slug: post.post_name.replace(/__/g, "/"),
                type: post.post_type,
                status: post.post_status,
                content: dereferenceTablePressFn(
                    dereferenceReusableBlocksFn(content)
                ),
                wpApiSnapshot:
                    post.post_type === "wp_block"
                        ? await wpdb.FOR_SYNC_ONLY_getBlockApiFromApi(post.ID)
                        : await wpdb.FOR_SYNC_ONLY_getPostApiBySlugFromApi(
                              post.post_name
                          ),
                featured_image: post.featured_image || "",
                published_at:
                    post.post_date_gmt === zeroDateString
                        ? null
                        : post.post_date_gmt,
                updated_at_in_wordpress:
                    post.post_modified_gmt === zeroDateString
                        ? "1970-01-01 00:00:00"
                        : post.post_modified_gmt,
                authors: authors,
                excerpt: post.post_excerpt,
                created_at_in_wordpress:
                    post.created_at === zeroDateString ? null : post.created_at,
                formattingOptions: formattingOptions,
            }
        },
        { concurrency: 20 }
    )) as DbEnrichedPost[]
    const postLinks = await getAllPostLinks(knex)
    const postLinksById = groupBy(
        postLinks,
        (link: DbPlainPostLink) => link.sourceId
    )

    const linksToAdd: DbInsertPostLink[] = []
    const linksToDelete: DbPlainPostLink[] = []

    for (const post of rows) {
        const existingLinksForPost = postLinksById[post.ID]
        const content = post.post_content as string
        const linksToModify = getLinksToAddAndRemoveForPost(
            post,
            existingLinksForPost,
            content,
            post.ID
        )
        linksToAdd.push(...linksToModify.linksToAdd)
        linksToDelete.push(...linksToModify.linksToDelete)
    }

    if (toDelete.length)
        await knex.whereIn("id", toDelete).delete().from(postsTable)

    for (const row of toInsert) {
        const rowForDb = serializePostRow(row)
        if (doesExistInGrapher[row.id])
            await knex
                .update(rowForDb)
                .where("id", "=", rowForDb.id)
                .into(postsTable)
        else await knex.insert(rowForDb).into(postsTable)
    }

    // TODO: unify our DB access and then do everything in one transaction
    if (linksToAdd.length) {
        console.log("linksToAdd", linksToAdd.length)
        await insertManyPostLinks(knex, postLinks)
    }

    if (linksToDelete.length) {
        console.log("linksToDelete", linksToDelete.length)
        await deleteManyPostLinks(
            knex,
            linksToDelete.map((link) => link.id)
        )
    }
}

const main = async (): Promise<void> => {
    try {
        await db.knexReadWriteTransaction((trx) => syncPostsToGrapher(trx))
    } finally {
        await wpdb.singleton.end()
        await db.closeTypeOrmAndKnexConnections()
    }
}

void main()
