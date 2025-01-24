import e from "express"
import { Request } from "../authentication.js"
import {
    DbRawChartConfig,
    DbRawPostGdoc,
    GRAPHER_CHART_TYPES,
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherChartOrMapType,
    GrapherChartType,
    GrapherInterface,
    OwidGdocDataInsightIndexItem,
    OwidGdocDataInsightInterface,
    parseChartConfig,
    parsePostsGdocsRow,
} from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { getTagsGroupedByGdocId } from "../../db/model/Gdoc/GdocFactory.js"
import { mapQueryParamToChartTypeName } from "@ourworldindata/grapher"
import { getTimeDomainFromQueryString } from "@ourworldindata/utils"

type DataInsightRow = DbRawPostGdoc &
    OwidGdocDataInsightIndexItem["image"] & {
        chartConfig?: DbRawChartConfig["full"]
    }

export async function getAllDataInsightIndexItems(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return getAllDataInsightIndexItemsOrderedByUpdatedAt(trx)
}

async function getAllDataInsightIndexItemsOrderedByUpdatedAt(
    knex: db.KnexReadonlyTransaction
): Promise<OwidGdocDataInsightIndexItem[]> {
    const dataInsights = await db.knexRaw<DataInsightRow>(
        knex,
        `-- sql
        WITH latestImages AS (
            SELECT filename, cloudflareId, originalWidth, originalHeight
            FROM images
            WHERE replacedBy IS NULL
        )
        SELECT
            pg.*,
            COALESCE(cc_narrativeView.full, cc_grapherUrl.full) AS chartConfig,
            -- only works if the image block comes first, but that's usually the case for data insights
            COALESCE(pg.content ->> '$.body[0].smallFilename', pg.content ->> '$.body[0].filename') AS filename,
            i.cloudflareId,
            i.originalWidth,
            i.originalHeight
        FROM posts_gdocs pg
        -- extract slugs from URLs of the format /grapher/slug
        LEFT JOIN chart_configs cc_grapherUrl
            ON cc_grapherUrl.slug = SUBSTRING_INDEX(SUBSTRING_INDEX(content ->> '$."grapher-url"', '/grapher/', -1), '\\?', 1)
        LEFT JOIN chart_views cw
            ON cw.name = content ->> '$."narrative-view"'
        LEFT JOIN chart_configs cc_narrativeView
            ON cc_narrativeView.id = cw.chartConfigId
        -- only works if the image block comes first, but that's usually the case for data insights
        LEFT JOIN latestImages i
            ON i.filename = COALESCE(pg.content ->> '$.body[0].smallFilename', pg.content ->> '$.body[0].filename')
        WHERE pg.type = 'data-insight'
        ORDER BY pg.updatedAt DESC;`
    )
    const groupedTags = await getTagsGroupedByGdocId(
        knex,
        dataInsights.map((gdoc) => gdoc.id)
    )
    return dataInsights.map((gdoc) =>
        extractDataInsightIndexItem({
            gdoc: {
                ...(parsePostsGdocsRow(gdoc) as OwidGdocDataInsightInterface),
                tags: groupedTags[gdoc.id] ? groupedTags[gdoc.id] : null,
            },
            imageMetadata: {
                cloudflareId: gdoc.cloudflareId,
                originalWidth: gdoc.originalWidth,
                originalHeight: gdoc.originalHeight,
                filename: gdoc.filename,
            },
            chartConfig: gdoc.chartConfig
                ? parseChartConfig(gdoc.chartConfig)
                : undefined,
        })
    )
}

function extractDataInsightIndexItem({
    gdoc,
    imageMetadata,
    chartConfig,
}: {
    gdoc: OwidGdocDataInsightInterface
    imageMetadata?: OwidGdocDataInsightIndexItem["image"]
    chartConfig?: GrapherInterface
}): OwidGdocDataInsightIndexItem {
    const grapherUrl = gdoc.content["grapher-url"]?.trim()
    const isGrapherUrl = grapherUrl?.startsWith(
        "https://ourworldindata.org/grapher/"
    )
    const isExplorerUrl = grapherUrl?.startsWith(
        "https://ourworldindata.org/explorers/"
    )

    return {
        id: gdoc.id,
        slug: gdoc.slug,
        tags: gdoc.tags ?? [],
        published: gdoc.published,
        publishedAt: gdoc.publishedAt,
        title: gdoc.content.title ?? "",
        authors: gdoc.content.authors,
        markdown: gdoc.markdown,
        "approved-by": gdoc.content["approved-by"],
        "narrative-view": gdoc.content["narrative-view"],
        "grapher-url": isGrapherUrl ? grapherUrl : undefined,
        "explorer-url": isExplorerUrl ? grapherUrl : undefined,
        "figma-url": gdoc.content["figma-url"],
        chartType: detectChartType(gdoc, chartConfig),
        image: imageMetadata,
    }
}

