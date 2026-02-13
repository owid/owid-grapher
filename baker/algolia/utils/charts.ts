import * as _ from "lodash-es"
import {
    KeyChartLevel,
    ContentGraphLinkType,
    parseChartConfig,
    ChartRecord,
    ChartRecordType,
    ChartSlugRedirectsTableName,
} from "@ourworldindata/types"
import * as db from "../../../db/db.js"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"
import { getRelatedArticles } from "../../../db/model/Post.js"
import { getPublishedLinksTo } from "../../../db/model/Link.js"
import { isPathRedirectedToExplorer } from "../../../explorerAdminServer/ExplorerRedirects.js"
import { ParsedChartRecordRow, RawChartRecordRow } from "./types.js"
import { getUniqueNamesFromTagHierarchies } from "@ourworldindata/utils"
import {
    maybeAddChangeInPrefix,
    parseCatalogPaths,
    processAvailableEntities,
} from "./shared.js"
import { GrapherState } from "@ourworldindata/grapher"
import { toPlaintext } from "@ourworldindata/components"
import { getMaxViews7d, PageviewsByUrl } from "./pageviews.js"

const computeChartScore = (record: Omit<ChartRecord, "score">): number => {
    const { numRelatedArticles, views_7d } = record
    return numRelatedArticles * 500 + views_7d
}

