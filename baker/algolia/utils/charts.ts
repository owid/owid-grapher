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
import { isPathRedirectedToExplorer } from "../../../explorerAdminServer/ExplorerRedirects.js"
import { ParsedChartRecordRow, RawChartRecordRow } from "./types.js"
import {
    excludeNullish,
    getUniqueNamesFromTagHierarchies,
} from "@ourworldindata/utils"
import {
    maybeAddChangeInPrefix,
    parseCatalogPaths,
    processAvailableEntities,
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
            parsedEntities = excludeNullish(
                JSON.parse(rawRecord.entityNames as string) as (string | null)[]
            ) as string[]
        else {
            console.info(
                `Chart ${rawRecord.id} has too many entities, skipping its entities`
            )
        }
    }
    const entityNames = processAvailableEntities(parsedEntities)

    const tags = JSON.parse(rawRecord.tags)
    const keyChartForTags = JSON.parse(
        rawRecord.keyChartForTags as string
    ).filter((t: string | null) => t)

    const config = parseChartConfig(rawRecord.config)

    // Parse catalog paths to extract ETL dimensions
    const catalogPathsArray = rawRecord.catalogPaths
        ? (JSON.parse(rawRecord.catalogPaths) as (string | null)[])
        : []
    const { datasetNamespaces, datasetVersions, datasets } =
        parseCatalogPaths(catalogPathsArray)

    return {
        ...rawRecord,
        config,
        entityNames,
        tags,
        keyChartForTags,
        datasetNamespaces,
        datasetVersions,
        datasets,
    }
}

export async function getChartRedirectSlugsByChartId(
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<Map<number, string[]>> {
    const redirectMap = new Map<number, string[]>()

    // Empty array means explicitly no chart redirects to fetch
    if (chartIds?.length === 0) return redirectMap

    // chartIds is either undefined (fetch all)...
    let query = knex<{
        chart_id: number
        slug: string
    }>(ChartSlugRedirectsTableName).select("chart_id", "slug")

    /// ...or a non-empty array (fetch only these)
    if (chartIds !== undefined) {
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
async function getRawChartRecords(
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<RawChartRecordRow[]> {
    const chartIdFilter = chartIds?.length
        ? `AND c.id IN (${chartIds.join(",")})`
        : ""

    return db.knexRaw<RawChartRecordRow>(
        knex,
        `-- sql
        WITH indexable_charts_with_entity_names AS (
            SELECT c.id,
                   cc.slug,
                   cc.full                                 AS config,
                   JSON_LENGTH(cc.full ->> "$.dimensions") AS numDimensions,
                   c.publishedAt,
                   c.updatedAt,
                   JSON_ARRAYAGG(e.name)          AS entityNames,
                   JSON_ARRAYAGG(v.catalogPath)   AS catalogPaths
            FROM charts c
                     LEFT JOIN chart_configs cc ON c.configId = cc.id
                     LEFT JOIN charts_x_entities ce ON c.id = ce.chartId
                     LEFT JOIN entities e ON ce.entityId = e.id
                     LEFT JOIN chart_dimensions cd ON c.id = cd.chartId
                     LEFT JOIN variables v ON cd.variableId = v.id
            WHERE cc.full ->> "$.isPublished" = 'true'
                AND c.isIndexable IS TRUE
                ${chartIdFilter}
            GROUP BY c.id
        )
        SELECT c.id,
               c.slug,
               c.config,
               c.numDimensions,
               c.publishedAt,
               c.updatedAt,
               c.entityNames, -- this array may contain null values, will have to filter these out
               c.catalogPaths, -- this array may contain null values, will have to filter these out
               JSON_ARRAYAGG(t.name) AS tags,
               JSON_ARRAYAGG(IF(ct.keyChartLevel = ${KeyChartLevel.Top}, t.name, NULL)) AS keyChartForTags -- this results in an array that contains null entries, will have to filter them out
        FROM indexable_charts_with_entity_names c
                 LEFT JOIN chart_tags ct ON c.id = ct.chartId
                 LEFT JOIN tags t on ct.tagId = t.id
        GROUP BY c.id
        HAVING COUNT(t.id) >= 1
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

    // Our search currently cannot render explorers, so don't index them because
    // otherwise they will fail when rendered in the search results
    if (isPathRedirectedToExplorer(`/grapher/${chart.slug}`)) return null

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
    // TODO: check if there is a duplicate count for some posts here
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
        datasets: chart.datasets,
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

    const rawChartRecords = await getRawChartRecords(knex, chartIds)
    const parsedCharts = rawChartRecords.map(parseRawChartRecord)
    const recordsOrNull = await pMap(
        parsedCharts,
        (chart) => buildChartRecord(knex, chart, context),
        { concurrency: 10 }
    )

    return excludeNullish(recordsOrNull)
}
