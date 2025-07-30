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
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_NAMES,
    PrimitiveType,
    SeriesName,
    SeriesStrategy,
} from "@ourworldindata/types"
import { SearchChartHitDataTableProps } from "./SearchChartHitDataTable"

interface BaseArgs {
    grapherState: GrapherState
    maxRows?: number
}

interface Args<State extends ChartState = ChartState> extends BaseArgs {
    chartState: State
}

export function buildChartHitDataTableProps(
    props: BaseArgs
): SearchChartHitDataTableProps {
    if (!chartState) return undefined

    return match(props.grapherState.activeTab)
        .with(GRAPHER_TAB_NAMES.LineChart, () =>
            buildDataTablePropsForLineChart({
                ...props,
                chartState: props.grapherState.chartState as LineChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.DiscreteBar, () =>
            buildDataTablePropsForDiscreteBarChart({
                ...props,
                chartState: props.grapherState
                    .chartState as DiscreteBarChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.ScatterPlot, () =>
            buildDataTablePropsForScatterPlot({
                ...props,
                chartState: props.grapherState
                    .chartState as ScatterPlotChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.StackedArea, () =>
            buildDataTablePropsForStackedAreaChart({
                ...props,
                chartState: props.grapherState
                    .chartState as StackedAreaChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.StackedDiscreteBar, () =>
            buildDataTablePropsForStackedDiscreteBarChart({
                ...props,
                chartState: props.grapherState
                    .chartState as StackedDiscreteBarChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.SlopeChart, () =>
            buildDataTablePropsForSlopeChart({
                ...props,
                chartState: props.grapherState.chartState as SlopeChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.StackedBar, () =>
            buildDataTablePropsForStackedBarChart({
                ...props,
                chartState: props.grapherState
                    .chartState as StackedBarChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.Marimekko, () =>
            buildDataTablePropsForMarimekkoChart({
                ...props,
                chartState: props.grapherState
                    .chartState as MarimekkoChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.WorldMap, () =>
            buildDataTablePropsForWorldMap({
                ...props,
                chartState: props.grapherState.chartState as MapChartState,
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
                getColorForSeriesIfFaceted(grapherState, series.seriesName) ??
                series.color

            return {
                name: series.seriesName,
                color,
                value:
                    formatValueIfCustom(point.y) ??
                    formatColumn.formatValueShort(point.y),
                time: formatColumn.formatTime(point.x),
                point,
                muted: series.focus.background,
                striped: series.isProjection,
            }
        })
        .filter((row) => row !== undefined)

    // Sort by value in descending order
    const sortedRows = R.sortBy(rows, (row) => -row.point.y)

    const displayRows =
        maxRows !== undefined ? sortedRows.slice(0, maxRows) : sortedRows

    const title = makeSeriesListTitle(grapherState, chartState)

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
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows,
}: Args<SlopeChartState>): SearchChartHitDataTableProps {
    return { rows: [], title: "" }
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

function makeSeriesListTitle(
    grapherState: GrapherState,
    chartState: ChartState
): string {
    const { seriesStrategy = SeriesStrategy.entity } = chartState
    const isEntityStrategy = seriesStrategy === SeriesStrategy.entity

    const formatColumn = grapherState.inputTable.get(grapherState.yColumnSlug)
    const unit =
        isEntityStrategy && // only show unit if entities are plotted
        formatColumn.unit &&
        formatColumn.shortUnit !== formatColumn.unit
            ? formatColumn.unit
            : undefined

    const title = isEntityStrategy
        ? (formatColumn.titlePublicOrDisplayName.title ??
          formatColumn.nonEmptyDisplayName)
        : grapherState.selection.selectedEntityNames[0]

    return unit ? `${title} (${unit})` : title
}

function getColorForSeriesIfFaceted(
    grapherState: GrapherState,
    seriesName: SeriesName
): string | undefined {
    if (!grapherState.isFaceted || !grapherState.facetChartInstance)
        return undefined

    const { facetChartInstance } = grapherState

    // Reset the persisted color map to make sure the data table
    // uses the same colors as the thumbnails
    facetChartInstance.seriesColorMap.clear()

    // Find the chart instance that renders the given series
    const facetSeriesIndex = facetChartInstance.series.findIndex(
        (s) => s.seriesName === seriesName
    )
    if (facetSeriesIndex < 0) return undefined
    const chartInstance =
        facetChartInstance.intermediateChartInstances[facetSeriesIndex]

    // Typically, there is only one series per facet. There might be two if
    // the chart has projected data, but in that case, the historical and
    // projected line typically share the same color.
    const series = chartInstance?.chartState.series[0]

    return series?.color
}
