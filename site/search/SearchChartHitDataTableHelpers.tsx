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
import { mappableCountries } from "@ourworldindata/utils"
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
): SearchChartHitDataTableProps {
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
    const sortedRows = R.sortBy(filteredRows, (row) => -row.point.y)

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

    return { rows: displayRows, title }
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

    return { rows: filteredRows, title }
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