function detectChartType(
    gdoc: OwidGdocDataInsightInterface,
    chartConfig?: GrapherInterface
): GrapherChartOrMapType | undefined {
    if (!chartConfig) return undefined

    if (gdoc.content["narrative-view"])
        return getChartTypeFromConfig(chartConfig)

    if (gdoc.content["grapher-url"]) {
        try {
            const url = new URL(gdoc.content["grapher-url"])
            return getChartTypeFromConfigAndQueryParams(
                chartConfig,
                url.searchParams
            )
        } catch {
            return getChartTypeFromConfig(chartConfig)
        }
    }

    return undefined
}

function getChartTypeFromConfig(
    chartConfig: GrapherInterface
): GrapherChartOrMapType | undefined {
    return getChartTypeFromConfigAndQueryParams(chartConfig)
}

function getChartTypeFromConfigAndQueryParams(
    chartConfig: GrapherInterface,
    queryParams?: URLSearchParams
): GrapherChartOrMapType | undefined {
    // If the tab query parameter is set, use it to determine the chart type
    const tab = queryParams?.get("tab")
    if (tab) {
        // Handle cases where tab is set to 'line' or 'slope'
        const chartType = mapQueryParamToChartTypeName(tab)
        if (chartType)
            return maybeLineChartThatTurnedIntoDiscreteBar(
                chartType,
                chartConfig,
                queryParams
            )

        // Handle cases where tab is set to 'chart', 'map' or 'table'
        if (tab === GRAPHER_TAB_QUERY_PARAMS.table) return undefined
        if (tab === GRAPHER_TAB_QUERY_PARAMS.map) return GRAPHER_MAP_TYPE
        if (tab === GRAPHER_TAB_QUERY_PARAMS.chart) {
            const chartType = getChartTypeFromConfigField(
                chartConfig.chartTypes
            )
            if (chartType)
                return maybeLineChartThatTurnedIntoDiscreteBar(
                    chartType,
                    chartConfig,
                    queryParams
                )
        }
    }

    // If the chart has a map tab and it's the default tab, use the map type
    if (
        chartConfig.hasMapTab &&
        chartConfig.tab === GRAPHER_TAB_QUERY_PARAMS.map
    )
        return GRAPHER_MAP_TYPE

    // Otherwise, rely on the config's chartTypes field
    const chartType = getChartTypeFromConfigField(chartConfig.chartTypes)
    if (chartType) {
        return maybeLineChartThatTurnedIntoDiscreteBar(
            chartType,
            chartConfig,
            queryParams
        )
    }

    return undefined
}

function getChartTypeFromConfigField(
    chartTypes?: GrapherChartType[]
): GrapherChartType | undefined {
    if (!chartTypes) return GRAPHER_CHART_TYPES.LineChart
    if (chartTypes.length === 0) return undefined
    return chartTypes[0]
}

function maybeLineChartThatTurnedIntoDiscreteBar(
    chartType: GrapherChartType,
    chartConfig: GrapherInterface,
    queryParams?: URLSearchParams
): GrapherChartType {
    if (chartType !== GRAPHER_CHART_TYPES.LineChart) return chartType

    const time = queryParams?.get("time")
    if (time) {
        const [minTime, maxTime] = getTimeDomainFromQueryString(time)
        if (minTime === maxTime) return GRAPHER_CHART_TYPES.DiscreteBar
    }

    if (
        chartConfig.minTime !== undefined &&
        chartConfig.minTime === chartConfig.maxTime
    )
        return GRAPHER_CHART_TYPES.DiscreteBar

    return chartType
}
