import * as _ from "lodash-es"
import * as db from "../db"
import {
    DbRawPost,
    DbEnrichedPost,
    parsePostRow,
    FullPost,
    JsonError,
    PostRestApi,
    RelatedChart,
    snapshotIsPostRestApi,
    snapshotIsBlockGraphQlApi,
    PostReference,
    DataPageRelatedResearch,
    OwidGdocType,
    DbRawLatestWork,
    DbEnrichedLatestWork,
    parseLatestWork,
    DEFAULT_THUMBNAIL_FILENAME,
    ARCHIVED_THUMBNAIL_FILENAME,
} from "@ourworldindata/types"
import type { Knex } from "knex"
import { BAKED_BASE_URL } from "../../settings/clientSettings.mjs"
import { decodeHTML } from "entities"

export const postsTable = "posts"

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

// There are no longer any citable WP posts.
// Will remove this and related code in the future.
export const isPostSlugCitable = (_: string): boolean => {
    return false
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
            chart_configs.config->>"$.title" AS title,
            chart_configs.config->>"$.variantName" AS variantName,
            chart_tags.keyChartLevel
        FROM charts
        JOIN chart_configs ON charts.configId=chart_configs.id
        INNER JOIN chart_tags ON charts.id=chart_tags.chartId
        INNER JOIN post_tags ON chart_tags.tagId=post_tags.tag_id
        WHERE post_tags.post_id=${postId}
        AND chart_configs.config->>"$.isPublished" = "true"
        ORDER BY title ASC
    `
    )

const getFullPost = async (
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
            WITH chart_slug_mapping AS (
                -- Direct chart slug mapping
                SELECT c.id as chartId, cc.slug as target_slug
                FROM charts c
                JOIN chart_configs cc ON c.configId = cc.id
                WHERE c.id = ?
                UNION ALL
                -- Redirect slug mappings
                SELECT cr.chart_id as chartId, cr.slug as target_slug
                FROM chart_slug_redirects cr
                WHERE cr.chart_id = ?
            )
            SELECT DISTINCT
                p.title,
                p.slug,
                p.id,
                CONCAT("${BAKED_BASE_URL}","/",p.slug) as url,
                'article' as type
            FROM
                posts p
                JOIN posts_links pl ON p.id = pl.sourceId
                JOIN chart_slug_mapping csm ON pl.target = csm.target_slug
            WHERE
                p.status = 'publish'
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
        [chartId, chartId]
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
            WITH chart_slug_mapping AS (
                -- Direct chart slug mapping
                SELECT c.id as chartId, cc.slug as target_slug
                FROM charts c
                JOIN chart_configs cc ON c.configId = cc.id
                WHERE c.id = ?
                UNION ALL
                -- Redirect slug mappings
                SELECT cr.chart_id as chartId, cr.slug as target_slug
                FROM chart_slug_redirects cr
                WHERE cr.chart_id = ?
            )
            SELECT DISTINCT
                pg.content ->> '$.title' AS title,
                pg.slug AS slug,
                pg.id AS id,
                CONCAT("${BAKED_BASE_URL}","/",pg.slug) as url,
                pg.type AS type
            FROM
                posts_gdocs pg
                JOIN posts_gdocs_links pgl ON pg.id = pgl.sourceId
                JOIN chart_slug_mapping csm ON pgl.target = csm.target_slug
            WHERE
                pg.type != '${OwidGdocType.Fragment}'
                AND pg.published = 1
            ORDER BY
                pg.content ->> '$.title' ASC
        `,
        [chartId, chartId]
    )

    return relatedGdocsPosts
}

/*
 * Get all the gdocs posts mentioning a chart
 */
export const getRelatedArticles = async (
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<PostReference[] | undefined> => {
    const gdocsPosts = await getGdocsPostReferencesByChartId(chartId, knex)

    return gdocsPosts.sort(
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
    const ids = [...variableIds]
    // Start from the indicators' chart dimensions and work outwards, so the
    // indexes on chart_dimensions.variableId and posts_gdocs_links.target
    // narrow the rows early instead of scanning every embedded chart link.
    const gdocsPosts: RelatedResearchQueryResult[] = await db.knexRaw(
        knex,
        `-- sql
        WITH chart_slug_mapping AS (
            -- Current slugs of charts using the indicators, unless the chart is
            -- a draft reusing a slug that still redirects to another chart
            SELECT cc.slug AS target_slug
            FROM chart_dimensions cd
                JOIN charts c ON c.id = cd.chartId
                JOIN chart_configs cc ON cc.id = c.configId
            WHERE
                cd.variableId IN (?)
                AND cd.property IN ('x', 'y') -- ignore cases where the indicator is size, color etc
                AND (
                    cc.config ->> '$.isPublished' = 'true'
                    OR NOT EXISTS (
                        SELECT 1
                        FROM chart_slug_redirects csr
                        WHERE csr.slug = cc.slug AND csr.chart_id != c.id
                    )
                )
            UNION
            -- Old slugs of those charts, unless another published chart now
            -- uses the slug (drafts may reuse it, but the redirect still applies)
            SELECT csr.slug AS target_slug
            FROM chart_dimensions cd
                JOIN chart_slug_redirects csr ON csr.chart_id = cd.chartId
            WHERE
                cd.variableId IN (?)
                AND cd.property IN ('x', 'y')
                AND NOT EXISTS (
                    SELECT 1
                    FROM chart_configs cc
                        JOIN charts c ON c.configId = cc.id
                    WHERE
                        cc.slug = csr.slug
                        AND cc.config ->> '$.isPublished' = 'true'
                )
        )
        SELECT
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
            posts_gdocs p
            LEFT JOIN analytics_pageviews pv ON pv.url = CONCAT('https://ourworldindata.org/', p.slug)
        WHERE
            p.id IN (
                SELECT pl.sourceId
                FROM
                    posts_gdocs_links pl
                    JOIN chart_slug_mapping csm ON pl.target = csm.target_slug
                WHERE
                    pl.linkType = 'grapher'
                    AND pl.componentType = 'chart' -- this filters out links in tags and keeps only embedded charts
            )
            AND p.published = 1
            AND p.type != 'fragment'
        ORDER BY pageviews DESC`,
        [ids, ids]
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
    // Guard against duplicates, e.g. if analytics_pageviews has more than one row for a url.
    // The first (most viewed) item is retained by uniqBy, latter ones are discarded.
    return _.uniqBy(allSortedRelatedResearch, "url").slice(0, 20)
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
                WHEN content ->> '$."deprecation-notice"' IS NOT NULL THEN '${ARCHIVED_THUMBNAIL_FILENAME}'
                ELSE content ->> '$."featured-image"'
            END as "featured-image"
        FROM
            posts_gdocs pg
        WHERE
            JSON_CONTAINS(authors, ?)
            AND pg.published = TRUE
            AND pg.type = "${OwidGdocType.Article}"
            AND publishedAt <= NOW()
        ORDER BY publishedAt DESC
        `,
        [`"${author}"`]
    )

    return rawLatestWorkLinks.map(parseLatestWork)
}
