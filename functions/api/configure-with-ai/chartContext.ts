import {
    GrapherState,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import {
    GRAPHER_CHART_TYPES,
    GrapherInterface,
    MultiDimDataPageConfigEnriched,
} from "@ourworldindata/types"
import {
    getContinentForCountry,
    searchParamsToMultiDimView,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import { fetchUnparsedGrapherConfig } from "../../_common/grapherTools.js"
import {
    ChartContext,
    EntityInfo,
    IndicatorSummary,
    MdimContext,
    SeriesPoint,
} from "./viewfinder.js"

/** Tabs of a full grapher config, as query params (table first, like Grapher) */
function tabsOfConfig(config: GrapherInterface): string[] {
    const tabs = ["table"]
    if (config.hasMapTab) tabs.push("map")
    const chartTypes = config.chartTypes ?? [GRAPHER_CHART_TYPES.LineChart]
    for (const chartType of chartTypes)
        tabs.push(mapGrapherTabNameToQueryParam(chartType))
    return tabs
}

function summarizeFirstIndicator(grapherState: GrapherState): {
    summary: IndicatorSummary
    column: ReturnType<GrapherState["inputTable"]["get"]>
} {
    const column = grapherState.inputTable.get(grapherState.yColumnSlugs[0])
    const codes = grapherState.inputTable.entityNameToCodeMap
    const series = new Map<string, SeriesPoint[]>()
    let minYear = Infinity
    let maxYear = -Infinity
    for (const [name, rows] of column.owidRowsByEntityName) {
        const points: SeriesPoint[] = []
        for (const row of rows) {
            if (typeof row.value !== "number") continue
            points.push([row.time, row.value])
            if (row.time < minYear) minYear = row.time
            if (row.time > maxYear) maxYear = row.time
        }
        if (!points.length) continue
        points.sort((a, b) => a[0] - b[0])
        series.set(name, points)
    }
    const entities: EntityInfo[] = [...series.keys()]
        .map((name) => {
            const continent = getContinentForCountry(name)
            return {
                name,
                code: codes.get(name),
                continent,
                type: continent ? ("country" as const) : ("region" as const),
            }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    return { summary: { entities, series, minYear, maxYear }, column }
}

export function buildChartContext(
    grapherState: GrapherState,
    mdim?: MdimContext
): ChartContext {
    const { summary, column } = summarizeFirstIndicator(grapherState)
    return {
        title: grapherState.effectiveTitle,
        subtitle: grapherState.effectiveSubtitle,
        indicatorName: column.nonEmptyName,
        unit: column.unit,
        seriesName: column.displayName,
        // The summary table takes values within this many years of 1990, 2000, 2010
        tolerance: Math.max(column.tolerance, 2),
        tabs: grapherState.availableTabs.map(mapGrapherTabNameToQueryParam),
        currentTab: mapGrapherTabNameToQueryParam(grapherState.activeTab),
        selected: [...grapherState.selection.selectedEntityNames],
        data: summary,
        mdim,
    }
}

/**
 * The MDim's dimensions and every view's title, series and tabs. The views'
 * full configs are read from R2 (one read per view) since the MDim config's
 * own view configs don't carry what the indicators' configs add.
 */
export async function loadMdimContext(
    slug: string,
    searchParams: URLSearchParams,
    env: Env
): Promise<MdimContext> {
    const response = await fetchUnparsedGrapherConfig(
        { type: "multi-dim-slug", id: slug },
        env
    )
    if (response.status !== 200)
        throw new Error(`MDim config for ${slug}: ${response.status}`)
    const config: MultiDimDataPageConfigEnriched = await response.json()
    const fullConfigs = await Promise.all(
        config.views.map(async (view) => {
            const r = await fetchUnparsedGrapherConfig(
                { type: "uuid", id: view.fullConfigId },
                env
            )
            if (r.status !== 200)
                throw new Error(
                    `MDim view config ${view.fullConfigId}: ${r.status}`
                )
            const fullConfig: GrapherInterface = await r.json()
            return fullConfig
        })
    )
    const current = searchParamsToMultiDimView(config, searchParams).dimensions
    return {
        title: config.title.title,
        titleVariant: config.title.titleVariant,
        dimensions: config.dimensions.map((dim) => ({
            slug: dim.slug,
            name: dim.name,
            choices: dim.choices.map((c) => ({
                slug: c.slug,
                name: c.name,
                description: c.description,
            })),
        })),
        views: config.views.map((view, i) => {
            const full = fullConfigs[i]
            return {
                dims: view.dimensions,
                title: full.title ?? view.config?.title ?? "",
                seriesNames: (full.dimensions ?? [])
                    .filter((d) => d.property === "y")
                    .map((d) => d.display?.name ?? ""),
                tabs: tabsOfConfig(full),
            }
        }),
        current,
    }
}
