import * as db from "../db"
import {
    DbRawPost,
    DbEnrichedPost,
    parsePostRow,
    parsePostWpApiSnapshot,
    FullPost,
    JsonError,
    CategoryWithEntries,
    WP_PostType,
    FilterFnPostRestApi,
    PostRestApi,
    RelatedChart,
    IndexPost,
    OwidGdocPostInterface,
    IMAGES_DIRECTORY,
    snapshotIsPostRestApi,
    snapshotIsBlockGraphQlApi,
    PostReference,
    DataPageRelatedResearch,
    OwidGdocType,
    DbRawLatestWork,
    DbEnrichedLatestWork,
    parseLatestWork,
    DbPlainTag,
    DEFAULT_THUMBNAIL_FILENAME,
    ARCHVED_THUMBNAIL_FILENAME,
} from "@ourworldindata/types"
import { uniqBy, sortBy, memoize, orderBy } from "@ourworldindata/utils"
import { Knex } from "knex"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { BLOG_SLUG } from "../../settings/serverSettings.js"
import { SiteNavigationStatic } from "../../site/SiteNavigation.js"
import { decodeHTML } from "entities"
import { getAndLoadListedGdocPosts } from "./Gdoc/GdocFactory.js"

export const postsTable = "posts"

export const select = <K extends keyof DbRawPost>(
    ...args: K[]
): {
    from: (query: Knex.QueryBuilder) => Promise<Pick<DbRawPost, K>[]>
} => ({
    from: (query) => query.select(...args) as any,
})

export const getTagsByPostId = async (
    knex: db.KnexReadonlyTransaction
): Promise<Map<number, { id: number; name: string }[]>> => {
    const postTags = await db.knexRaw<{
        postId: number
        tagId: number
        tagName: string
    }>(
        knex,
        `
            SELECT pt.post_id AS postId, pt.tag_id AS tagId, t.name as tagName FROM post_tags pt
            JOIN posts p ON p.id=pt.post_id
            JOIN tags t ON t.id=pt.tag_id
        `
    )

    const tagsByPostId: Map<number, { id: number; name: string }[]> = new Map()

    for (const pt of postTags) {
        const tags = tagsByPostId.get(pt.postId) || []
        tags.push({ id: pt.tagId, name: pt.tagName })
        tagsByPostId.set(pt.postId, tags)
    }

    return tagsByPostId
}

export const setTags = async (
    trx: db.KnexReadWriteTransaction,
    postId: number,
    tagIds: number[]
): Promise<void> => {
    const tagRows = tagIds.map((tagId) => [tagId, postId])
    await db.knexRaw(trx, `DELETE FROM post_tags WHERE post_id=?`, [postId])
    if (tagRows.length)
        await db.knexRaw(
            trx,
            `INSERT INTO post_tags (tag_id, post_id) VALUES ?`,
            [tagRows]
        )
}

export const setTagsForPost = async (
    trx: db.KnexReadWriteTransaction,
    postId: number,
    tagIds: number[]
): Promise<void> => {
    const tagRows = tagIds.map((tagId) => [tagId, postId])
    await db.knexRaw(trx, `DELETE FROM post_tags WHERE post_id=?`, [postId])
    if (tagRows.length)
        await db.knexRaw(
            trx,
            `INSERT INTO post_tags (tag_id, post_id) VALUES ?`,
            [tagRows]
        )
}

export const getPostIdFromSlug = (
    knex: db.KnexReadonlyTransaction,
    slug: string
): Promise<number | undefined> => {
    return db
        .knexRawFirst<{ id: number }>(
            knex,
            `-- sql
        SELECT id
        FROM posts
        WHERE slug = ?`,
            [slug]
        )
        .then((result) => result?.id)
}

export const getPostRawBySlug = async (
    trx: db.KnexReadonlyTransaction,
    slug: string
): Promise<DbRawPost | undefined> =>
    (await trx.table(postsTable).where({ slug }))[0]

