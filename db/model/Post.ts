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
} from "@ourworldindata/types"
import { uniqBy } from "@ourworldindata/utils"
import { Knex } from "knex"
import { memoize, orderBy } from "lodash"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { BLOG_SLUG } from "../../settings/serverSettings.js"
import { GdocPost } from "./Gdoc/GdocPost.js"
import { SiteNavigationStatic } from "../../site/SiteNavigation.js"
import { decodeHTML } from "entities"

export const postsTable = "posts"

export const select = <K extends keyof DbRawPost>(
    ...args: K[]
): {
    from: (query: Knex.QueryBuilder) => Promise<Pick<DbRawPost, K>[]>
} => ({
    from: (query) => query.select(...args) as any,
})

export const getTagsByPostId = async (): Promise<
    Map<number, { id: number; name: string }[]>
> => {
    const postTags = await db.queryMysql(`
            SELECT pt.post_id AS postId, pt.tag_id AS tagId, t.name as tagName FROM post_tags pt
            JOIN posts p ON p.id=pt.post_id
            JOIN tags t ON t.id=pt.tag_id
        `)

    const tagsByPostId: Map<number, { id: number; name: string }[]> = new Map()

    for (const pt of postTags) {
        const tags = tagsByPostId.get(pt.postId) || []
        tags.push({ id: pt.tagId, name: pt.tagName })
        tagsByPostId.set(pt.postId, tags)
    }

    return tagsByPostId
}

export const setTags = async (
    postId: number,
    tagIds: number[]
): Promise<void> =>
    await db.transaction(async (t) => {
        const tagRows = tagIds.map((tagId) => [tagId, postId])
        await t.execute(`DELETE FROM post_tags WHERE post_id=?`, [postId])
        if (tagRows.length)
            await t.execute(
                `INSERT INTO post_tags (tag_id, post_id) VALUES ?`,
                [tagRows]
            )
    })

export const setTagsForPost = async (
    postId: number,
    tagIds: number[]
): Promise<void> =>
    await db.transaction(async (t) => {
        const tagRows = tagIds.map((tagId) => [tagId, postId])
        await t.execute(`DELETE FROM post_tags WHERE post_id=?`, [postId])
        if (tagRows.length)
            await t.execute(
                `INSERT INTO post_tags (tag_id, post_id) VALUES ?`,
                [tagRows]
            )
    })

export const getPostRawBySlug = async (
    slug: string
): Promise<DbRawPost | undefined> =>
    (await db.knexTable(postsTable).where({ slug }))[0]

export const getPostRawById = async (
    id: number
): Promise<DbRawPost | undefined> =>
    (await db.knexTable(postsTable).where({ id }))[0]

export const getPostEnrichedBySlug = async (
    slug: string
): Promise<DbEnrichedPost | undefined> => {
    const post = await getPostRawBySlug(slug)
    if (!post) return undefined
    return parsePostRow(post)
}

export const getPostEnrichedById = async (
    id: number
): Promise<DbEnrichedPost | undefined> => {
    const post = await getPostRawById(id)
    if (!post) return undefined
    return parsePostRow(post)
}

export const getFullPostBySlugFromSnapshot = async (
    slug: string
): Promise<FullPost> => {
    const postEnriched = await getPostEnrichedBySlug(slug)
    if (
        !postEnriched?.wpApiSnapshot ||
        !snapshotIsPostRestApi(postEnriched.wpApiSnapshot)
    )
        throw new JsonError(`No page snapshot found by slug ${slug}`, 404)

    return getFullPost(postEnriched.wpApiSnapshot)
}

export const getFullPostByIdFromSnapshot = async (
    id: number
): Promise<FullPost> => {
    const postEnriched = await getPostEnrichedById(id)
    if (
        !postEnriched?.wpApiSnapshot ||
        !snapshotIsPostRestApi(postEnriched.wpApiSnapshot)
    )
        throw new JsonError(`No page snapshot found by id ${id}`, 404)

    return getFullPost(postEnriched.wpApiSnapshot)
}

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
    postTypes: string[] = [WP_PostType.Post, WP_PostType.Page],
    filterFunc?: FilterFnPostRestApi
): Promise<PostRestApi[]> => {
    const rawPosts: Pick<DbRawPost, "wpApiSnapshot">[] = (
        await db.knexInstance().raw(
            `
                SELECT wpApiSnapshot FROM ${postsTable}
                WHERE wpApiSnapshot IS NOT NULL
                AND status = "publish"
                AND type IN (?)
                ORDER BY wpApiSnapshot->>'$.date' DESC;
            `,
            [postTypes]
        )
    )[0]

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
    postId: number
): Promise<RelatedChart[]> =>
    db.queryMysql(`
        SELECT DISTINCT
            charts.config->>"$.slug" AS slug,
            charts.config->>"$.title" AS title,
            charts.config->>"$.variantName" AS variantName,
            chart_tags.keyChartLevel
        FROM charts
        INNER JOIN chart_tags ON charts.id=chart_tags.chartId
        INNER JOIN post_tags ON chart_tags.tagId=post_tags.tag_id
        WHERE post_tags.post_id=${postId}
        AND charts.config->>"$.isPublished" = "true"
        ORDER BY title ASC
    `)

