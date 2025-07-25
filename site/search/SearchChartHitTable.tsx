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
    SeriesStrategy,
} from "@ourworldindata/types"
import { SearchChartHitTableContent } from "./SearchChartHitTableContent"

interface BaseSearchChartHitTableProps {
    grapherState: GrapherState
    maxRows: number
}

interface SearchChartHitTableProps<State extends ChartState = ChartState>
    extends BaseSearchChartHitTableProps {
    chartState: State
}

export function SearchChartHitTable(
    props: BaseSearchChartHitTableProps
): React.ReactElement | null {
    return (
        <div className="search-chart-hit-table">
            {match(props.grapherState.activeTab)
                .with(GRAPHER_TAB_NAMES.LineChart, () => (
                    <LineChartTable
                        {...props}
                        chartState={
                            props.grapherState.chartState as LineChartState
                        }
                    />
                ))
                .with(GRAPHER_TAB_NAMES.DiscreteBar, () => (
                    <DiscreteBarChartTable
                        {...props}
                        chartState={
                            props.grapherState
                                .chartState as DiscreteBarChartState
                        }
                    />
                ))
                .with(GRAPHER_TAB_NAMES.ScatterPlot, () => (
                    <ScatterPlotTable
                        {...props}
                        chartState={
                            props.grapherState
                                .chartState as ScatterPlotChartState
                        }
                    />
                ))
                .with(GRAPHER_TAB_NAMES.StackedArea, () => (
                    <StackedAreaTable
                        {...props}
                        chartState={
                            props.grapherState
                                .chartState as StackedAreaChartState
                        }
                    />
                ))
                .with(GRAPHER_TAB_NAMES.StackedDiscreteBar, () => (
                    <StackedDiscreteBarTable
                        {...props}
                        chartState={
                            props.grapherState
                                .chartState as StackedDiscreteBarChartState
                        }
                    />
                ))
                .with(GRAPHER_TAB_NAMES.SlopeChart, () => (
                    <SlopeChartTable
                        {...props}
                        chartState={
                            props.grapherState.chartState as SlopeChartState
                        }
                    />
                ))
                .with(GRAPHER_TAB_NAMES.StackedBar, () => (
                    <StackedBarTable
                        {...props}
                        chartState={
                            props.grapherState
                                .chartState as StackedBarChartState
                        }
                    />
                ))
                .with(GRAPHER_TAB_NAMES.Marimekko, () => (
                    <MarimekkoTable
                        {...props}
                        chartState={
                            props.grapherState.chartState as MarimekkoChartState
                        }
                    />
                ))
                .with(GRAPHER_TAB_NAMES.WorldMap, () => (
                    <MapTable
                        {...props}
                        chartState={
                            props.grapherState.chartState as MapChartState
                        }
                    />
                ))
                .with(GRAPHER_TAB_NAMES.Table, () => null)
                .exhaustive()}
        </div>
    )
}

function LineChartTable({
    grapherState,
    chartState,
    maxRows = 4,
}: SearchChartHitTableProps<LineChartState>): React.ReactElement | null {
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
    const rows = chartState.series
        .map((series) => {
            if (series.isProjection) return undefined
            const point = R.last(series.points ?? [])
            if (!point) return undefined
            return {
                name: series.seriesName,
                color: series.color,
                value:
                    formatValueIfCustom(point.y) ??
                    formatColumn.formatValueShort(point.y),
                time: formatColumn.formatTime(point.x),
                point,
                muted: series.focus.background,
            }
        })
        .filter((row) => row !== undefined)

    // Only happens when no entities are selected, which should never be the case
    if (rows.length === 0) return null

    // Sort by value in descending order
    const sortedRows = R.sortBy(rows, (row) => -row.point.y).slice(0, maxRows)

    // Only show the time in the title if all items refer to the same time
    const shouldShowTimeInTitle =
        rows[0].time !== undefined &&
        rows.every((row) => row.time === rows[0].time)
    const time = shouldShowTimeInTitle ? rows[0].time : undefined

    // Hide the time in each row if it's shown in the title
    const displayRows = shouldShowTimeInTitle
        ? sortedRows.map((item) => R.omit(item, ["time"]))
        : sortedRows

    const title = makeSeriesListTitle(grapherState, chartState)

    return (
        <SearchChartHitTableContent
            rows={displayRows}
            title={title}
            time={time}
        />
    )
}

function DiscreteBarChartTable({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows = 4,
}: SearchChartHitTableProps<DiscreteBarChartState>): React.ReactElement {
    return <></>
}

function ScatterPlotTable({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows = 4,
}: SearchChartHitTableProps<ScatterPlotChartState>): React.ReactElement {
    return <></>
}

function StackedAreaTable({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows = 4,
}: SearchChartHitTableProps<StackedAreaChartState>): React.ReactElement {
    return <></>
}

function StackedDiscreteBarTable({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows = 4,
}: SearchChartHitTableProps<StackedDiscreteBarChartState>): React.ReactElement {
    return <></>
}

function SlopeChartTable({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows = 4,
}: SearchChartHitTableProps<SlopeChartState>): React.ReactElement {
    return <></>
}

function StackedBarTable({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows = 4,
}: SearchChartHitTableProps<StackedBarChartState>): React.ReactElement {
    return <></>
}

function MarimekkoTable({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows = 4,
}: SearchChartHitTableProps<MarimekkoChartState>): React.ReactElement {
    return <></>
}

function MapTable({
    grapherState: _grapherState,
    chartState: _chartState,
    maxRows: _maxRows = 4,
}: SearchChartHitTableProps<MapChartState>): React.ReactElement {
    return <></>
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