export const getPostRawById = async (
    trx: db.KnexReadonlyTransaction,
    id: number
): Promise<DbRawPost | undefined> =>
    (await trx.table(postsTable).where({ id }))[0]

export const getPostEnrichedBySlug = async (
    trx: db.KnexReadonlyTransaction,
    slug: string
): Promise<DbEnrichedPost | undefined> => {
    const post = await getPostRawBySlug(trx, slug)
    if (!post) return undefined
    return parsePostRow(post)
}

export const getPostEnrichedById = async (
    trx: db.KnexReadonlyTransaction,
    id: number
): Promise<DbEnrichedPost | undefined> => {
    const post = await getPostRawById(trx, id)
    if (!post) return undefined
    return parsePostRow(post)
}

export const getFullPostBySlugFromSnapshot = async (
    trx: db.KnexReadonlyTransaction,
    slug: string
): Promise<FullPost> => {
    const postEnriched = await getPostEnrichedBySlug(trx, slug)
    if (
        !postEnriched?.wpApiSnapshot ||
        !snapshotIsPostRestApi(postEnriched.wpApiSnapshot)
    )
        throw new JsonError(`No page snapshot found by slug ${slug}`, 404)

    return getFullPost(trx, postEnriched.wpApiSnapshot)
}

export const getFullPostByIdFromSnapshot = async (
    trx: db.KnexReadonlyTransaction,
    id: number
): Promise<FullPost> => {
    const postEnriched = await getPostEnrichedById(trx, id)
    if (
        !postEnriched?.wpApiSnapshot ||
        !snapshotIsPostRestApi(postEnriched.wpApiSnapshot)
    )
        throw new JsonError(`No page snapshot found by id ${id}`, 404)

    return getFullPost(trx, postEnriched.wpApiSnapshot)
}

// TODO: I suggest that in the place where we define SiteNavigationStatic we create a Set with all the leaves and
//       then this one becomes a simple lookup in the set. Probably nicest to do the set creation as a memoized function.
export const isPostSlugCitable = (slug: string): boolean => {
    const entries = SiteNavigationStatic.categories
    return entries.some((category) => {
        return (
            category.entries.some((entry) => entry.slug === slug) ||
            (category.subcategories ?? []).some(
                (subcategory: CategoryWithEntries) => {
                    return subcategory.entries.some(
                        (subCategoryEntry) => subCategoryEntry.slug === slug
                    )
                }
            )
        )
    })
}

export const getPostsFromSnapshots = async (
    knex: db.KnexReadonlyTransaction,
    postTypes: string[] = [WP_PostType.Post, WP_PostType.Page],
    filterFunc?: FilterFnPostRestApi
): Promise<PostRestApi[]> => {
    const rawPosts: Pick<DbRawPost, "wpApiSnapshot">[] = await db.knexRaw(
        knex,
        `
                SELECT wpApiSnapshot FROM ${postsTable}
                WHERE wpApiSnapshot IS NOT NULL
                AND status = "publish"
                AND type IN (?)
                ORDER BY wpApiSnapshot->>'$.date' DESC;
            `,
        [postTypes]
    )

    const posts = rawPosts
        .map((p) => p.wpApiSnapshot)
        .filter((snapshot) => snapshot !== null)
        .map((snapshot) => parsePostWpApiSnapshot(snapshot!))

    // Published pages excluded from public views
    const excludedSlugs = [BLOG_SLUG]

    const filterConditions: Array<FilterFnPostRestApi> = [
        (post): boolean => !excludedSlugs.includes(post.slug),
        (post): boolean => !post.slug.endsWith("-country-profile"),
    ]
    if (filterFunc) filterConditions.push(filterFunc)

    return posts.filter((post) => filterConditions.every((c) => c(post)))
}

