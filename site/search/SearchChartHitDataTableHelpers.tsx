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
} from "@ourworldindata/grapher"
import {
    EntityName,
    FacetStrategy,
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_NAMES,
    PrimitiveType,
    SeriesStrategy,
} from "@ourworldindata/types"
import { SearchChartHitDataTableProps } from "./SearchChartHitDataTable"
import {
    getColumnNameForDisplay,
    getColumnUnitForDisplay,
    calculateTrendDirection,
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
): SearchChartHitDataTableProps | undefined {
    if (!props.grapherState.isReady) return undefined

    // If the chart is faceted and displays multiple series per facet
    // (i.e. multiple entities + multiple columns), we only show data from
    // the first facet in the data table
    const chartState = props.grapherState.hasMultipleSeriesPerFacet
        ? props.grapherState.facetChartInstance?.intermediateChartInstances[0]
              ?.chartState
        : props.grapherState.chartState

    if (!chartState) return undefined

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
            buildDataTablePropsForStackedAreaChart({
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
            buildDataTablePropsForStackedBarChart({
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
    const sortedRows = R.sortBy(filteredRows, [(row) => row.point.y, "desc"])

    const displayRows =
        maxRows !== undefined ? sortedRows.slice(0, maxRows) : sortedRows

    const title = makeTableTitle(grapherState, chartState)

    return { rows: displayRows, title }
}

function buildDataTablePropsForDiscreteBarChart({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows,
}: Args<DiscreteBarChartState>): SearchChartHitDataTableProps {
    return { rows: [], title: "" }
}

function buildDataTablePropsForSlopeChart({
    grapherState,
    chartState,
    maxRows,
}: Args<SlopeChartState>): SearchChartHitDataTableProps {
    const formatColumn = chartState.formatColumn

    let rows = chartState.series.map((series) => {
        const { start, end } = series

        const formattedStartTime = formatColumn.formatTime(start.originalTime)
        const formattedEndTime = formatColumn.formatTime(end.originalTime)

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
            value: formatColumn.formatValueShort(end.value),
            startValue: formatColumn.formatValueShort(start.value),
            trend: calculateTrendDirection(start.value, end.value),
            time: `${formattedStartTime}–${formattedEndTime}`,
            timePreposition: "",
            muted: series.focus.background,
        }
    })

    // Sort by value in descending order
    rows = R.sortBy(rows, [(row) => row.endValue, "desc"])

    if (maxRows !== undefined) rows = rows.slice(0, maxRows)

    const title = makeTableTitle(grapherState, chartState)

    return { rows, title }
}

function buildDataTablePropsForStackedDiscreteBarChart({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows,
}: Args<StackedDiscreteBarChartState>): SearchChartHitDataTableProps {
    return { rows: [], title: "" }
}

function buildDataTablePropsForStackedBarChart({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows,
}: Args<StackedBarChartState>): SearchChartHitDataTableProps {
    return { rows: [], title: "" }
}

function buildDataTablePropsForStackedAreaChart({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows,
}: Args<StackedAreaChartState>): SearchChartHitDataTableProps {
    return { rows: [], title: "" }
}

function buildDataTablePropsForMarimekkoChart({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows,
}: Args<MarimekkoChartState>): SearchChartHitDataTableProps {
    return { rows: [], title: "" }
}

function buildDataTablePropsForScatterPlot({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows,
}: Args<ScatterPlotChartState>): SearchChartHitDataTableProps {
    return { rows: [], title: "" }
}

function buildDataTablePropsForWorldMap({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows,
}: Args<MapChartState>): SearchChartHitDataTableProps {
    return { rows: [], title: "" }
}

function buildDataTablePropsForTableTab({
    grapherState: _grapherState,
    maxRows: _maxRows,
}: BaseArgs): SearchChartHitDataTableProps {
    return { rows: [], title: "" }
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
    const unit = getColumnUnitForDisplay(formatColumn, { allowTrivial: true })

    if (grapherState.hasMultipleSeriesPerFacet) {
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
