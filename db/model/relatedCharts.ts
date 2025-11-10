import {
    type ArchiveContext,
    RelatedChart,
    parseChartConfig,
} from "@ourworldindata/types"
import { excludeNullish } from "@ourworldindata/utils"
import { GrapherState } from "@ourworldindata/grapher"
import { toPlaintext } from "@ourworldindata/components"

export interface RelatedChartQueryRow {
    chartId: number
    slug: string
    config: string
    title: string | null
    variantName: string | null
    keyChartLevel: number | null
    entityNames: string | null
}

export const RELATED_CHARTS_SELECT = `
    SELECT
        charts.id AS chartId,
        chart_configs.slug,
        chart_configs.full AS config,
        chart_configs.full->>"$.title" AS title,
        chart_configs.full->>"$.variantName" AS variantName,
        MAX(chart_tags.keyChartLevel) AS keyChartLevel,
        JSON_ARRAYAGG(entities.name) AS entityNames
    FROM charts
    JOIN chart_configs ON charts.configId = chart_configs.id
    INNER JOIN chart_tags ON charts.id = chart_tags.chartId
    LEFT JOIN charts_x_entities ON charts.id = charts_x_entities.chartId
    LEFT JOIN entities ON charts_x_entities.entityId = entities.id
`

export const RELATED_CHARTS_GROUP_BY_ORDER = `
    GROUP BY charts.id, chart_configs.slug, chart_configs.full
    ORDER BY title ASC
`

export const RELATED_CHARTS_PUBLISHED_FILTER = `
    AND chart_configs.full->>"$.isPublished" = "true"
`

export interface MapRelatedChartsOptions {
    archivedVersions?: Record<number, ArchiveContext | undefined>
}

export const mapRelatedChartRows = (
    rows: RelatedChartQueryRow[],
    options: MapRelatedChartsOptions = {}
): RelatedChart[] => {
    const { archivedVersions } = options

    return rows.map((row) => {
        const config = parseChartConfig(row.config)
        const grapherState = new GrapherState(config)

        const subtitle = config.subtitle
            ? toPlaintext(config.subtitle)
            : undefined

        const entityNames = row.entityNames
            ? (JSON.parse(row.entityNames) as (string | null)[])
            : []
        const availableEntities = Array.from(
            new Set(excludeNullish(entityNames))
        )

        const variantName = config.variantName ?? row.variantName ?? undefined
        const title = config.title ?? row.title ?? ""

        return {
            chartId: row.chartId,
            slug: row.slug,
            title,
            variantName,
            keyChartLevel: row.keyChartLevel ?? undefined,
            archiveContext: archivedVersions?.[row.chartId],
            objectID: row.chartId.toString(),
            availableEntities,
            availableTabs: Array.from(grapherState.availableTabs),
            subtitle,
        }
    })
}
