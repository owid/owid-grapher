import {
    GrapherChartType,
    IndicatorsAfterPreProcessing,
    View,
} from "@ourworldindata/types"
import {
    getMultiDimPageTitle,
    multiDimDimensionsToViewQueryStr,
} from "@ourworldindata/utils"
import { defaultGrapherConfig } from "@ourworldindata/grapher"
import { knexRaw, KnexReadonlyTransaction } from "../db.js"
import { getAllPublishedMultiDimDataPages } from "./MultiDimDataPage.js"

/**
 * Finds the published charts and multi-dims that use the indicators of a
 * dataset page's table. Each column of the table comes with a list of catalog
 * paths, and a chart uses a column if it uses an indicator whose catalog path
 * matches one of them.
 */

/** The parts of `<channel>/<namespace>/<version>/<dataset>/<table>#<column>` */
export interface CatalogPathParts {
    channel: string
    namespace: string
    /** A fixed version, or "*" to match any version */
    version: string
    dataset: string
    table: string
    column: string
}

/** Returns undefined if the path doesn't have exactly these six parts */
export function parseCatalogPath(path: string): CatalogPathParts | undefined {
    const [tablePath, column, ...rest] = path.split("#")
    if (!column || rest.length > 0) return undefined
    const parts = tablePath.split("/")
    if (parts.length !== 5 || parts.some((part) => part === ""))
        return undefined
    const [channel, namespace, version, dataset, table] = parts
    return { channel, namespace, version, dataset, table, column }
}

/**
 * Compares every part exactly, except the version when the pattern's version
 * is "*". (Exact comparison on purpose: column names are full of underscores,
 * which are wildcards in SQL LIKE patterns.)
 */
export function catalogPathMatches(
    pattern: CatalogPathParts,
    candidate: CatalogPathParts
): boolean {
    return (
        pattern.channel === candidate.channel &&
        pattern.namespace === candidate.namespace &&
        (pattern.version === "*" || pattern.version === candidate.version) &&
        pattern.dataset === candidate.dataset &&
        pattern.table === candidate.table &&
        pattern.column === candidate.column
    )
}

/** For each column of a table, the catalog paths of the indicators with its data */
export type CatalogPathsByColumn = Record<string, string[]>

export interface DatasetPageChartMatch {
    chartId: number
    slug: string
    title: string
    chartTypes: GrapherChartType[]
    hasMapTab: boolean
    /** Columns of the table that the chart uses */
    columns: string[]
}

export interface DatasetPageMultiDimViewMatch {
    /** e.g. "metric=total&source=coal" */
    queryStr: string
    chartTypes: GrapherChartType[]
    hasMapTab: boolean
    /** Columns of the table that the view uses */
    columns: string[]
}

export interface DatasetPageMultiDimMatch {
    multiDimId: number
    slug: string
    title: string
    /** The views that use the table's columns, in the order of the config */
    views: DatasetPageMultiDimViewMatch[]
    /** Columns of the table that any of these views uses */
    columns: string[]
}

export interface DatasetPageChartLookup {
    charts: DatasetPageChartMatch[]
    multiDims: DatasetPageMultiDimMatch[]
}

/** The ids of the indicators (of non-archived datasets) matching the paths, with the columns they match */
export async function getColumnsByVariableId(
    knex: KnexReadonlyTransaction,
    catalogPathsByColumn: CatalogPathsByColumn
): Promise<Map<number, Set<string>>> {
    // Group the patterns by namespace and dataset, to run one query per group
    const patternsByDataset = new Map<
        string,
        { pattern: CatalogPathParts; column: string }[]
    >()
    for (const [column, paths] of Object.entries(catalogPathsByColumn)) {
        for (const path of paths) {
            const pattern = parseCatalogPath(path)
            if (!pattern)
                throw new Error(
                    `Invalid catalog path "${path}" for column "${column}"`
                )
            const key = `${pattern.namespace}/${pattern.dataset}`
            const patterns = patternsByDataset.get(key) ?? []
            patterns.push({ pattern, column })
            patternsByDataset.set(key, patterns)
        }
    }

    const columnsByVariableId = new Map<number, Set<string>>()
    for (const patterns of patternsByDataset.values()) {
        const { namespace, dataset } = patterns[0].pattern
        const candidates = await knexRaw<{ id: number; catalogPath: string }>(
            knex,
            `-- sql
                SELECT v.id, v.catalogPath
                FROM variables v
                JOIN datasets d ON d.id = v.datasetId
                WHERE d.isArchived = 0
                    AND d.namespace = ?
                    AND d.shortName = ?
                    AND v.catalogPath IS NOT NULL
            `,
            [namespace, dataset]
        )
        for (const candidate of candidates) {
            const candidateParts = parseCatalogPath(candidate.catalogPath)
            if (!candidateParts) continue
            for (const { pattern, column } of patterns) {
                if (!catalogPathMatches(pattern, candidateParts)) continue
                const columns =
                    columnsByVariableId.get(candidate.id) ?? new Set()
                columns.add(column)
                columnsByVariableId.set(candidate.id, columns)
            }
        }
    }
    return columnsByVariableId
}

