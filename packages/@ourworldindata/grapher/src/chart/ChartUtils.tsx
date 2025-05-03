import * as React from "react"
import {
    areSetsEqual,
    Box,
    getCountryByName,
    getTimeDomainFromQueryString,
    Url,
} from "@ourworldindata/utils"
import {
    SeriesStrategy,
    EntityName,
    GrapherTabQueryParam,
    GrapherChartType,
    GrapherTabConfigOption,
    InteractionState,
    SeriesName,
    GrapherInterface,
    GrapherChartOrMapType,
    ColumnSlug,
    GrapherChartTypeSupportedForSwitching,
    GRAPHER_CHART_TYPES_SUPPORTED_FOR_SWITCHING,
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
import { OwidTable } from "@ourworldindata/core-table"

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
    index: number
): string => {
    return `${series.seriesName}-${series.color}-${
        series.isProjection ? "projection" : ""
    }-${index}`
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

export function isChartTypeSupportedForSwitching(
    chartType: GrapherChartType
): chartType is GrapherChartTypeSupportedForSwitching {
    return GRAPHER_CHART_TYPES_SUPPORTED_FOR_SWITCHING.includes(
        chartType as any
    )
}

export function mapQueryParamToChartTypeName(
    chartTab: string
): GrapherChartType | undefined {
    switch (chartTab) {
        case "line":
            return "LineChart"
        case "slope":
            return "SlopeChart"
        case "scatter":
            return "ScatterPlot"
        case "stacked-area":
            return "StackedArea"
        case "stacked-bar":
            return "StackedBar"
        case "discrete-bar":
            return "DiscreteBar"
        case "stacked-discrete-bar":
            return "StackedDiscreteBar"
        case "marimekko":
            return "Marimekko"
        default:
            return undefined
    }
}

export function mapChartTypeNameToQueryParam(
    chartType: GrapherChartTypeSupportedForSwitching
): GrapherTabQueryParam {
    switch (chartType) {
        case "LineChart":
            return "line"
        case "SlopeChart":
            return "slope"
    }
}

export function mapTabOptionToChartTypeName(
    chartTab: GrapherTabConfigOption
): GrapherChartType | undefined {
    switch (chartTab) {
        case "line":
            return "LineChart"
        case "slope":
            return "SlopeChart"
        default:
            return undefined
    }
}

export function mapChartTypeNameToTabOption(
    chartType: GrapherChartType
): GrapherTabConfigOption {
    switch (chartType) {
        case "LineChart":
            return "line"
        case "SlopeChart":
            return "slope"
        default:
            return "chart"
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
    // active series rank highest and hover trumps focus
    if (series.hover.active) return 4
    if (series.focus.active) return 3

    // series in their default state rank in the middle
    if (!series.hover.background && !series.focus.background) return 2

    // background series rank lowest
    return 1
}

export function makeAxisLabel({
    label,
    unit,
    shortUnit,
}: {
    label: string
    unit?: string
    shortUnit?: string
}): {
    mainLabel: string // shown in bold
    unit?: string // shown in normal weight, usually in parens
} {
    const displayUnit = unit && unit !== shortUnit ? unit : undefined
    const unitInParens = displayUnit ? `(${displayUnit})` : undefined

    if (unitInParens) {
        // extract text in parens at the end of the label,
        // e.g. "Population (millions)" is split into "Population " and "(millions)"
        const [
            _fullMatch,
            untrimmedMainLabelText = undefined,
            labelTextInParens = undefined,
        ] = label.trim().match(/^(.*?)(\([^()]*\))?$/s) ?? []
        const mainLabelText = untrimmedMainLabelText?.trim() ?? ""

        // don't show unit twice if it's contained in the label
        const displayLabel =
            labelTextInParens === unitInParens ? mainLabelText : label

        return { mainLabel: displayLabel, unit: unitInParens }
    }

    return { mainLabel: label }
}

/**
 * Given a URL for a CF function grapher thumbnail, generate a srcSet for the image at different widths
 * @param defaultSrc - `https://ourworldindata.org/grapher/thumbnail/life-expectancy.png?tab=chart`
 * @returns srcSet - `https://ourworldindata.org/grapher/thumbnail/life-expectancy.png?tab=chart&imWidth=850 850w, https://ourworldindata.org/grapher/thumbnail/life-expectancy.png?tab=chart&imWidth=1700 1700w`
 */
export function generateGrapherImageSrcSet(defaultSrc: string): string {
    const url = Url.fromURL(defaultSrc)
    const existingQueryParams = url.queryParams
    const imWidths = ["850", "1700"]
    const srcSet = imWidths
        .map((imWidth) => {
            return `${url.setQueryParams({ ...existingQueryParams, imWidth }).fullUrl} ${imWidth}w`
        })
        .join(", ")

    return srcSet
}

export function getChartTypeFromConfig(
    chartConfig: GrapherInterface
): GrapherChartOrMapType | undefined {
    return getChartTypeFromConfigAndQueryParams(chartConfig)
}

// TODO: use GrapherState to detect chart type
export function getChartTypeFromConfigAndQueryParams(
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
        if (tab === "table") return undefined
        if (tab === "map") return "WorldMap"
        if (tab === "chart") {
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
    if (chartConfig.hasMapTab && chartConfig.tab === "map") return "WorldMap"

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
    if (!chartTypes) return "LineChart"
    if (chartTypes.length === 0) return undefined
    return chartTypes[0]
}

function maybeLineChartThatTurnedIntoDiscreteBar(
    chartType: GrapherChartType,
    chartConfig: GrapherInterface,
    queryParams?: URLSearchParams
): GrapherChartType {
    if (chartType !== "LineChart") return chartType

    const time = queryParams?.get("time")
    if (time) {
        const [minTime, maxTime] = getTimeDomainFromQueryString(time)
        if (minTime === maxTime) return "DiscreteBar"
    }

    if (
        chartConfig.minTime !== undefined &&
        chartConfig.minTime === chartConfig.maxTime
    )
        return "DiscreteBar"

    return chartType
}

/** Find a start time for which a slope chart shows as many lines as possible */
export function findStartTimeForSlopeChart(
    table: OwidTable,
    columnSlugs: ColumnSlug[],
    originalStartTime: number,
    endTime: number
): number {
    const timeCol = table.timeColumn
    const times = timeCol.uniqTimesAsc
    const startTimeIndex = times.findIndex((time) => time >= originalStartTime)

    // Bail if we can't find the start time
    if (startTimeIndex === -1) return originalStartTime

    const entityNames = table.availableEntityNames
    const maxNumSeries = entityNames.length * columnSlugs.length

    let candidate = { time: originalStartTime, numSeries: 0 }

    // Iterate over all times and keep track of how many lines can be displayed on the chart
    for (let i = startTimeIndex; i < times.length; i++) {
        const time = times[i]

        // Don't pick a start time that is after the end time
        if (time >= endTime) break

        let numSeries = maxNumSeries
        for (const entityName of entityNames) {
            for (const slug of columnSlugs) {
                const column = table.get(slug)
                const owidRows =
                    column.owidRowByEntityNameAndTime.get(entityName)

                // If the entity doesn't have any data, we can't draw a line
                if (!owidRows) {
                    numSeries -= 1
                    if (numSeries <= candidate.numSeries) break
                    continue
                }

                const startValue = owidRows.get(time)
                const endValue = owidRows.get(endTime)

                // If one of the values is missing, we can't draw a line
                if (startValue === undefined || endValue === undefined) {
                    numSeries -= 1
                    if (numSeries <= candidate.numSeries) break
                }
            }

            // Stop early if the current time has less data than the current candidate
            if (numSeries <= candidate.numSeries) break
        }

        // We found a time for which all lines can be drawn
        if (numSeries === maxNumSeries) return time

        // Update the candidate if we found a better time
        if (numSeries > candidate.numSeries) candidate = { time, numSeries }
    }

    return candidate.time
}