export const getFullPost = async (
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
        postApi.featured_media_paths.medium_large ?? "/default-thumbnail.jpg"
    }`,
    thumbnailUrl: `${BAKED_BASE_URL}${
        postApi.featured_media_paths?.thumbnail ?? "/default-thumbnail.jpg"
    }`,
    imageId: postApi.featured_media,
    relatedCharts:
        postApi.type === "page"
            ? await getPostRelatedCharts(postApi.id)
            : undefined,
})

const selectHomepagePosts: FilterFnPostRestApi = (post) =>
    post.meta?.owid_publication_context_meta_field?.homepage === true

export const getBlogIndex = memoize(async (): Promise<IndexPost[]> => {
    await db.getConnection() // side effect: ensure connection is established
    const gdocPosts = await GdocPost.getListedGdocs()
    const wpPosts = await Promise.all(
        await getPostsFromSnapshots(
            [WP_PostType.Post],
            selectHomepagePosts
        ).then((posts) => posts.map((post) => getFullPost(post, true)))
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
})

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
        imageUrl: gdoc.content["featured-image"]
            ? `${BAKED_BASE_URL}${IMAGES_DIRECTORY}${gdoc.content["featured-image"]}`
            : `${BAKED_BASE_URL}/default-thumbnail.jpg`,
    }))
}

export const postsFlushCache = (): void => {
    getBlogIndex.cache.clear?.()
}

export const getBlockContentFromSnapshot = async (
    id: number
): Promise<string | undefined> => {
    const enrichedBlock = await getPostEnrichedById(id)
    if (
        !enrichedBlock?.wpApiSnapshot ||
        !snapshotIsBlockGraphQlApi(enrichedBlock.wpApiSnapshot)
    )
        return

    return enrichedBlock?.wpApiSnapshot.data?.wpBlock?.content
}

/*
 * Get all the related research and writing for a chart
 */
export const getRelatedArticles = async (
    chartId: number
): Promise<PostReference[] | undefined> => {
    const relatedPosts: PostReference[] = (
        await db.knexInstance().raw(
            `
        SELECT
            p.title,
            p.slug,
            p.id
        FROM
            posts_with_gdoc_publish_status p
            JOIN posts_links pl ON p.id = pl.sourceId
            JOIN charts c ON pl.target = c.slug
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
            AND p.isGdocPublished = 0
            AND p.type != 'wp_block'
            -- note: we are not filtering by linkType to cast of wider net: if a post links to an
            -- explorer having the same slug as the grapher chart, we want to surface it as
            -- a "Related research" as it is most likely relevant.
        UNION
        SELECT
            pg.content ->> '$.title' AS title,
            pg.slug AS slug,
            pg.id AS id
        FROM
            posts_gdocs pg
            JOIN posts_gdocs_links pgl ON pg.id = pgl.sourceId
            JOIN charts c ON pgl.target = c.slug
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
            AND pg.content ->> '$.type' <> 'fragment'
            AND pg.published = 1
            -- note: we are not filtering by linkType here either, for the same reason as above.
        `,
            [chartId, chartId]
        )
    )[0]

    return uniqBy(relatedPosts, "slug").sort(
        // Alphabetise
        (a, b) => (a.title.toLowerCase() > b.title.toLowerCase() ? 1 : -1)
    )
}

export const getPermalinks = async (): Promise<{
    // Strip trailing slashes, and convert __ into / to allow custom subdirs like /about/media-coverage
    get: (ID: number, postName: string) => string
}> => ({
    // Strip trailing slashes, and convert __ into / to allow custom subdirs like /about/media-coverage
    get: (ID: number, postName: string): string =>
        postName.replace(/\/+$/g, "").replace(/--/g, "/").replace(/__/g, "/"),
})