/** Chart types and map tab of a chart config, falling back to Grapher's defaults */
function parseTabFields(row: {
    chartTypes: string | null
    hasMapTab: string | null
}): { chartTypes: GrapherChartType[]; hasMapTab: boolean } {
    const chartTypes: GrapherChartType[] | null =
        row.chartTypes !== null ? JSON.parse(row.chartTypes) : null
    return {
        chartTypes: chartTypes ?? defaultGrapherConfig.chartTypes ?? [],
        hasMapTab:
            row.hasMapTab !== null
                ? row.hasMapTab === "true"
                : (defaultGrapherConfig.hasMapTab ?? false),
    }
}

async function getPublishedChartsUsingVariables(
    knex: KnexReadonlyTransaction,
    columnsByVariableId: Map<number, Set<string>>
): Promise<DatasetPageChartMatch[]> {
    const rows = await knexRaw<{
        chartId: number
        variableId: number
        slug: string
        title: string | null
        chartTypes: string | null
        hasMapTab: string | null
    }>(
        knex,
        `-- sql
            SELECT
                c.id AS chartId,
                cd.variableId,
                cc.slug,
                cc.config ->> "$.title" AS title,
                cc.config ->> "$.chartTypes" AS chartTypes,
                cc.config ->> "$.hasMapTab" AS hasMapTab
            FROM chart_dimensions cd
            JOIN charts c ON c.id = cd.chartId
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE cd.variableId IN (?)
                AND cc.config ->> "$.isPublished" = "true"
        `,
        [[...columnsByVariableId.keys()]]
    )

    // One row per chart and indicator, so merge the columns of each chart
    const chartsById = new Map<number, DatasetPageChartMatch>()
    for (const row of rows) {
        const chart = chartsById.get(row.chartId) ?? {
            chartId: row.chartId,
            slug: row.slug,
            title: row.title ?? row.slug,
            ...parseTabFields(row),
            columns: [],
        }
        for (const column of columnsByVariableId.get(row.variableId) ?? [])
            if (!chart.columns.includes(column)) chart.columns.push(column)
        chartsById.set(row.chartId, chart)
    }
    return [...chartsById.values()]
}

function getViewIndicatorIds(
    view: View<IndicatorsAfterPreProcessing>
): number[] {
    const { y, x, size, color } = view.indicators
    return [...y, x, size, color]
        .filter((indicator) => indicator !== undefined)
        .map((indicator) => indicator.id)
}

async function getPublishedMultiDimsUsingVariables(
    knex: KnexReadonlyTransaction,
    columnsByVariableId: Map<number, Set<string>>
): Promise<DatasetPageMultiDimMatch[]> {
    // multi_dim_x_chart_configs records only one indicator per view, so the
    // views' indicators are read from the multi-dim configs instead
    const multiDims = await getAllPublishedMultiDimDataPages(knex)
    const matchedViewsByMultiDim = multiDims.map((multiDim) => ({
        multiDim,
        views: multiDim.config.views
            .map((view) => ({
                view,
                columns: [
                    ...new Set(
                        getViewIndicatorIds(view).flatMap((id) => [
                            ...(columnsByVariableId.get(id) ?? []),
                        ])
                    ),
                ],
            }))
            .filter(({ columns }) => columns.length > 0),
    }))
    const matched = matchedViewsByMultiDim.filter(
        ({ views }) => views.length > 0
    )
    if (matched.length === 0) return []

    // The tabs of each view are in its rendered config
    const viewConfigRows = await knexRaw<{
        chartConfigId: string
        chartTypes: string | null
        hasMapTab: string | null
    }>(
        knex,
        `-- sql
            SELECT
                mx.chartConfigId,
                cc.config ->> "$.chartTypes" AS chartTypes,
                cc.config ->> "$.hasMapTab" AS hasMapTab
            FROM multi_dim_x_chart_configs mx
            JOIN chart_configs cc ON cc.id = mx.chartConfigId
            WHERE mx.multiDimId IN (?)
        `,
        [matched.map(({ multiDim }) => multiDim.id)]
    )
    const viewConfigsById = new Map(
        viewConfigRows.map((row) => [row.chartConfigId, row])
    )

    return matched.map(({ multiDim, views }) => ({
        multiDimId: multiDim.id,
        slug: multiDim.slug,
        title: getMultiDimPageTitle(multiDim.config.title),
        views: views.map(({ view, columns }) => {
            const viewConfig = viewConfigsById.get(view.fullConfigId)
            if (!viewConfig)
                throw new Error(
                    `No chart config ${view.fullConfigId} for a view of the multi-dim ${multiDim.slug}`
                )
            return {
                queryStr: multiDimDimensionsToViewQueryStr(view.dimensions),
                ...parseTabFields(viewConfig),
                columns,
            }
        }),
        columns: [...new Set(views.flatMap(({ columns }) => columns))],
    }))
}

export async function getChartsForDatasetPageTable(
    knex: KnexReadonlyTransaction,
    catalogPathsByColumn: CatalogPathsByColumn
): Promise<DatasetPageChartLookup> {
    const columnsByVariableId = await getColumnsByVariableId(
        knex,
        catalogPathsByColumn
    )
    if (columnsByVariableId.size === 0) return { charts: [], multiDims: [] }
    return {
        charts: await getPublishedChartsUsingVariables(
            knex,
            columnsByVariableId
        ),
        multiDims: await getPublishedMultiDimsUsingVariables(
            knex,
            columnsByVariableId
        ),
    }
}
