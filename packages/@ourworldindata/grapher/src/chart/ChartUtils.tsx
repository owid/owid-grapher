import * as React from "react"
import {
    Box,
    getCountryByName,
    getTimeDomainFromQueryString,
    isSubsetOf,
    Url,
} from "@ourworldindata/utils"
import {
    SeriesStrategy,
    EntityName,
    GrapherTabQueryParam,
    GrapherChartType,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherTabOption,
    GRAPHER_TAB_OPTIONS,
    InteractionState,
    SeriesName,
    GrapherInterface,
    GrapherChartOrMapType,
    GRAPHER_MAP_TYPE,
    ColumnSlug,
    GrapherTabName,
    ALL_GRAPHER_CHART_TYPES,
    GRAPHER_TAB_NAMES,
    ProjectionColumnInfo,
    CoreValueType,
    PrimitiveType,
    ColumnTypeNames,
    Time,
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
import {
    CoreColumn,
    ErrorValueTypes,
    isNotErrorValueOrEmptyCell,
    OwidTable,
} from "@ourworldindata/core-table"

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

export function mapTabOptionToChartTypeName(
    chartTab: GrapherTabOption
): GrapherChartType | undefined {
    switch (chartTab) {
        case GRAPHER_TAB_OPTIONS.line:
            return GRAPHER_CHART_TYPES.LineChart
        case GRAPHER_TAB_OPTIONS.slope:
            return GRAPHER_CHART_TYPES.SlopeChart
        case GRAPHER_TAB_OPTIONS["discrete-bar"]:
            return GRAPHER_CHART_TYPES.DiscreteBar
        default:
            return undefined
    }
}

export function mapChartTypeNameToTabOption(
    chartType: GrapherChartType
): GrapherTabOption {
    switch (chartType) {
        case GRAPHER_CHART_TYPES.LineChart:
            return GRAPHER_TAB_OPTIONS.line
        case GRAPHER_CHART_TYPES.SlopeChart:
            return GRAPHER_TAB_OPTIONS.slope
        case GRAPHER_CHART_TYPES.DiscreteBar:
            return GRAPHER_TAB_OPTIONS["discrete-bar"]
        default:
            return GRAPHER_TAB_OPTIONS.chart
    }
}

export function isChartTypeName(
    candidate: string
): candidate is GrapherChartType {
    return ALL_GRAPHER_CHART_TYPES.includes(candidate as any)
}

export function isGrapherTabOption(tab: string): tab is GrapherTabOption {
    return Object.values(GRAPHER_TAB_OPTIONS).includes(tab as GrapherTabOption)
}

export function findValidChartTypeCombination(
    chartTypeSet: Set<GrapherChartType>
): GrapherChartType[] | undefined {
    for (const validCombination of validChartTypeCombinations) {
        const validCombinationSet = new Set(validCombination)
        if (isSubsetOf(chartTypeSet, validCombinationSet))
            return validCombination.filter((chartType) =>
                chartTypeSet.has(chartType)
            )
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

    if (displayUnit) {
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
            labelTextInParens === `(${displayUnit})` ? mainLabelText : label

        return { mainLabel: displayLabel, unit: displayUnit }
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

    const pairsToCheck: [CoreColumn, string][] = []

    // Find all (col, entityName) pairings that have an endpoint available at endTime.
    // These are the series we need to consider, because we never change endTime,
    // and if there's no data at the end time, we can't show a line.
    for (const columnSlug of columnSlugs) {
        const column = table.get(columnSlug)
        for (const [
            entityName,
            timeMap,
        ] of column.owidRowByEntityNameAndTime.entries()) {
            const endValue = timeMap.get(endTime)

            if (endValue !== undefined) {
                pairsToCheck.push([column, entityName])
            }
        }
    }

    const maxNumSeries = pairsToCheck.length

    let candidate = { time: originalStartTime, numSeries: 0 }

    // Iterate over all times and keep track of how many lines can be displayed on the chart
    for (let i = startTimeIndex; i < times.length; i++) {
        const time = times[i]

        // Don't pick a start time that is after the end time
        if (time >= endTime) break

        let numSeries = maxNumSeries
        for (const [col, entityName] of pairsToCheck) {
            const owidRows = col.owidRowByEntityNameAndTime.get(entityName)

            const startValue = owidRows?.get(time)

            if (startValue === undefined) {
                numSeries -= 1

                // Stop early if the current time has less data than the current candidate
                if (numSeries <= candidate.numSeries) break
            }
        }

        // We found a time for which all lines can be drawn
        if (numSeries === maxNumSeries) return time

        // Update the candidate if we found a better time
        if (numSeries > candidate.numSeries) candidate = { time, numSeries }
    }

    return candidate.time
}

export const isChartTab = (tab: GrapherTabName): boolean =>
    tab !== GRAPHER_TAB_NAMES.Table && tab !== GRAPHER_TAB_NAMES.WorldMap

export const isMapTab = (tab: GrapherTabName): boolean =>
    tab === GRAPHER_TAB_NAMES.WorldMap

export function combineHistoricalAndProjectionColumns(
    table: OwidTable,
    info: ProjectionColumnInfo,
    options?: { shouldAddIsProjectionColumn: boolean }
): OwidTable {
    const {
        historicalSlug,
        projectedSlug,
        combinedSlug,
        slugForIsProjectionColumn,
    } = info

    const transformFn = (
        row: Record<ColumnSlug, { value: CoreValueType; time: Time }>,
        time: Time
    ): { isProjection: boolean; value: PrimitiveType } | undefined => {
        // It's possible to have both a historical and a projected value
        // for a given year. In that case, we prefer the historical value.

        const historical = row[historicalSlug]
        const projected = row[projectedSlug]

        const historicalTimeDiff = Math.abs(historical.time - time)
        const projectionTimeDiff = Math.abs(projected.time - time)

        if (
            isNotErrorValueOrEmptyCell(historical.value) &&
            // If tolerance was applied to the historical column, we need to
            // make sure the interpolated historical value doesn't get picked
            // over the actual projected value
            historicalTimeDiff <= projectionTimeDiff
        )
            return { value: historical.value, isProjection: false }

        if (isNotErrorValueOrEmptyCell(projected.value)) {
            return { value: projected.value, isProjection: true }
        }

        return undefined
    }

    // Combine the historical and projected values into a single column
    table = table.combineColumns(
        [projectedSlug, historicalSlug],
        { ...table.get(projectedSlug).def, slug: combinedSlug },
        (row, time) =>
            transformFn(row, time)?.value ??
            ErrorValueTypes.MissingValuePlaceholder
    )

    // Add a column indicating whether the value is a projection or not
    if (options?.shouldAddIsProjectionColumn)
        table = table.combineColumns(
            [projectedSlug, historicalSlug],
            {
                slug: slugForIsProjectionColumn,
                type: ColumnTypeNames.Boolean,
            },
            (row, time) =>
                transformFn(row, time)?.isProjection ??
                ErrorValueTypes.MissingValuePlaceholder
        )

    return table
}
