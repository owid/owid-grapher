import React from "react"
import { Box, getCountryByName } from "@ourworldindata/utils"
import {
    SeriesStrategy,
    EntityName,
    GrapherTabQueryParam,
    ChartTypeName,
} from "@ourworldindata/types"
import { LineChartSeries } from "../lineCharts/LineChartConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { ChartManager } from "./ChartManager"
import {
    GRAPHER_SIDE_PANEL_CLASS,
    GRAPHER_TIMELINE_CLASS,
    GRAPHER_SETTINGS_CLASS,
} from "../core/GrapherConstants"

export const autoDetectYColumnSlugs = (manager: ChartManager): string[] => {
    if (manager.yColumnSlugs && manager.yColumnSlugs.length)
        return manager.yColumnSlugs
    if (manager.yColumnSlug) return [manager.yColumnSlug]
    return manager.table.numericColumnSlugs
}

export const getDefaultFailMessage = (manager: ChartManager): string => {
    if (manager.table.rootTable.isBlank) return `No table loaded yet.`
    if (manager.table.rootTable.entityNameColumn.isMissing)
        return `Table is missing an EntityName column.`
    if (manager.table.rootTable.timeColumn.isMissing)
        return `Table is missing a Time column.`
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
): ChartTypeName | undefined {
    switch (chartTab) {
        case GrapherTabQueryParam.LineChart:
            return ChartTypeName.LineChart
        case GrapherTabQueryParam.SlopeChart:
            return ChartTypeName.SlopeChart
        case GrapherTabQueryParam.ScatterPlot:
            return ChartTypeName.ScatterPlot
        case GrapherTabQueryParam.StackedArea:
            return ChartTypeName.StackedArea
        case GrapherTabQueryParam.StackedBar:
            return ChartTypeName.StackedBar
        case GrapherTabQueryParam.DiscreteBar:
            return ChartTypeName.DiscreteBar
        case GrapherTabQueryParam.StackedDiscreteBar:
            return ChartTypeName.StackedDiscreteBar
        case GrapherTabQueryParam.Marimekko:
            return ChartTypeName.Marimekko
        default:
            return undefined
    }
}

export function mapChartTypeNameToQueryParam(
    chartType: ChartTypeName
): GrapherTabQueryParam {
    switch (chartType) {
        case ChartTypeName.LineChart:
            return GrapherTabQueryParam.LineChart
        case ChartTypeName.SlopeChart:
            return GrapherTabQueryParam.SlopeChart
        case ChartTypeName.ScatterPlot:
            return GrapherTabQueryParam.ScatterPlot
        case ChartTypeName.StackedArea:
            return GrapherTabQueryParam.StackedArea
        case ChartTypeName.StackedBar:
            return GrapherTabQueryParam.StackedBar
        case ChartTypeName.DiscreteBar:
            return GrapherTabQueryParam.DiscreteBar
        case ChartTypeName.StackedDiscreteBar:
            return GrapherTabQueryParam.StackedDiscreteBar
        case ChartTypeName.Marimekko:
            return GrapherTabQueryParam.Marimekko
        // TODO: remove once stricter typed
        default:
            return GrapherTabQueryParam.LineChart
    }
}