export const getPostRelatedCharts = async (
    knex: db.KnexReadonlyTransaction,
    postId: number
): Promise<RelatedChart[]> =>
    db.knexRaw<RelatedChart>(
        knex,
        `-- sql
        SELECT DISTINCT
            chart_configs.slug,
            chart_configs.full->>"$.title" AS title,
            chart_configs.full->>"$.variantName" AS variantName,
            chart_tags.keyChartLevel
        FROM charts
        JOIN chart_configs ON charts.configId=chart_configs.id
        INNER JOIN chart_tags ON charts.id=chart_tags.chartId
        INNER JOIN post_tags ON chart_tags.tagId=post_tags.tag_id
        WHERE post_tags.post_id=${postId}
        AND chart_configs.full->>"$.isPublished" = "true"
        ORDER BY title ASC
    `
    )

export const getFullPost = async (
    knex: db.KnexReadonlyTransaction,
    postApi: PostRestApi,
    excludeContent?: boolean
): Promise<FullPost> => ({
    id: postApi.id,
    type: postApi.type,
    slug: postApi.slug,
    path: postApi.slug, // kept for transitioning between legacy BPES (blog post as entry section) and future hierarchical paths
    title: decodeHTML(postApi.title.rendered),
    date: new Date(postApi.date_gmt),
    modifiedDate: new Date(postApi.modified_gmt),
    authors: postApi.authors_name || [],
    content: excludeContent ? "" : postApi.content.rendered,
    excerpt: decodeHTML(postApi.excerpt.rendered),
    imageUrl: `${BAKED_BASE_URL}${
        postApi.featured_media_paths.medium_large ??
        `/${DEFAULT_THUMBNAIL_FILENAME}`
    }`,
    thumbnailUrl: `${BAKED_BASE_URL}${
        postApi.featured_media_paths?.thumbnail ??
        `/${DEFAULT_THUMBNAIL_FILENAME}`
    }`,
    imageId: postApi.featured_media,
    relatedCharts:
        postApi.type === "page"
            ? await getPostRelatedCharts(knex, postApi.id)
            : undefined,
})

const selectHomepagePosts: FilterFnPostRestApi = (post) =>
    post.meta?.owid_publication_context_meta_field?.homepage === true

// TODO: this transaction is only RW because somewhere inside it we fetch images
export const getBlogIndex = memoize(
    async (knex: db.KnexReadWriteTransaction): Promise<IndexPost[]> => {
        const gdocPosts = await getAndLoadListedGdocPosts(knex)
        const wpPosts = await Promise.all(
            await getPostsFromSnapshots(
                knex,
                [WP_PostType.Post],
                selectHomepagePosts
                // TODO: consider doing this as a join instead of a 1+N query
            ).then((posts) =>
                posts.map((post) => getFullPost(knex, post, true))
            )
        )

        const gdocSlugs = new Set(gdocPosts.map(({ slug }) => slug))
        const posts = [...mapGdocsToWordpressPosts(gdocPosts)]

        // Only adding each wpPost if there isn't already a gdoc with the same slug,
        // to make sure we use the most up-to-date metadata
        for (const wpPost of wpPosts) {
            if (!gdocSlugs.has(wpPost.slug)) {
                posts.push(wpPost)
            }
        }

        return orderBy(posts, (post) => post.date.getTime(), ["desc"])
    }
)

function getGdocThumbnail(gdoc: OwidGdocPostInterface): string {
    let thumbnailPath = `/${DEFAULT_THUMBNAIL_FILENAME}`
    if (gdoc.content["deprecation-notice"]) {
        thumbnailPath = `/${ARCHVED_THUMBNAIL_FILENAME}`
    } else if (gdoc.content["featured-image"]) {
        thumbnailPath = `${IMAGES_DIRECTORY}${gdoc.content["featured-image"]}`
    }
    return `${BAKED_BASE_URL}${thumbnailPath}`
}

export const mapGdocsToWordpressPosts = (
    gdocs: OwidGdocPostInterface[]
): IndexPost[] => {
    return gdocs.map((gdoc) => ({
        title: gdoc.content["atom-title"] || gdoc.content.title || "Untitled",
        slug: gdoc.slug,
        type: gdoc.content.type,
        date: gdoc.publishedAt as Date,
        modifiedDate: gdoc.updatedAt as Date,
        authors: gdoc.content.authors,
        excerpt: gdoc.content["atom-excerpt"] || gdoc.content.excerpt,
        imageUrl: getGdocThumbnail(gdoc),
    }))
}

