import * as db from "../db"
import {
    DbRawPost,
    DbEnrichedPost,
    parsePostRow,
    parsePostWpApiSnapshot,
    FullPost,
    JsonError,
    WP_PostType,
    FilterFnPostRestApi,
    PostRestApi,
    RelatedChart,
    IndexPost,
    OwidGdocPostInterface,
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
    DbEnrichedImage,
} from "@ourworldindata/types"
import {
    uniqBy,
    memoize,
    orderBy,
    keyBy,
    LARGEST_IMAGE_WIDTH,
} from "@ourworldindata/utils"
import { Knex } from "knex"
import {
    BAKED_BASE_URL,
    CLOUDFLARE_IMAGES_URL,
} from "../../settings/clientSettings.js"
import { BLOG_SLUG } from "../../settings/serverSettings.js"
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

// There are no longer any citable WP posts.
// Will remove this and related code in the future.
export const isPostSlugCitable = (_: string): boolean => {
    return false
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
    const excludedSlugs = [BLOG_SLUG, "thank-you"]

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

export const getBlogIndex = memoize(
    async (knex: db.KnexReadonlyTransaction): Promise<IndexPost[]> => {
        const gdocPosts = await getAndLoadListedGdocPosts(knex)
        const imagesByFilename = await db
            .getCloudflareImages(knex)
            .then((images) => keyBy(images, "filename"))
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
        const posts = [...mapGdocsToWordpressPosts(gdocPosts, imagesByFilename)]

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

function getGdocThumbnail(
    gdoc: OwidGdocPostInterface,
    imagesByFilename: Record<string, DbEnrichedImage>
): string {
    let thumbnailUrl = `${BAKED_BASE_URL}/${DEFAULT_THUMBNAIL_FILENAME}`
    if (gdoc.content["deprecation-notice"]) {
        thumbnailUrl = `${BAKED_BASE_URL}/${ARCHVED_THUMBNAIL_FILENAME}`
    } else if (
        gdoc.content["featured-image"] &&
        imagesByFilename[gdoc.content["featured-image"]]?.cloudflareId
    ) {
        const cloudflareId =
            imagesByFilename[gdoc.content["featured-image"]].cloudflareId
        thumbnailUrl = `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/w=${LARGEST_IMAGE_WIDTH}`
    }
    return thumbnailUrl
}

export const mapGdocsToWordpressPosts = (
    gdocs: OwidGdocPostInterface[],
    imagesByFilename: Record<string, DbEnrichedImage>
): IndexPost[] => {
    return gdocs.map((gdoc) => ({
        title: gdoc.content["atom-title"] || gdoc.content.title || "Untitled",
        slug: gdoc.slug,
        type: gdoc.content.type,
        date: gdoc.publishedAt as Date,
        modifiedDate: gdoc.updatedAt
            ? new Date(gdoc.updatedAt)
            : new Date(gdoc.publishedAt as Date),
        authors: gdoc.content.authors,
        excerpt: gdoc.content["atom-excerpt"] || gdoc.content.excerpt,
        imageUrl: getGdocThumbnail(gdoc, imagesByFilename),
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

export interface RelatedResearchQueryResult {
    title: string
    postSlug: string
    authors: string
    thumbnail: string
    tags: string
    pageviews: number
}

export const getRelatedResearchAndWritingForVariables = async (
    knex: db.KnexReadonlyTransaction,
    variableIds: Iterable<number>
): Promise<DataPageRelatedResearch[]> => {
    const gdocsPosts: RelatedResearchQueryResult[] = await db.knexRaw(
        knex,
        `-- sql
        SELECT DISTINCT
            p.content ->> '$.title' AS title,
            p.slug AS postSlug,
            p.authors,
            p.content ->> '$."featured-image"' AS thumbnail,
            COALESCE(pv.views_365d, 0) AS pageviews,
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
            AND pl.componentType = 'chart' -- this filters out links in tags and keeps only embedded charts
            AND cd.variableId IN (?)
            AND cd.property IN ('x', 'y') -- ignore cases where the indicator is size, color etc
            AND p.published = 1
            AND p.type != 'fragment'
        ORDER BY pageviews DESC`,
        [variableIds]
    )

    const allSortedRelatedResearch = gdocsPosts.map((post) => {
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
    return uniqBy(allSortedRelatedResearch, "url").slice(0, 20)
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
            authors,
            pg.publishedAt,
            CASE
                WHEN content ->> '$."deprecation-notice"' IS NOT NULL THEN '${ARCHVED_THUMBNAIL_FILENAME}'
                ELSE content ->> '$."featured-image"'
            END as "featured-image"
        FROM
            posts_gdocs pg
        WHERE
            JSON_CONTAINS(authors, ?)
            AND pg.published = TRUE
            AND pg.type = "${OwidGdocType.Article}"
        ORDER BY publishedAt DESC
        `,
        [`"${author}"`]
    )

    return rawLatestWorkLinks.map(parseLatestWork)
}
