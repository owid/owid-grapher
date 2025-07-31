import * as R from "remeda"
import { match } from "ts-pattern"
import {
    GrapherState,
    LineChartState,
    DiscreteBarChartState,
    ScatterPlotChartState,
    StackedAreaChartState,
    StackedDiscreteBarChartState,
    SlopeChartState,
    StackedBarChartState,
    MarimekkoChartState,
    MapChartState,
    ChartState,
    makeChartState,
    isNumericBin,
    isNoDataBin,
    NumericBin,
    ColorScaleBin,
} from "@ourworldindata/grapher"
import { excludeUndefined, mappableCountries } from "@ourworldindata/utils"
import {
    EntityName,
    FacetStrategy,
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_NAMES,
    PrimitiveType,
    SeriesStrategy,
} from "@ourworldindata/types"
import { SearchChartHitDataTableProps } from "./SearchChartHitDataTable"
import { SearchChartHitDataPointsProps } from "./SearchChartHitDataPoints"
import {
    getColumnNameForDisplay,
    calculateTrendDirection,
    getColumnUnitForDisplay,
} from "./searchUtils.js"
import { OwidTable } from "@ourworldindata/core-table"

interface BaseArgs {
    grapherState: GrapherState
    maxRows?: number
}

interface Args<State extends ChartState = ChartState> extends BaseArgs {
    chartState: State
}