export const postsFlushCache = (): void => {
    getBlogIndex.cache.clear?.()
}

export const getBlockContentFromSnapshot = async (
    trx: db.KnexReadonlyTransaction,
    id: number
): Promise<string | undefined> => {
    const enrichedBlock = await getPostEnrichedById(trx, id)
    if (
        !enrichedBlock?.wpApiSnapshot ||
        !snapshotIsBlockGraphQlApi(enrichedBlock.wpApiSnapshot)
    )
        return

    return enrichedBlock?.wpApiSnapshot.data?.wpBlock?.content
}

export const getWordpressPostReferencesByChartId = async (
    chartId: number,
    knex: db.KnexReadonlyTransaction
): Promise<PostReference[]> => {
    const relatedWordpressPosts: PostReference[] = await db.knexRaw(
        knex,
        `-- sql
            SELECT DISTINCT
                p.title,
                p.slug,
                p.id,
                CONCAT("${BAKED_BASE_URL}","/",p.slug) as url
            FROM
                posts p
                JOIN posts_links pl ON p.id = pl.sourceId
                JOIN chart_configs cc ON pl.target = cc.slug
                JOIN charts c ON c.configId = cc.id
                OR pl.target IN (
                    SELECT
                        cr.slug
                    FROM
                        chart_slug_redirects cr
                    WHERE
                        cr.chart_id = c.id
                )
            WHERE
                c.id = ?
                AND p.status = 'publish'
                AND p.type != 'wp_block'
                AND pl.linkType = 'grapher'
                AND p.slug NOT IN (
                    -- We want to exclude the slugs of published gdocs, since they override the Wordpress posts
                    -- published under the same slugs.
                    SELECT
                        slug from posts_gdocs pg
                    WHERE
                        pg.slug = p.slug
                        AND pg.type != 'fragment'
                        AND pg.published = 1
                )
            ORDER BY
                p.title ASC
        `,
        [chartId]
    )

    return relatedWordpressPosts
}

export const getGdocsPostReferencesByChartId = async (
    chartId: number,
    knex: db.KnexReadonlyTransaction
): Promise<PostReference[]> => {
    const relatedGdocsPosts: PostReference[] = await db.knexRaw(
        knex,
        `-- sql
            SELECT DISTINCT
                pg.content ->> '$.title' AS title,
                pg.slug AS slug,
                pg.id AS id,
                CONCAT("${BAKED_BASE_URL}","/",pg.slug) as url
            FROM
                posts_gdocs pg
                JOIN posts_gdocs_links pgl ON pg.id = pgl.sourceId
                JOIN chart_configs cc ON pgl.target = cc.slug
                JOIN charts c ON c.configId = cc.id
                OR pgl.target IN (
                    SELECT
                        cr.slug
                    FROM
                        chart_slug_redirects cr
                    WHERE
                        cr.chart_id = c.id
                )
            WHERE
                c.id = ?
                AND pg.type NOT IN (
                    '${OwidGdocType.Fragment}',
                    '${OwidGdocType.AboutPage}',
                    '${OwidGdocType.DataInsight}'
                )
                AND pg.published = 1
            ORDER BY
                pg.content ->> '$.title' ASC
        `,
        [chartId]
    )

    return relatedGdocsPosts
}

/*
 * Get all the gdocs and Wordpress posts mentioning a chart
 */
