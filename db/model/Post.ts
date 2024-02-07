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
    Tag,
    DataPageRelatedResearch,
} from "@ourworldindata/types"
import { uniqBy, sortBy, memoize, orderBy } from "@ourworldindata/utils"
import { Knex } from "knex"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { BLOG_SLUG } from "../../settings/serverSettings.js"
import { GdocPost } from "./Gdoc/GdocPost.js"
import { SiteNavigationStatic } from "../../site/SiteNavigation.js"
import { decodeHTML } from "entities"
import { RelatedResearchQueryResult } from "../wpdb"

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

export const getPostTags = async (
    postId: number
): Promise<Pick<Tag, "id" | "name">[]> => {
    return await db
        .knexTable("post_tags")
        .select("tags.id", "tags.name")
        .where({ post_id: postId })
        .join("tags", "tags.id", "=", "post_tags.tag_id")
}

export const getRelatedResearchAndWritingForVariable = async (
    variableId: number
): Promise<DataPageRelatedResearch[]> => {
    const wp_posts: RelatedResearchQueryResult[] = await db.queryMysql(
        `-- sql
            -- What we want here is to get from the variable to the charts
            -- to the posts and collect different pieces of information along the way
            -- One important complication is that the slugs that are used in posts to
            -- embed charts can either be the current slugs or old slugs that are redirected
            -- now.
            select
                distinct
                pl.target as linkTargetSlug,
                pl.componentType as componentType,
                coalesce(csr.slug, c.slug) as chartSlug,
                p.title as title,
                p.slug as postSlug,
                coalesce(csr.chart_id, c.id) as chartId,
                p.authors as authors,
                p.featured_image as thumbnail,
                coalesce(pv.views_365d, 0) as pageviews,
                'wordpress' as post_source,
                (select coalesce(JSON_ARRAYAGG(t.name), JSON_ARRAY())
                    from post_tags pt
                    join tags t on pt.tag_id = t.id
                    where pt.post_id = p.id
                ) as tags
            from
                posts_links pl
            join posts p on
                pl.sourceId = p.id
            left join charts c on
                pl.target = c.slug
            left join chart_slug_redirects csr on
                pl.target = csr.slug
            left join chart_dimensions cd on
                cd.chartId = coalesce(csr.chart_id, c.id)
            left join analytics_pageviews pv on
                pv.url = concat('https://ourworldindata.org/', p.slug )
            left join posts_gdocs pg on
            	pg.id = p.gdocSuccessorId
            left join posts_gdocs pgs on
                pgs.slug = p.slug
            left join post_tags pt on
                pt.post_id = p.id
            where
                -- we want only urls that point to grapher charts
                pl.linkType = 'grapher'
                -- componentType src is for those links that matched the anySrcregex (not anyHrefRegex or prominentLinkRegex)
                -- this means that only the links that are of the iframe kind will be kept - normal a href style links will
                -- be disregarded
                and componentType = 'src'
                and cd.variableId = ?
                and cd.property in ('x', 'y') -- ignore cases where the indicator is size, color etc
                and p.status = 'publish' -- only use published wp posts
                and p.type != 'wp_block'
                and coalesce(pg.published, 0) = 0 -- ignore posts if the wp post has a published gdoc successor. The
                                                  -- coalesce makes sure that if there is no gdoc successor then
                                                  -- the filter keeps the post
                and coalesce(pgs.published, 0) = 0 -- ignore posts if there is a gdoc post with the same slug that is published
                      -- this case happens for example for topic pages that are newly created (successorId is null)
                      -- but that replace an old wordpress page

            `,
        [variableId]
    )

    const gdocs_posts: RelatedResearchQueryResult[] = await db.queryMysql(
        `-- sql
            select
                distinct
                pl.target as linkTargetSlug,
                pl.componentType as componentType,
                coalesce(csr.slug, c.slug) as chartSlug,
                p.content ->> '$.title' as title,
                p.slug as postSlug,
                coalesce(csr.chart_id, c.id) as chartId,
                p.content ->> '$.authors' as authors,
                p.content ->> '$."featured-image"' as thumbnail,
                coalesce(pv.views_365d, 0) as pageviews,
                'gdocs' as post_source,
                (select coalesce(JSON_ARRAYAGG(t.name), JSON_ARRAY())
                    from posts_gdocs_x_tags pt
                    join tags t on pt.tagId = t.id
                    where pt.gdocId = p.id
                ) as tags
            from
                posts_gdocs_links pl
            join posts_gdocs p on
                pl.sourceId = p.id
            left join charts c on
                pl.target = c.slug
            left join chart_slug_redirects csr on
                pl.target = csr.slug
            join chart_dimensions cd on
                cd.chartId = coalesce(csr.chart_id, c.id)
            left join analytics_pageviews pv on
                pv.url = concat('https://ourworldindata.org/', p.slug )
            left join posts_gdocs_x_tags pt on
                pt.gdocId = p.id
            where
                pl.linkType = 'grapher'
                and componentType = 'chart' -- this filters out links in tags and keeps only embedded charts
                and cd.variableId = ?
                and cd.property in ('x', 'y') -- ignore cases where the indicator is size, color etc
                and p.published = 1
                and p.content ->> '$.type' != 'fragment'`,
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