export function buildChartHitDataTableProps(
    props: BaseArgs
): SearchChartHitDataTableProps | SearchChartHitDataPointsProps {
    const chartState = hasMultipleSeriesPerFacet(props.grapherState)
        ? props.grapherState.facetChartInstance?.intermediateChartInstances[0]
              ?.chartState
        : props.grapherState.chartState

    return match(props.grapherState.activeTab)
        .with(GRAPHER_TAB_NAMES.LineChart, () =>
            buildDataTablePropsForLineChart({
                ...props,
                chartState: chartState as LineChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.DiscreteBar, () =>
            buildDataTablePropsForDiscreteBarChart({
                ...props,
                chartState: chartState as DiscreteBarChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.ScatterPlot, () =>
            buildDataTablePropsForScatterPlot({
                ...props,
                chartState: chartState as ScatterPlotChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.StackedArea, () =>
            buildDataTablePropsForStackedAreaAndBarChart({
                ...props,
                chartState: chartState as StackedAreaChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.StackedDiscreteBar, () =>
            buildDataTablePropsForStackedDiscreteBarChart({
                ...props,
                chartState: chartState as StackedDiscreteBarChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.SlopeChart, () =>
            buildDataTablePropsForSlopeChart({
                ...props,
                chartState: chartState as SlopeChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.StackedBar, () =>
            buildDataTablePropsForStackedAreaAndBarChart({
                ...props,
                chartState: chartState as StackedBarChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.Marimekko, () =>
            buildDataTablePropsForMarimekkoChart({
                ...props,
                chartState: chartState as MarimekkoChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.WorldMap, () =>
            buildDataTablePropsForWorldMap({
                ...props,
                chartState: chartState as MapChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.Table, () =>
            buildDataTablePropsForTableTab(props)
        )
        .exhaustive()
}

function buildDataTablePropsForLineChart({
    grapherState,
    chartState,
    maxRows,
}: Args<LineChartState>): SearchChartHitDataTableProps {
    const formatColumn = grapherState.inputTable.get(grapherState.yColumnSlug)

    // Create a map chart state to access custom label formatting.
    // When `map.tooltipUseCustomLabels` is enabled, this allows us to display
    // custom color scheme labels (e.g. "Low", "Medium", "High") instead of
    // the numeric values
    const mapChartState = makeChartState(
        GRAPHER_MAP_TYPE,
        grapherState
    ) as MapChartState
    const formatValueIfCustom = (value: PrimitiveType): string | undefined =>
        mapChartState.formatTooltipValueIfCustom(value)

    // Group series by name to handle cases where multiple series share the same name,
    // which can happen when projections are included alongside historical data
    const groupedSeries = R.groupBy(
        chartState.series,
        (series) => series.seriesName
    )

    const rows = Object.values(groupedSeries)
        .map((seriesList) => {
            // Pick the series with the latest time
            const series = R.firstBy(seriesList, [
                (series) => R.last(series.points)?.x ?? 0,
                "desc",
            ])

            // Pick the data point with the latest time
            const point = R.firstBy(series.points, [(point) => point.x, "desc"])
            if (!point) return undefined

            const color =
                getColorForSeriesIfFaceted(
                    grapherState,
                    series.entityName,
                    series.columnName
                ) ?? series.color

            return {
                series,
                point,
                name: series.seriesName,
                color,
                value:
                    formatValueIfCustom(point.y) ??
                    formatColumn.formatValueShort(point.y),
                time: formatColumn.formatTime(point.x),
                timePreposition: OwidTable.getPreposition(
                    chartState.transformedTable.timeColumn
                ),
                muted: series.focus.background,
                striped: series.isProjection,
            }
        })
        .filter((row) => row !== undefined)

    // Only show projected data points if there are any
    const hasProjectedData = rows.some((row) => row.series.isProjection)
    const filteredRows = hasProjectedData
        ? rows.filter((row) => row.series.isProjection)
        : rows

    // Sort by value in descending order
    const sortedRows = R.sortBy(filteredRows, (row) => -row.point.y)

    const displayRows =
        maxRows !== undefined ? sortedRows.slice(0, maxRows) : sortedRows

    const title = makeTableTitle(grapherState, chartState)

    return { type: "data-table", rows: displayRows, title }
}

function buildDataTablePropsForDiscreteBarChart({
    grapherState,
    chartState,
    maxRows,
}: Args<DiscreteBarChartState>): SearchChartHitDataTableProps {
    const formatColumn = grapherState.inputTable.get(grapherState.yColumnSlug)

    const rows = Object.values(chartState.series).map((series) => {
        const color = series.color

        return {
            series,
            name: series.shortEntityName ?? series.entityName,
            color,
            value: formatColumn.formatValueShort(series.value),
            time: formatColumn.formatTime(series.time),
            striped: series.yColumn.isProjection,
            muted: series.focus.background,
        }
    })

    const displayRows = maxRows !== undefined ? rows.slice(0, maxRows) : rows

    const title = makeTableTitle(grapherState, chartState)

    return { type: "data-table", rows: displayRows, title }
}

function buildDataTablePropsForSlopeChart({
    grapherState,
    chartState,
    maxRows,
}: Args<SlopeChartState>): SearchChartHitDataTableProps {
    const formatColumn = grapherState.inputTable.get(grapherState.yColumnSlug)

    const rows = Object.values(chartState.series)
        .map((series) => {
            const startValue = series.start.value
            const endValue = series.end.value

            const formattedStartTime = formatColumn.formatTime(
                series.start.originalTime
            )
            const formattedEndTime = formatColumn.formatTime(
                series.end.originalTime
            )

            const color =
                getColorForSeriesIfFaceted(
                    grapherState,
                    series.entityName,
                    series.column.nonEmptyDisplayName
                ) ?? series.color

            return {
                endValue: series.end.value,
                name: series.seriesName,
                color,
                value: formatColumn.formatValueShort(endValue),
                startValue: formatColumn.formatValueShort(startValue),
                trend: calculateTrendDirection(startValue, endValue),
                time: `${formattedStartTime}–${formattedEndTime}`,
                muted: series.focus.background,
            }
        })
        .filter((row) => row !== undefined)

    // Sort by value in descending order
    const sortedRows = R.sortBy(rows, (row) => -row.endValue)

    const displayRows =
        maxRows !== undefined ? sortedRows.slice(0, maxRows) : sortedRows

    const title = makeTableTitle(grapherState, chartState)

    return { type: "data-table", rows: displayRows, title }
}

function buildDataTablePropsForStackedDiscreteBarChart({
    grapherState,
    chartState,
    maxRows,
}: Args<StackedDiscreteBarChartState>): SearchChartHitDataTableProps {
    const formatColumn = grapherState.inputTable.get(grapherState.yColumnSlug)

    const mode =
        chartState.yColumnSlugs.length === 1
            ? "single-dimensional"
            : "multi-dimensional"

    const rows = match(mode)
        .with("single-dimensional", () => {
            const series = chartState.series[0]
            return series.points
                .map((point) => {
                    if (point.fake) return undefined
                    return {
                        name: point.position,
                        color: point.color ?? series.color,
                        value: formatColumn.formatValueShort(point.value),
                        time: formatColumn.formatTime(point.time),
                    }
                })
                .filter((row) => row !== undefined)
        })
        .with("multi-dimensional", () => {
            const entityName = grapherState.selection.selectedEntityNames[0]
            return chartState.series
                .map((series) => {
                    const point = series.points.find(
                        (point) => point.position === entityName
                    )
                    if (!point || point.fake) return undefined
                    return {
                        name: series.seriesName,
                        color: series.color,
                        value: formatColumn.formatValueShort(point.value),
                        time: formatColumn.formatTime(point.time),
                    }
                })
                .filter((row) => row !== undefined)
        })
        .exhaustive()

    const displayRows = maxRows !== undefined ? rows.slice(0, maxRows) : rows

    const title = match(mode)
        .with("single-dimensional", () => {
            const columnName = getColumnNameForDisplay(formatColumn)
            const unit = formatColumn.unit
            return unit ? `${columnName} (${unit})` : columnName
        })
        .with(
            "multi-dimensional",
            () => grapherState.selection.selectedEntityNames[0]
        )
        .exhaustive()

    return { type: "data-table", rows: displayRows, title }
}

function buildDataTablePropsForStackedAreaAndBarChart({
    grapherState,
    chartState,
    maxRows,
}: Args<
    StackedAreaChartState | StackedBarChartState
>): SearchChartHitDataTableProps {
    const formatColumn = grapherState.inputTable.get(grapherState.yColumnSlug)

    const rows = chartState.series
        .map((series) => {
            // Pick the data point with the latest time
            const point = R.firstBy(series.points, [
                (point) => point.time,
                "desc",
            ])
            if (!point) return undefined

            return {
                name: series.seriesName,
                color: point.color ?? series.color,
                value: formatColumn.formatValueShort(point.value),
                time: formatColumn.formatTime(point.time),
                muted: series.focus?.background,
                point,
            }
        })
        .filter((row) => row !== undefined)

    const sortedRows = R.reverse(rows)

    const displayRows =
        maxRows !== undefined ? sortedRows.slice(0, maxRows) : sortedRows

    const title = makeTableTitle(grapherState, chartState)

    return { type: "data-table", rows: displayRows, title }
}

function buildDataTablePropsForMarimekkoChart({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows,
}: Args<MarimekkoChartState>): SearchChartHitDataTableProps {
    return { type: "data-table", rows: [], title: "" }
}

function buildDataTablePropsForScatterPlot({
    grapherState,
    chartState,
    maxRows,
}: Args<ScatterPlotChartState>):
    | SearchChartHitDataTableProps
    | SearchChartHitDataPointsProps {
    // If exactly one entity is selected, then we display the x and y values
    // for that entity
    if (grapherState.selection.selectedEntityNames.length === 1) {
        const selectedEntity = grapherState.selection.selectedEntityNames[0]
        return buildDataPointsPropsForScatterPlot({
            grapherState,
            chartState,
            entityName: selectedEntity,
        })
    }

    // If the selection is empty and the scatter plot has a legend (which is the
    // case if it has a color dimension), then we display the legend
    if (grapherState.colorColumnSlug) {
        return buildLegendTablePropsForScatterPlot({
            grapherState,
            chartState,
            maxRows,
        })
    }

    // Special handling for two cases:
    // Case 1:
    //   The scatter plot has exactly one entity. In this case, displaying
    //   the x-and y-value of that entity in a large format is nicer than
    //   a single-row table.
    // Case 2:
    //   The scatter plot is connected and has more than one entity. In this
    //   case, we can't fit the start and end values for both dimensions into
    //   a single table row. That's why we simply display the x- and y-values
    //   of one of the entities.
    if (chartState.series.length === 1 || chartState.isConnected) {
        const firstEntity = chartState.series[0].seriesName
        return buildDataPointsPropsForScatterPlot({
            grapherState,
            chartState,
            entityName: firstEntity,
        })
    }

    // Display a table where each row corresponds to an entity and lists x and
    // y-values in this format: '<x-value> vs. <y-value>'.
    return buildValueTablePropsForScatterPlot({
        grapherState,
        chartState,
        maxRows,
    })
}

/** Creates a table where each row represents a legend bin from the color scale */
function buildLegendTablePropsForScatterPlot({
    grapherState,
    chartState,
    maxRows,
}: {
    grapherState: GrapherState
    chartState: ScatterPlotChartState
    maxRows?: number
}): SearchChartHitDataTableProps {
    const bins = chartState.colorScale.legendBins

    const rows = bins
        .map((bin) => {
            if (bin.isHidden || isNoDataBin(bin)) return undefined
            return { bin, name: bin.text, color: bin.color }
        })
        .filter((row) => row !== undefined)

    const filteredRows = maxRows !== undefined ? rows.slice(0, maxRows) : rows

    const title = grapherState.colorScale.legendDescription || "Legend"

    return { type: "data-table", rows: filteredRows, title }
}

/**
 * Creates a table where each row represents an entity in a scatter plot,
 * displaying both x and y values in a "y vs x" format for each entity.
 */
function buildValueTablePropsForScatterPlot({
    grapherState,
    chartState,
    maxRows,
}: {
    grapherState: GrapherState
    chartState: ScatterPlotChartState
    maxRows?: number
}): SearchChartHitDataTableProps {
    const { xColumn, yColumn } = chartState

    const yLabel = grapherState.yAxis.label || getColumnNameForDisplay(yColumn)
    const xLabel = grapherState.xAxis.label || getColumnNameForDisplay(xColumn)

    const rows = chartState.series.map((series) => {
        const yValue = yColumn.formatValueShortWithAbbreviations(
            series.points[0].y
        )
        const xValue = yColumn.formatValueShortWithAbbreviations(
            series.points[0].x
        )
        return {
            name: series.seriesName,
            color: series.color,
            value: `${yValue} vs ${xValue}`,
            time: yColumn.formatTime(series.points[0].timeValue),
        }
    })
    const displayRows = maxRows !== undefined ? rows.slice(0, maxRows) : rows

    const title = `${yLabel} vs. ${xLabel}`

    return { type: "data-table", rows: displayRows, title }
}

/**
 * Builds data points props for scatter plot charts, extracting x and y values
 * for a specific entity. For connected scatter plots, includes both start and
 * end values.
 */
function buildDataPointsPropsForScatterPlot({
    grapherState,
    chartState,
    entityName,
}: {
    grapherState: GrapherState
    chartState: ScatterPlotChartState
    entityName: string
}): SearchChartHitDataPointsProps {
    const { xColumn, yColumn } = chartState

    const yLabel = grapherState.yAxis.label || getColumnNameForDisplay(yColumn)
    const xLabel = grapherState.xAxis.label || getColumnNameForDisplay(xColumn)

    const series = chartState.series.find(
        (series) => series.seriesName === entityName
    )
    const points = series?.points ?? []
    const endPoint = R.firstBy(points, [(point) => point.timeValue, "desc"])!
    const startPoint = chartState.isConnected
        ? R.firstBy(points, [(point) => point.timeValue, "asc"])
        : undefined

    const formattedStartTime = startPoint
        ? yColumn.formatTime(startPoint.timeValue)
        : undefined
    const formattedEndTime = yColumn.formatTime(endPoint.timeValue)

    const time = formattedStartTime
        ? `${formattedStartTime}–${formattedEndTime}`
        : formattedEndTime

    const yDataPoint = {
        entityName,
        columnName: yLabel,
        unit: getColumnUnitForDisplay(yColumn),
        time,
        value: yColumn.formatValueShort(endPoint.y),
        startValue: startPoint
            ? yColumn.formatValueShort(startPoint.y)
            : undefined,
        trend: calculateTrendDirection(startPoint?.y, endPoint.y),
    }

    const xDataPoint = grapherState.xColumnSlug
        ? {
              entityName,
              columnName: xLabel,
              unit: getColumnUnitForDisplay(xColumn),
              time,
              value: xColumn.formatValueShort(endPoint.x),
              startValue: startPoint
                  ? xColumn.formatValueShort(startPoint.x)
                  : undefined,
              trend: calculateTrendDirection(startPoint?.x, endPoint.x),
          }
        : undefined

    const dataPoints = excludeUndefined([yDataPoint, xDataPoint])

    return { type: "data-points", dataPoints }
}

function buildDataTablePropsForWorldMap({
    grapherState,
    chartState,
    maxRows,
}: Args<MapChartState>): SearchChartHitDataTableProps {
    const bins = chartState.colorScale.legendBins

    const makeLabelForNumericBin = (bin: NumericBin): string => {
        if (bin.text) return bin.text
        if (bin.props.isOpenLeft) return `<${bin.maxText}`
        if (bin.props.isOpenRight) return `>${bin.minText}`
        return `${bin.minText}-${bin.maxText}`
    }

    const makeLabelForBin = (bin: ColorScaleBin): string =>
        isNumericBin(bin) ? makeLabelForNumericBin(bin) : bin.text

    // Number of countries per bin
    const numSeriesByBinLabel = new Map(
        bins.map((bin) => {
            const count = chartState.series.filter((series) => {
                return bin.contains(series.value)
            }).length
            return [makeLabelForBin(bin), count]
        })
    )

    // Find the number of countries with no data
    const noDataBin = bins.find((bin) => isNoDataBin(bin))
    if (noDataBin) {
        const numMappableCountries = mappableCountries.length
        const numSeriesWithNoData =
            numMappableCountries - chartState.series.length
        numSeriesByBinLabel.set(noDataBin.text, numSeriesWithNoData)
    }

    const hasNumericBins = bins.some((bin) => isNumericBin(bin))

    // The table shows a map legend where each row corresponds to a legend bin
    const rows = bins
        .map((bin) => {
            if (bin.isHidden) return undefined
            const name = makeLabelForBin(bin)
            return {
                bin,
                name,
                time: grapherState.endTime
                    ? chartState.mapColumn.formatTime(grapherState.endTime)
                    : undefined,
                color: bin.color,
                muted: !hasNumericBins && numSeriesByBinLabel.get(name) === 0,
                outlined: true,
                striped: isNoDataBin(bin) ? ("no-data" as const) : false,
            }
        })
        .filter((row) => row !== undefined)

    // Sort bins by the number of countries it contains, with No Data bin at the bottom
    const sortedRows = hasNumericBins
        ? rows
        : R.sortBy(rows, (row) =>
              isNoDataBin(row.bin)
                  ? Infinity // sort No Data bin to the bottom
                  : -(numSeriesByBinLabel.get(row.name) ?? 0)
          )

    const filteredRows =
        maxRows !== undefined ? sortedRows.slice(0, maxRows) : sortedRows

    const title = makeTableTitle(grapherState, chartState)

    return { type: "data-table", rows: filteredRows, title }
}

function buildDataTablePropsForTableTab({
    grapherState: _grapherState,
    maxRows: _maxRows,
}: BaseArgs): SearchChartHitDataTableProps {
    return { type: "data-table", rows: [], title: "" }
}

function makeTableTitle(
    grapherState: GrapherState,
    chartState: ChartState
): string {
    const { seriesStrategy = SeriesStrategy.entity } = chartState
    const isEntityStrategy = seriesStrategy === SeriesStrategy.entity
    const isFacetedByEntity =
        grapherState.facetStrategy === FacetStrategy.entity

    const formatColumn = grapherState.inputTable.get(grapherState.yColumnSlug)

    const columnName = getColumnNameForDisplay(formatColumn)
    const unit = formatColumn.unit

    if (hasMultipleSeriesPerFacet(grapherState)) {
        if (isFacetedByEntity) {
            return grapherState.selection.selectedEntityNames[0]
        } else {
            return unit ? `${columnName} (${unit})` : columnName
        }
    }

    if (isEntityStrategy) {
        return unit ? `In ${unit}` : columnName
    } else {
        return grapherState.selection.selectedEntityNames[0]
    }
}

function getColorForSeriesIfFaceted(
    grapherState: GrapherState,
    entityName: EntityName,
    columnName: string
): string | undefined {
    if (!grapherState.isFaceted || !grapherState.facetChartInstance)
        return undefined

    const { facetChartInstance } = grapherState

    const { facetName, seriesName } =
        grapherState.facetStrategy === FacetStrategy.entity
            ? { facetName: entityName, seriesName: columnName }
            : { facetName: columnName, seriesName: entityName }

    // Reset the persisted color map to make sure the data table
    // uses the same colors as the thumbnails
    facetChartInstance.seriesColorMap.clear()

    // Find the chart instance that renders the given series
    const facetSeriesIndex = facetChartInstance.series.findIndex(
        (s) => s.seriesName === facetName
    )

    if (facetSeriesIndex < 0) return undefined
    const chartInstance =
        facetChartInstance.intermediateChartInstances[facetSeriesIndex]

    const series = chartInstance?.chartState.series.find(
        (series) => series.seriesName === seriesName
    )

    return series?.color
}

function hasMultipleSeriesPerFacet(grapherState: GrapherState): boolean {
    return (
        grapherState.isFaceted &&
        grapherState.selection.numSelectedEntities > 1 &&
        grapherState.yColumnSlugs.length > 1
    )
}
