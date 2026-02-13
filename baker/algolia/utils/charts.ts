import * as _ from "lodash-es"
import {
    KeyChartLevel,
    ContentGraphLinkType,
    parseChartConfig,
    ChartRecord,
    ChartRecordType,
    ChartsIndexingContext,
    IndexingContext,
    ChartSlugRedirectsTableName,
} from "@ourworldindata/types"
import * as db from "../../../db/db.js"
import { getRelatedArticles } from "../../../db/model/Post.js"
import { getPublishedLinksTo } from "../../../db/model/Link.js"
import { ParsedChartRecordRow, RawChartRecordRow } from "./types.js"
import {
    excludeNullish,
    getUniqueNamesFromTagHierarchies,
} from "@ourworldindata/utils"
import {
    maybeAddChangeInPrefix,
    processAvailableEntities,
    parseJsonStringArray,
} from "./shared.js"
import { GrapherState } from "@ourworldindata/grapher"
import { toPlaintext } from "@ourworldindata/components"
import { getMaxViews7d } from "./pageviews.js"
import { createChartsIndexingContext } from "./context.js"
import pMap from "p-map"

const computeChartScore = (
    numRelatedArticles: number,
    views_7d: number
): number => numRelatedArticles * 500 + views_7d

const parseRawChartRecord = (
    rawRecord: RawChartRecordRow
): ParsedChartRecordRow => {
    let parsedEntities: string[] = []
    if (rawRecord.entityNames !== null) {
        // This is a very rough way to check for the Algolia record size limit, but it's better than the update failing
        // because we exceed the 20KB record size limit
        if (rawRecord.entityNames.length < 12000)
            parsedEntities = JSON.parse(
                rawRecord.entityNames as string
            ) as string[]
        else {
            console.info(
                `Chart ${rawRecord.id} has too many entities, skipping its entities`
            )
        }
    }
    const entityNames = processAvailableEntities(parsedEntities)

    const tags = JSON.parse(rawRecord.tags) as string[]
    const keyChartForTags = JSON.parse(rawRecord.keyChartForTags) as string[]

    const config = parseChartConfig(rawRecord.config)

    const datasetNamespaces = parseJsonStringArray(rawRecord.datasetNamespaces)
    const datasetVersions = parseJsonStringArray(rawRecord.datasetVersions)
    const datasetProducts = parseJsonStringArray(rawRecord.datasetProducts)
    const datasetProducers = parseJsonStringArray(rawRecord.datasetProducers)

    return {
        ...rawRecord,
        config,
        entityNames,
        tags,
        keyChartForTags,
        datasetNamespaces,
        datasetVersions,
        datasetProducts,
        datasetProducers,
    }
}