export const getRelatedArticles = async (
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<PostReference[] | undefined> => {
    const wordpressPosts = await getWordpressPostReferencesByChartId(
        chartId,
        knex
    )
    const gdocsPosts = await getGdocsPostReferencesByChartId(chartId, knex)

    return [...wordpressPosts, ...gdocsPosts].sort(
        // Alphabetise
        (a, b) => (a.title.toLowerCase() > b.title.toLowerCase() ? 1 : -1)
    )
}

export const getPostTags = async (
    trx: db.KnexReadonlyTransaction,
    postId: number
): Promise<Pick<DbPlainTag, "id" | "name">[]> => {
    return await trx
        .table("post_tags")
        .select("tags.id", "tags.name")
        .where({ post_id: postId })
        .join("tags", "tags.id", "=", "post_tags.tag_id")
}

export interface RelatedResearchQueryResult {
    linkTargetSlug: string
    componentType: string
    chartSlug: string
    title: string
    postSlug: string
    chartId: number
    authors: string
    thumbnail: string
    pageviews: number
    post_source: string
    tags: string
}

export const getRelatedResearchAndWritingForVariable = async (
    knex: db.KnexReadonlyTransaction,
    variableId: number
): Promise<DataPageRelatedResearch[]> => {
    const wp_posts: RelatedResearchQueryResult[] = await db.knexRaw(
        knex,
        `-- sql
            -- What we want here is to get from the variable to the charts
            -- to the posts and collect different pieces of information along the way
            -- One important complication is that the slugs that are used in posts to
            -- embed charts can either be the current slugs or old slugs that are redirected
            -- now.
            SELECT DISTINCT
                pl.target AS linkTargetSlug,
                pl.componentType AS componentType,
                COALESCE(csr.slug, cc.slug) AS chartSlug,
                p.title AS title,
                p.slug AS postSlug,
                COALESCE(csr.chart_id, c.id) AS chartId,
                p.authors AS authors,
                p.featured_image AS thumbnail,
                COALESCE(pv.views_365d, 0) AS pageviews,
                'wordpress' AS post_source,
                (
                    SELECT
                        COALESCE(JSON_ARRAYAGG(t.name), JSON_ARRAY())
                    FROM
                        post_tags pt
                        JOIN tags t ON pt.tag_id = t.id
                    WHERE
                        pt.post_id = p.id
                ) AS tags
            FROM
                posts_links pl
                JOIN posts p ON pl.sourceId = p.id
                LEFT JOIN chart_configs cc on pl.target = cc.slug
                LEFT JOIN charts c ON cc.id = c.configId
                LEFT JOIN chart_slug_redirects csr ON pl.target = csr.slug
                LEFT JOIN chart_dimensions cd ON cd.chartId = COALESCE(csr.chart_id, c.id)
                LEFT JOIN analytics_pageviews pv ON pv.url = CONCAT('https://ourworldindata.org/', p.slug)
                LEFT JOIN posts_gdocs pg ON pg.id = p.gdocSuccessorId
                LEFT JOIN posts_gdocs pgs ON pgs.slug = p.slug
                LEFT JOIN post_tags pt ON pt.post_id = p.id
            WHERE
                -- we want only urls that point to grapher charts
                pl.linkType = 'grapher'
                -- componentType src is for those links that matched the anySrcregex (not anyHrefRegex or prominentLinkRegex)
                -- this means that only the links that are of the iframe kind will be kept - normal a href style links will
                -- be disregarded
                AND componentType = 'src'
                AND cd.variableId = ?
                AND cd.property IN ('x', 'y') -- ignore cases where the indicator is size, color etc
                AND p.status = 'publish' -- only use published wp posts
                AND p.type != 'wp_block'
                AND COALESCE(pg.published, 0) = 0 -- ignore posts if the wp post has a published gdoc successor. The
                -- coalesce makes sure that if there is no gdoc successor then
                -- the filter keeps the post
                AND COALESCE(pgs.published, 0) = 0 -- ignore posts if there is a gdoc post with the same slug that is published
                -- this case happens for example for topic pages that are newly created (successorId is null)
                -- but that replace an old wordpress page

            `,
        [variableId]
    )

    const gdocs_posts: RelatedResearchQueryResult[] = await db.knexRaw(
        knex,
        `-- sql
        SELECT DISTINCT
            pl.target AS linkTargetSlug,
            pl.componentType AS componentType,
            COALESCE(csr.slug, cc.slug) AS chartSlug,
            p.content ->> '$.title' AS title,
            p.slug AS postSlug,
            COALESCE(csr.chart_id, c.id) AS chartId,
            p.content ->> '$.authors' AS authors,
            p.content ->> '$."featured-image"' AS thumbnail,
            COALESCE(pv.views_365d, 0) AS pageviews,
            'gdocs' AS post_source,
            (
                SELECT
                    COALESCE(JSON_ARRAYAGG(t.name), JSON_ARRAY())
                FROM
                    posts_gdocs_x_tags pt
                    JOIN tags t ON pt.tagId = t.id
                WHERE
                    pt.gdocId = p.id
            ) AS tags
        FROM
            posts_gdocs_links pl
            JOIN posts_gdocs p ON pl.sourceId = p.id
            LEFT JOIN chart_configs cc ON pl.target = cc.slug
            LEFT JOIN charts c ON c.configId = cc.id
            LEFT JOIN chart_slug_redirects csr ON pl.target = csr.slug
            JOIN chart_dimensions cd ON cd.chartId = COALESCE(csr.chart_id, c.id)
            LEFT JOIN analytics_pageviews pv ON pv.url = CONCAT('https://ourworldindata.org/', p.slug)
            LEFT JOIN posts_gdocs_x_tags pt ON pt.gdocId = p.id
        WHERE
            pl.linkType = 'grapher'
            AND componentType = 'chart' -- this filters out links in tags and keeps only embedded charts
            AND cd.variableId = ?
            AND cd.property IN ('x', 'y') -- ignore cases where the indicator is size, color etc
            AND p.published = 1
            AND p.type != 'fragment'`,
        [variableId]
    )

    const combined = [...wp_posts, ...gdocs_posts]

    // we could do the sorting in the SQL query if we'd union the two queries
    // but it seemed easier to understand if we do the sort here
    const sorted = sortBy(combined, (post) => -post.pageviews)

    const allSortedRelatedResearch = sorted.map((post) => {
        const parsedAuthors = JSON.parse(post.authors)
        const parsedTags = post.tags !== "" ? JSON.parse(post.tags) : []

        return {
            title: post.title,
            url: `/${post.postSlug}`,
            variantName: "",
            authors: parsedAuthors,
            imageUrl: post.thumbnail,
            tags: parsedTags,
        }
    })
    // the queries above use distinct but because of the information we pull in if the same piece of research
    // uses different charts that all use a single indicator we would get duplicates for the post to link to so
    // here we deduplicate by url. The first item is retained by uniqBy, latter ones are discarded.
    return uniqBy(allSortedRelatedResearch, "url")
}

export const getLatestWorkByAuthor = async (
    knex: Knex<any, any[]>,
    author: string
): Promise<DbEnrichedLatestWork[]> => {
    const rawLatestWorkLinks = await db.knexRaw<DbRawLatestWork>(
        knex,
        `-- sql
        SELECT
            pg.id,
            pg.slug,
            pg.content->>'$.title' AS title,
            pg.content->>'$.subtitle' AS subtitle,
            pg.content->>'$.authors' AS authors,
            CASE 
                WHEN content ->> '$."deprecation-notice"' IS NOT NULL THEN '${ARCHVED_THUMBNAIL_FILENAME}'
                ELSE content ->> '$."featured-image"'
            END as "featured-image"
            pg.publishedAt
        FROM
            posts_gdocs pg
        WHERE
            pg.content ->> '$.authors' LIKE ?
            AND pg.published = TRUE
            AND pg.type = "${OwidGdocType.Article}"
        `,
        [`%${author}%`]
    )

    // We're sorting in JS because of the "Out of sort memory, consider
    // increasing server sort buffer size" error when using ORDER BY. Adding an
    // index on the publishedAt column doesn't help.
    return sortBy(
        rawLatestWorkLinks.map((work) => parseLatestWork(work)),
        // Sort by most recent first
        (work) => -work.publishedAt! // "!" because we're only selecting published posts, so publishedAt can't be NULL
    )
}
