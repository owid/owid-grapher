import React from "react"
import { areSetsEqual, Box, getCountryByName } from "@ourworldindata/utils"
import {
    SeriesStrategy,
    EntityName,
    GrapherTabQueryParam,
    GrapherChartType,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_QUERY_PARAMS,
    InteractionState,
    SeriesName,
} from "@ourworldindata/types"
import { LineChartSeries } from "../lineCharts/LineChartConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { ChartManager } from "./ChartManager"
import {
    GRAPHER_SIDE_PANEL_CLASS,
    GRAPHER_TIMELINE_CLASS,
    GRAPHER_SETTINGS_CLASS,
    validChartTypeCombinations,
} from "../core/GrapherConstants"
import { ChartSeries } from "./ChartInterface"

export const autoDetectYColumnSlugs = (manager: ChartManager): string[] => {
    if (manager.yColumnSlugs && manager.yColumnSlugs.length)
        return manager.yColumnSlugs
    if (manager.yColumnSlug) return [manager.yColumnSlug]
    return manager.table.numericColumnSlugs
}

export const getDefaultFailMessage = (manager: ChartManager): string => {
    if (manager.table.rootTable.isBlank) return `No table loaded yet`
    if (manager.table.rootTable.entityNameColumn.isMissing)
        return `Table is missing an EntityName column`
    if (manager.table.rootTable.timeColumn.isMissing)
        return `Table is missing a Time column`
    const yColumnSlugs = autoDetectYColumnSlugs(manager)
    if (!yColumnSlugs.length) return "Missing Y axis column"
    const selection = makeSelectionArray(manager.selection)
    if (!selection.hasSelection) return `No ${manager.entityType} selected`
    return ""
}

export const getSeriesKey = (
    series: LineChartSeries,
    suffix?: string
): string => {
    return `${series.seriesName}-${series.color}-${
        series.isProjection ? "projection" : ""
    }${suffix ? "-" + suffix : ""}`
}

export const autoDetectSeriesStrategy = (
    manager: ChartManager,
    handleProjections: boolean = false
): SeriesStrategy => {
    if (manager.seriesStrategy) return manager.seriesStrategy

    let columnThreshold: number = 1

    if (handleProjections && manager.transformedTable) {
        const yColumnSlugs = autoDetectYColumnSlugs(manager)
        const yColumns = yColumnSlugs.map((slug) =>
            manager.transformedTable!.get(slug)
        )
        const hasNormalAndProjectedSeries =
            yColumns.some((col) => col.isProjection) &&
            yColumns.some((col) => !col.isProjection)
        if (hasNormalAndProjectedSeries) {
            columnThreshold = 2
        }
    }

    return autoDetectYColumnSlugs(manager).length > columnThreshold
        ? SeriesStrategy.column
        : SeriesStrategy.entity
}

export const makeClipPath = (
    renderUid: number,
    box: Box
): { id: string; element: React.ReactElement } => {
    const id = `boundsClip-${renderUid}`
    return {
        id: `url(#${id})`,
        element: (
            <defs>
                <clipPath id={id}>
                    <rect {...box}></rect>
                </clipPath>
            </defs>
        ),
    }
}

export const makeSelectionArray = (
    selection?: SelectionArray | EntityName[]
): SelectionArray =>
    selection instanceof SelectionArray
        ? selection
        : new SelectionArray(selection ?? [])

export function isElementInteractive(element: HTMLElement): boolean {
    const interactiveTags = ["a", "button", "input"]
    const interactiveClassNames = [
        GRAPHER_TIMELINE_CLASS,
        GRAPHER_SIDE_PANEL_CLASS,
        GRAPHER_SETTINGS_CLASS,
    ].map((className) => `.${className}`)

    const selector = [...interactiveTags, ...interactiveClassNames].join(", ")

    // check if the target is an interactive element or contained within one
    return element.closest(selector) !== null
}

export function getShortNameForEntity(entityName: string): string | undefined {
    const country = getCountryByName(entityName)
    return country?.shortName
}

export function isTargetOutsideElement(
    target: EventTarget,
    element: Node
): boolean {
    const targetNode = target as Node
    return (
        !element.contains(targetNode) &&
        // check that the target is still mounted to the document (we also get
        // click events on nodes that have since been removed by React)
        document.contains(targetNode)
    )
}