export async function getChartRedirectSlugsByChartId(
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<Map<number, string[]>> {
    const redirectMap = new Map<number, string[]>()

    let query = knex<{
        chart_id: number
        slug: string
    }>(ChartSlugRedirectsTableName).select("chart_id", "slug")

    if (chartIds?.length) {
        query = query.whereIn("chart_id", chartIds)
    }

    const redirects = await query

    for (const redirect of redirects) {
        const existing = redirectMap.get(redirect.chart_id)
        if (existing) existing.push(redirect.slug)
        else redirectMap.set(redirect.chart_id, [redirect.slug])
    }

    return redirectMap
}

function getChartViews7d(
    context: ChartsIndexingContext,
    slug: string,
    chartId: number
): number {
    const redirectSlugs = context.redirectsByChartId.get(chartId) ?? []
    const urls = [
        `/grapher/${slug}`,
        ...redirectSlugs.map((redirectSlug) => `/grapher/${redirectSlug}`),
    ]
    return getMaxViews7d(context.pageviews, urls)
}

/**
 * Fetches raw chart data from the database.
 * Can be scoped to specific chart IDs for preview.
 */
async function getRawChartsRecords(
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<RawChartRecordRow[]> {
    const chartIdFilter = chartIds?.length
        ? `AND c.id IN (${chartIds.join(",")})`
        : ""

    return db.knexRaw<RawChartRecordRow>(
        knex,
        `-- sql
        WITH indexable_charts AS (
            SELECT c.id,
                   cc.slug,
                   cc.full                                 AS config,
                   JSON_LENGTH(cc.full ->> "$.dimensions") AS numDimensions,
                   c.publishedAt,
                   c.updatedAt
            FROM charts c
                     LEFT JOIN chart_configs cc ON c.configId = cc.id
            WHERE cc.full ->> "$.isPublished" = 'true'
            -- NOT tagged "Unlisted"
            AND NOT EXISTS (
                SELECT 1 FROM chart_tags ct_unlisted
                JOIN tags t_unlisted ON ct_unlisted.tagId = t_unlisted.id
                WHERE ct_unlisted.chartId = c.id AND t_unlisted.name = 'Unlisted'
            )
            -- AND has at least one indexable tag (topic page OR searchableInAlgolia)
            AND EXISTS (
                SELECT 1 FROM chart_tags ct_topic
                JOIN tags t_topic ON ct_topic.tagId = t_topic.id
                LEFT JOIN posts_gdocs pg ON pg.slug = t_topic.slug
                WHERE ct_topic.chartId = c.id
                AND (
                    t_topic.searchableInAlgolia = TRUE
                    OR (
                        pg.published = TRUE
                        AND pg.type IN ('topic-page', 'linear-topic-page')
                    )
                )
            )
            ${chartIdFilter}
        ),
        -- Scope aggregations to indexable_charts for performance and chartId filtering.
        entity_names AS (
            SELECT s.chartId,
                   COALESCE(JSON_ARRAYAGG(s.name), JSON_ARRAY()) AS entityNames
            FROM (
                     SELECT DISTINCT ce.chartId, e.name
                     FROM charts_x_entities ce
                              INNER JOIN indexable_charts ic ON ic.id = ce.chartId
                              LEFT JOIN entities e ON ce.entityId = e.id
                     WHERE e.name IS NOT NULL
                 ) s
            GROUP BY s.chartId
        ),
        chart_tags_names AS (
            SELECT s.chartId,
                   COALESCE(JSON_ARRAYAGG(s.name), JSON_ARRAY()) AS tags
            FROM (
                     SELECT ct.chartId, t.name
                     FROM chart_tags ct
                              INNER JOIN indexable_charts ic ON ic.id = ct.chartId
                              LEFT JOIN tags t on ct.tagId = t.id
                     WHERE t.name IS NOT NULL
                 ) s
            GROUP BY s.chartId
        ),
        key_chart_tags AS (
            SELECT s.chartId,
                   COALESCE(JSON_ARRAYAGG(s.name), JSON_ARRAY()) AS keyChartForTags
            FROM (
                     SELECT ct.chartId, t.name
                     FROM chart_tags ct
                              INNER JOIN indexable_charts ic ON ic.id = ct.chartId
                              LEFT JOIN tags t on ct.tagId = t.id
                     WHERE ct.keyChartLevel = ${KeyChartLevel.Top}
                         AND t.name IS NOT NULL
                 ) s
            GROUP BY s.chartId
        ),
        chart_tag_counts AS (
            SELECT ct.chartId,
                   COUNT(t.id) AS tagCount
            FROM chart_tags ct
                     INNER JOIN indexable_charts ic ON ic.id = ct.chartId
                     LEFT JOIN tags t on ct.tagId = t.id
            GROUP BY ct.chartId
        )
        SELECT c.id,
               c.slug,
               c.config,
               c.numDimensions,
               c.publishedAt,
               c.updatedAt,
               COALESCE(en.entityNames, '[]') AS entityNames,
               COALESCE(ddc.datasetNamespaces, '[]') AS datasetNamespaces,
               COALESCE(ddc.datasetVersions, '[]') AS datasetVersions,
               COALESCE(ddc.datasetProducts, '[]') AS datasetProducts,
               COALESCE(ddc.datasetProducers, '[]') AS datasetProducers,
               ctn.tags,
               COALESCE(kct.keyChartForTags, '[]') AS keyChartForTags
        FROM indexable_charts c
                 LEFT JOIN entity_names en ON c.id = en.chartId
                 LEFT JOIN dataset_dimensions_by_chart ddc ON c.id = ddc.chartId
                 INNER JOIN chart_tag_counts tc ON c.id = tc.chartId
                 LEFT JOIN chart_tags_names ctn ON c.id = ctn.chartId
                 LEFT JOIN key_chart_tags kct ON c.id = kct.chartId
        WHERE tc.tagCount >= 1
    `
    )
}

/**
 * Builds a ChartRecord from parsed chart data and context.
 * This is a mostly-pure transform (still needs knex for related articles lookup).
 */
async function buildChartRecord(
    knex: db.KnexReadonlyTransaction,
    chart: ParsedChartRecordRow,
    context: ChartsIndexingContext
): Promise<ChartRecord | null> {
    const grapherState = new GrapherState(chart.config)

    const relatedArticles = (await getRelatedArticles(knex, chart.id)) ?? []
    const linksFromGdocs = await getPublishedLinksTo(
        knex,
        [chart.slug],
        ContentGraphLinkType.Grapher
    )

    const title = maybeAddChangeInPrefix(
        chart.config.title,
        grapherState.shouldAddChangeInPrefixToTitle
    )
    const plaintextSubtitle = _.isNil(chart.config.subtitle)
        ? undefined
        : toPlaintext(chart.config.subtitle)

    const topicTags = getUniqueNamesFromTagHierarchies(
        chart.tags,
        context.topicHierarchies
    )
    // Number of references to this chart in all our posts
    const numRelatedArticles = relatedArticles.length + linksFromGdocs.length
    const views_7d = getChartViews7d(context, chart.slug, chart.id)

    return {
        objectID: chart.id.toString(),
        id: `grapher/${chart.slug}`,
        type: ChartRecordType.Chart,
        chartId: chart.id,
        slug: chart.slug,
        title,
        variantName: chart.config.variantName ?? "",
        subtitle: plaintextSubtitle,
        availableEntities: chart.entityNames,
        numDimensions: parseInt(chart.numDimensions),
        availableTabs: grapherState.availableTabs,
        publishedAt: chart.publishedAt,
        updatedAt: chart.updatedAt,
        tags: topicTags,
        keyChartForTags: chart.keyChartForTags as string[],
        titleLength: chart.config.title?.length ?? 0,
        numRelatedArticles,

        views_7d,
        isIncomeGroupSpecificFM: false,
        datasetNamespaces: chart.datasetNamespaces,
        datasetVersions: chart.datasetVersions,
        datasetProducts: chart.datasetProducts,
        datasetProducers: chart.datasetProducers,
        score: computeChartScore(numRelatedArticles, views_7d),
    }
}

/**
 * Gets chart records for Algolia indexing.
 */
export const getChartsRecords = async (
    knex: db.KnexReadonlyTransaction,
    options?: { chartIds?: number[]; baseContext?: IndexingContext }
): Promise<ChartRecord[]> => {
    const { chartIds, baseContext } = options ?? {}

    const context = await createChartsIndexingContext(
        knex,
        chartIds,
        baseContext
    )

    const rawChartsRecords = await getRawChartsRecords(knex, chartIds)
    const parsedCharts = rawChartsRecords.map(parseRawChartRecord)
    const recordsOrNull = await pMap(
        parsedCharts,
        (chart) => buildChartRecord(knex, chart, context),
        { concurrency: 10 }
    )

    return excludeNullish(recordsOrNull)
}
