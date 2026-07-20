import {
    ChartRecord,
    ChartRecordType,
    IndexingContext,
    OwidGdocPostContent,
} from "@ourworldindata/types"
import {
    excludeNullish,
    getUniqueNamesFromTagHierarchies,
} from "@ourworldindata/utils"
import * as db from "../../../db/db.js"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"
import { CLOUDFLARE_IMAGES_URL } from "../../../settings/clientSettings.js"
import { createBaseIndexingContext } from "./context.js"
import { MAX_NON_FM_RECORD_SCORE } from "./shared.js"

/**
 * Articles featuring a bespoke "special viz" project (see bespoke/). These are
 * indexed into the `explorer-views-and-charts` index by hand so that the
 * interactive visualizations they embed also surface in data search results,
 * not just under "Research & Writing".
 */
export const SPECIAL_VIZ_ARTICLE_SLUGS = [
    "population-simulation-tool",
    "where-do-migrants-live-and-where-were-they-born",
    "how-does-food-get-traded-around-the-world",
]

/**
 * Special viz records are added after the pageview-based score scaling, so
 * they need a fixed score. Since they're hand-picked flagship projects, they
 * get the same score as boosted featured metrics, which places them above
 * regular records with the same textual relevance (but still below FMs).
 */
const SPECIAL_VIZ_RECORD_SCORE = MAX_NON_FM_RECORD_SCORE - 500

interface RawSpecialVizRow {
    id: string
    slug: string
    content: string
    publishedAt: string | Date
    updatedAt: string | Date | null
    tags: string | null
}

async function getThumbnailUrlForFeaturedImage(
    knex: db.KnexReadonlyTransaction,
    slug: string,
    featuredImageFilename: string | undefined
): Promise<string | undefined> {
    if (!featuredImageFilename) {
        console.error(`Special viz article "${slug}" has no featured image`)
        return undefined
    }
    const image = await db.getCloudflareImage(knex, featuredImageFilename)
    if (!image?.cloudflareId) {
        console.error(
            `Special viz article "${slug}" has no cloudflare image with filename ${featuredImageFilename}`
        )
        return undefined
    }
    return `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/w=512`
}

/**
 * Builds one record per special viz article for the
 * `explorer-views-and-charts` index. The record links to the article itself
 * and carries its featured image as a thumbnail.
 */
export async function getSpecialVizRecords(
    knex: db.KnexReadonlyTransaction,
    options?: { baseContext?: IndexingContext }
): Promise<ChartRecord[]> {
    const context =
        options?.baseContext ?? (await createBaseIndexingContext(knex))

    const rows = await db.knexRaw<RawSpecialVizRow>(
        knex,
        `-- sql
        SELECT pg.id,
               pg.slug,
               pg.content,
               pg.publishedAt,
               pg.updatedAt,
               (SELECT COALESCE(JSON_ARRAYAGG(t.name), JSON_ARRAY())
                FROM posts_gdocs_x_tags pgt
                         JOIN tags t ON t.id = pgt.tagId
                WHERE pgt.gdocId = pg.id) AS tags
        FROM posts_gdocs pg
        WHERE pg.slug IN (${SPECIAL_VIZ_ARTICLE_SLUGS.map(() => "?").join(",")})
            AND pg.published = TRUE
            AND pg.publishedAt <= NOW()`,
        SPECIAL_VIZ_ARTICLE_SLUGS
    )

    const foundSlugs = new Set(rows.map((row) => row.slug))
    for (const slug of SPECIAL_VIZ_ARTICLE_SLUGS) {
        if (!foundSlugs.has(slug)) {
            console.error(
                `Special viz article "${slug}" not found or unpublished; skipping`
            )
        }
    }

    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)

    const records = await Promise.all(
        rows.map(async (row): Promise<ChartRecord | null> => {
            const content = JSON.parse(row.content) as OwidGdocPostContent
            const title = content.title
            if (!title) {
                console.error(
                    `Special viz article "${row.slug}" has no title; skipping`
                )
                return null
            }

            const thumbnailUrl = await getThumbnailUrlForFeaturedImage(
                knex,
                row.slug,
                content["featured-image"]
            )

            const tags = row.tags ? (JSON.parse(row.tags) as string[]) : []
            const topicTags = getUniqueNamesFromTagHierarchies(
                tags,
                context.topicHierarchies
            )

            const views_7d = pageviews[`/${row.slug}`]?.views_7d ?? 0

            return {
                type: ChartRecordType.SpecialViz,
                objectID: `special-viz-${row.slug}`,
                id: `special-viz/${row.slug}`,
                chartId: -1,
                slug: row.slug,
                queryParams: "",
                title,
                subtitle: content.excerpt ?? undefined,
                variantName: "",
                availableTabs: [],
                keyChartForTags: [],
                tags: topicTags,
                availableEntities: [],
                thumbnailUrl,
                publishedAt: new Date(row.publishedAt).toISOString(),
                updatedAt: new Date(
                    row.updatedAt ?? row.publishedAt
                ).toISOString(),
                numDimensions: 0,
                titleLength: title.length,
                numRelatedArticles: 0,
                views_7d,
                score: SPECIAL_VIZ_RECORD_SCORE,
                isIncomeGroupSpecificFM: false,
                isFM: false,
                datasetNamespaces: [],
                datasetVersions: [],
                datasetProducts: [],
                datasetProducers: [],
            }
        })
    )

    return excludeNullish(records)
}