export function mapQueryParamToChartTypeName(
    chartTab: string
): GrapherChartType | undefined {
    switch (chartTab) {
        case GRAPHER_TAB_QUERY_PARAMS.line:
            return GRAPHER_CHART_TYPES.LineChart
        case GRAPHER_TAB_QUERY_PARAMS.slope:
            return GRAPHER_CHART_TYPES.SlopeChart
        case GRAPHER_TAB_QUERY_PARAMS.scatter:
            return GRAPHER_CHART_TYPES.ScatterPlot
        case GRAPHER_TAB_QUERY_PARAMS["stacked-area"]:
            return GRAPHER_CHART_TYPES.StackedArea
        case GRAPHER_TAB_QUERY_PARAMS["stacked-bar"]:
            return GRAPHER_CHART_TYPES.StackedBar
        case GRAPHER_TAB_QUERY_PARAMS["discrete-bar"]:
            return GRAPHER_CHART_TYPES.DiscreteBar
        case GRAPHER_TAB_QUERY_PARAMS["stacked-discrete-bar"]:
            return GRAPHER_CHART_TYPES.StackedDiscreteBar
        case GRAPHER_TAB_QUERY_PARAMS.marimekko:
            return GRAPHER_CHART_TYPES.Marimekko
        default:
            return undefined
    }
}

export function mapChartTypeNameToQueryParam(
    chartType: GrapherChartType
): GrapherTabQueryParam {
    switch (chartType) {
        case GRAPHER_CHART_TYPES.LineChart:
            return GRAPHER_TAB_QUERY_PARAMS.line
        case GRAPHER_CHART_TYPES.SlopeChart:
            return GRAPHER_TAB_QUERY_PARAMS.slope
        case GRAPHER_CHART_TYPES.ScatterPlot:
            return GRAPHER_TAB_QUERY_PARAMS.scatter
        case GRAPHER_CHART_TYPES.StackedArea:
            return GRAPHER_TAB_QUERY_PARAMS["stacked-area"]
        case GRAPHER_CHART_TYPES.StackedBar:
            return GRAPHER_TAB_QUERY_PARAMS["stacked-bar"]
        case GRAPHER_CHART_TYPES.DiscreteBar:
            return GRAPHER_TAB_QUERY_PARAMS["discrete-bar"]
        case GRAPHER_CHART_TYPES.StackedDiscreteBar:
            return GRAPHER_TAB_QUERY_PARAMS["stacked-discrete-bar"]
        case GRAPHER_CHART_TYPES.Marimekko:
            return GRAPHER_TAB_QUERY_PARAMS.marimekko
    }
}

export function findValidChartTypeCombination(
    chartTypes: GrapherChartType[]
): GrapherChartType[] | undefined {
    const chartTypeSet = new Set(chartTypes)
    for (const validCombination of validChartTypeCombinations) {
        const validCombinationSet = new Set(validCombination)
        if (areSetsEqual(chartTypeSet, validCombinationSet))
            return validCombination
    }
    return undefined
}

export function getHoverStateForSeries(
    series: ChartSeries,
    props: {
        hoveredSeriesNames: SeriesName[]
        // usually the hover mode is active when there is
        // at least one hovered element. But sometimes the hover
        // mode might be active although there are no hovered elements.
        // For example, when the facet legend is hovered but a particular
        // chart doesn't plot the hovered element.
        isHoverModeActive?: boolean
    }
): InteractionState {
    const hoveredSeriesNames = props.hoveredSeriesNames
    const isHoverModeActive =
        props.isHoverModeActive ?? hoveredSeriesNames.length > 0

    const active = hoveredSeriesNames.includes(series.seriesName)
    const background = isHoverModeActive && !active
    return { active, background }
}

/** Useful for sorting series by their interaction state */
export function byHoverThenFocusState(series: {
    hover: InteractionState
    focus: InteractionState
}): number {
    // background series rank lowest
    if (series.hover.background || series.focus.background) return 1

    // active series rank highest and hover trumps focus
    if (series.hover.active) return 4
    if (series.focus.active) return 3

    // series in their default state rank in the middle
    return 2
}