const parseAndProcessChartRecords = (
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

    // Parse catalog paths to extract ETL dimensions
    const catalogPathsArray = JSON.parse(rawRecord.catalogPaths) as string[]
    const { datasetNamespaces, datasetVersions, datasetProducts } =
        parseCatalogPaths(catalogPathsArray)

    const datasetProducers = JSON.parse(
        rawRecord.datasetProducers as string
    ) as string[]

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

async function getChartRedirectSlugsByChartId(
    knex: db.KnexReadonlyTransaction,
    chartIds: number[]
): Promise<Map<number, string[]>> {
    const redirectMap = new Map<number, string[]>()
    if (chartIds.length === 0) return redirectMap

    const redirects = await knex<{
        chart_id: number
        slug: string
    }>(ChartSlugRedirectsTableName)
        .select("chart_id", "slug")
        .whereIn("chart_id", chartIds)

    for (const redirect of redirects) {
        const existing = redirectMap.get(redirect.chart_id)
        if (existing) existing.push(redirect.slug)
        else redirectMap.set(redirect.chart_id, [redirect.slug])
    }

    return redirectMap
}

function getChartViews7d(
    pageviews: PageviewsByUrl,
    slug: string,
    redirectSlugs: string[]
): number {
    const urls = [
        `/grapher/${slug}`,
        ...redirectSlugs.map((redirectSlug) => `/grapher/${redirectSlug}`),
    ]
    return getMaxViews7d(pageviews, urls)
}

export const getChartsRecords = async (
    knex: db.KnexReadonlyTransaction
): Promise<ChartRecord[]> => {
    console.log("Fetching charts to index")
    const chartsToIndex = await db.knexRaw<RawChartRecordRow>(
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
        ),
        entity_names AS (
            SELECT s.chartId,
                   COALESCE(JSON_ARRAYAGG(s.name), JSON_ARRAY()) AS entityNames
            FROM (
                     SELECT DISTINCT ce.chartId, e.name
                     FROM charts_x_entities ce
                              LEFT JOIN entities e ON ce.entityId = e.id
                     WHERE e.name IS NOT NULL
                 ) s
            GROUP BY s.chartId
        ),
        catalog_paths AS (
            SELECT s.chartId,
                   COALESCE(JSON_ARRAYAGG(s.catalogPath), JSON_ARRAY()) AS catalogPaths
            FROM (
                     SELECT DISTINCT cd.chartId, v.catalogPath
                     FROM chart_dimensions cd
                              LEFT JOIN variables v ON cd.variableId = v.id
                     WHERE v.catalogPath IS NOT NULL
                 ) s
            GROUP BY s.chartId
        ),
        origin_producers AS (
            SELECT s.chartId,
                   COALESCE(JSON_ARRAYAGG(s.producer), JSON_ARRAY()) AS datasetProducers
            FROM (
                     SELECT DISTINCT cd.chartId, TRIM(o.producer) AS producer
                     FROM chart_dimensions cd
                              INNER JOIN indexable_charts ic ON ic.id = cd.chartId
                              JOIN origins_variables ov ON cd.variableId = ov.variableId
                              JOIN origins o ON ov.originId = o.id
                     WHERE o.producer IS NOT NULL
                       AND TRIM(o.producer) != ''
                 ) s
            GROUP BY s.chartId
        ),
        chart_tags_names AS (
            SELECT s.chartId,
                   COALESCE(JSON_ARRAYAGG(s.name), JSON_ARRAY()) AS tags
            FROM (
                     SELECT ct.chartId, t.name
                     FROM chart_tags ct
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
               COALESCE(cp.catalogPaths, '[]') AS catalogPaths,
               COALESCE(op.datasetProducers, '[]') AS datasetProducers,
               ctn.tags,
               COALESCE(kct.keyChartForTags, '[]') AS keyChartForTags
        FROM indexable_charts c
                 LEFT JOIN entity_names en ON c.id = en.chartId
                 LEFT JOIN catalog_paths cp ON c.id = cp.chartId
                 LEFT JOIN origin_producers op ON c.id = op.chartId
                 INNER JOIN chart_tag_counts tc ON c.id = tc.chartId
                 LEFT JOIN chart_tags_names ctn ON c.id = ctn.chartId
                 LEFT JOIN key_chart_tags kct ON c.id = kct.chartId
        WHERE tc.tagCount >= 1
    `
    )

    const parsedRows = chartsToIndex.map(parseAndProcessChartRecords)

    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)
    const chartRedirectSlugsByChartId = await getChartRedirectSlugsByChartId(
        knex,
        parsedRows.map((row) => row.id)
    )

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)

    const records: ChartRecord[] = []
    for (const c of parsedRows) {
        const grapherState = new GrapherState(c.config)

        // Our search currently cannot render explorers, so don't index them because
        // otherwise they will fail when rendered in the search results
        if (isPathRedirectedToExplorer(`/grapher/${c.slug}`)) continue

        const relatedArticles = (await getRelatedArticles(knex, c.id)) ?? []
        const linksFromGdocs = await getPublishedLinksTo(
            knex,
            [c.slug],
            ContentGraphLinkType.Grapher
        )

        const title = maybeAddChangeInPrefix(
            c.config.title,
            grapherState.shouldAddChangeInPrefixToTitle
        )
        const plaintextSubtitle = _.isNil(c.config.subtitle)
            ? undefined
            : toPlaintext(c.config.subtitle)

        const topicTags = getUniqueNamesFromTagHierarchies(
            c.tags,
            topicHierarchiesByChildName
        )

        const record = {
            objectID: c.id.toString(),
            id: `grapher/${c.slug}`,
            type: ChartRecordType.Chart,
            chartId: c.id,
            slug: c.slug,
            title,
            variantName: c.config.variantName,
            subtitle: plaintextSubtitle,
            availableEntities: c.entityNames,
            numDimensions: parseInt(c.numDimensions),
            availableTabs: grapherState.availableTabs,
            publishedAt: c.publishedAt,
            updatedAt: c.updatedAt,
            tags: topicTags,
            keyChartForTags: c.keyChartForTags as string[],
            titleLength: c.config.title?.length ?? 0,
            // Number of references to this chart in all our posts and pages
            numRelatedArticles: relatedArticles.length + linksFromGdocs.length,
            views_7d: getChartViews7d(
                pageviews,
                c.slug,
                chartRedirectSlugsByChartId.get(c.id) ?? []
            ),
            isIncomeGroupSpecificFM: false,
            datasetNamespaces: c.datasetNamespaces,
            datasetVersions: c.datasetVersions,
            datasetProducts: c.datasetProducts,
            datasetProducers: c.datasetProducers,
        } as ChartRecord
        const score = computeChartScore(record)
        records.push({ ...record, score })
    }

    return records
}
