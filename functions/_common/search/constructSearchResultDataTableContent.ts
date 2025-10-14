import * as _ from "lodash-es"
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
import { calculateTrendDirection, getDisplayUnit } from "@ourworldindata/utils"
import {
    EntityName,
    FacetStrategy,
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_NAMES,
    PrimitiveType,
    SearchChartHitDataTableProps,
    SeriesStrategy,
} from "@ourworldindata/types"
import { CoreColumn, OwidTable, TimeColumn } from "@ourworldindata/core-table"

interface BaseArgs {
    grapherState: GrapherState
    maxRows?: number
}

interface Args<State extends ChartState = ChartState> extends BaseArgs {
    chartState: State
}

export function constructSearchResultDataTableContent(
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
            buildDataTableContentForLineChart({
                ...props,
                chartState: chartState as LineChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.DiscreteBar, () =>
            buildDataTableContentForDiscreteBarChart({
                ...props,
                chartState: chartState as DiscreteBarChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.ScatterPlot, () =>
            buildDataTableContentForScatterPlot({
                ...props,
                chartState: chartState as ScatterPlotChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.StackedArea, () =>
            buildDataTableContentForStackedAreaAndBarChart({
                ...props,
                chartState: chartState as StackedAreaChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.StackedDiscreteBar, () =>
            buildDataTableContentForStackedDiscreteBarChart({
                ...props,
                chartState: chartState as StackedDiscreteBarChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.SlopeChart, () =>
            buildDataTableContentForSlopeChart({
                ...props,
                chartState: chartState as SlopeChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.StackedBar, () =>
            buildDataTableContentForStackedAreaAndBarChart({
                ...props,
                chartState: chartState as StackedBarChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.Marimekko, () =>
            buildDataTableContentForMarimekkoChart({
                ...props,
                chartState: chartState as MarimekkoChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.WorldMap, () =>
            buildDataTableContentForWorldMap({
                ...props,
                chartState: chartState as MapChartState,
            })
        )
        .with(GRAPHER_TAB_NAMES.Table, () =>
            buildDataTableContentForTableTab(props)
        )
        .exhaustive()
}

function buildDataTableContentForLineChart({
    grapherState,
    chartState,
    maxRows,
}: Args<LineChartState>): SearchChartHitDataTableProps {
    const formatColumn = chartState.formatColumn

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
    const groupedSeries = _.groupBy(
        chartState.series,
        (series) => series.seriesName
    )

    let rows = Object.values(groupedSeries)
        .map((seriesList) => {
            // Pick the series with the latest time
            const series = _.maxBy(
                seriesList,
                (series) => _.last(series.points)?.x ?? 0
            )

            // Pick the data point with the latest time
            const point = _.maxBy(series.points, (point) => point.x)
            if (!point) return undefined

            const color =
                getColorForSeriesIfFaceted(
                    grapherState,
                    series.entityName,
                    series.columnName
                ) ?? series.color

            // If the x-axis (that is usually time) has a label,
            // we append it to the time string in parentheses
            const xAxisLabel = grapherState.xAxis.label
            const time = appendInParens(
                formatColumn.formatTime(point.x),
                xAxisLabel
            )
            const timePreposition = !xAxisLabel
                ? OwidTable.getPreposition(
                      chartState.transformedTable.timeColumn
                  )
                : ""

            return {
                series,
                point,
                seriesName: series.seriesName,
                label: series.displayName,
                color,
                value:
                    formatValueIfCustom(point.y) ??
                    formatColumn.formatValueShort(point.y),
                time,
                timePreposition,
                muted: series.focus.background,
                striped: series.isProjection,
            }
        })
        .filter((row) => row !== undefined)

    // Only show projected data points if there are any
    const hasProjectedData = rows.some((row) => row.series.isProjection)
    if (hasProjectedData) rows = rows.filter((row) => row.series.isProjection)

    // Take the first X rows if maxRows is specified
    if (maxRows > 0) rows = _.take(rows, maxRows)

    // Sort by value in descending order
    rows = _.orderBy(rows, [(row) => row.point.y], "desc")

    return {
        rows: rows.map((row) => _.omit(row, ["series", "point"])),
        title: makeTableTitle(grapherState, chartState, formatColumn),
    }
}

function buildDataTableContentForDiscreteBarChart({
    grapherState,
    chartState,
    maxRows,
}: Args<DiscreteBarChartState>): SearchChartHitDataTableProps {
    const formatColumn = chartState.formatColumn

    let rows = chartState.series.map((series) => ({
        series,
        seriesName: series.seriesName,
        label: series.shortEntityName ?? series.entityName,
        color: series.color,
        value: formatColumn.formatValueShort(series.value),
        time: formatColumn.formatTime(series.time),
        striped: series.yColumn.isProjection,
        muted: series.focus.background,
    }))

    // Take the first X rows if maxRows is specified
    if (maxRows > 0) rows = _.take(rows, maxRows)

    return {
        rows: rows.map((row) => _.omit(row, ["series"])),
        title: makeTableTitle(grapherState, chartState, formatColumn),
    }
}

function buildDataTableContentForSlopeChart({
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
            seriesName: series.seriesName,
            label: series.displayName,
            endValue: series.end.value,
            color,
            value: formatColumn.formatValueShort(end.value),
            startValue: formatColumn.formatValueShort(start.value),
            trend: calculateTrendDirection(start.value, end.value),
            time: `${formattedStartTime}–${formattedEndTime}`,
            timePreposition: "",
            muted: series.focus.background,
        }
    })

    // Take the first X rows if maxRows is specified
    if (maxRows > 0) rows = _.take(rows, maxRows)

    // Sort by value in descending order
    rows = _.orderBy(rows, [(row) => row.endValue], "desc")

    const title = makeTableTitle(grapherState, chartState, formatColumn)

    return { rows, title }
}

function buildDataTableContentForStackedDiscreteBarChart({
    grapherState,
    chartState,
    maxRows,
}: Args<StackedDiscreteBarChartState>): SearchChartHitDataTableProps {
    const formatColumn = chartState.formatColumn

    const mode =
        chartState.yColumnSlugs.length === 1
            ? "single-dimensional"
            : "multi-dimensional"

    const { rows, title } = match(mode)
        // In single-dimensional mode, each row represents an entity
        .with("single-dimensional", () => {
            const series = chartState.series[0]

            let rows = series.points
                .map((point) => {
                    if (point.fake || point.interpolated) return undefined
                    return {
                        point,
                        seriesName: series.seriesName,
                        label: point.position,
                        color: point.color ?? series.color,
                        value: formatColumn.formatValueShort(point.value),
                        time: formatColumn.formatTime(point.time),
                        timePreposition: OwidTable.getPreposition(
                            chartState.transformedTable.timeColumn
                        ),
                    }
                })
                .filter((row) => row !== undefined)

            // Take the first X rows if maxRows is specified
            if (maxRows > 0) rows = _.take(rows, maxRows)

            rows = _.orderBy(rows, [(row) => row.point.value], ["desc"])

            const columnName = getColumnNameForDisplay(formatColumn)
            const unit = getDisplayUnit(formatColumn)
            const title = unit ? `${columnName} (${unit})` : columnName

            return {
                rows: rows.map((row) => _.omit(row, ["point"])),
                title,
            }
        })

        // In multi-dimensional mode, each row represents a column (for the same entity)
        .with("multi-dimensional", () => {
            // Find the entity to display data for. Prefer focused entities,
            // otherwise use the first entity in the chart.
            const focusedEntityName = grapherState.focusArray.seriesNames[0]
            const focusedItem = focusedEntityName
                ? chartState.sortedItems.find(
                      (item) => item.entityName === focusedEntityName
                  )
                : undefined
            const item = focusedItem ?? chartState.sortedItems[0]

            type TableRow = SearchChartHitDataTableProps["rows"][number] & {
                columnSlug: string
                sortValue?: number
            }

            let rows: TableRow[] = item?.bars
                .map((bar) => {
                    const point = bar.point
                    if (point.fake || point.interpolated) return undefined
                    return {
                        seriesName: bar.seriesName,
                        label: bar.seriesName,
                        sortValue: point.value,
                        columnSlug: bar.columnSlug,
                        color: bar.color,
                        value: formatColumn.formatValueShort(point.value),
                        time: formatColumn.formatTime(point.time),
                        timePreposition: OwidTable.getPreposition(
                            chartState.transformedTable.timeColumn
                        ),
                    }
                })
                .filter((row) => row !== undefined)

            // Sort by value in descending order
            rows = _.orderBy(rows, [(row) => row.sortValue ?? 0], "desc")

            // If the current entity doesn't have data for some of the columns,
            // we manually add those to the data table with a 'No data' label.
            // This is necessary because the data table serves as color legend,
            // and otherwise some colors in the chart wouldn't be explained.
            if (rows.length < chartState.yColumnSlugs.length) {
                const existingSlugs = new Set(
                    rows.map((row) => row.columnSlug) ?? []
                )
                const missingSlugs = chartState.yColumnSlugs.filter(
                    (slug) => !existingSlugs.has(slug)
                )

                rows.push(
                    ...missingSlugs.map((slug) => {
                        const column = chartState.transformedTable.get(slug)
                        return {
                            columnSlug: slug,
                            label: column.displayName,
                            color: chartState.categoricalColorAssigner.assign(
                                column.displayName
                            ),
                            value: "No data",
                        }
                    })
                )
            }

            // Take the first X rows if maxRows is specified
            if (maxRows > 0) rows = _.take(rows, maxRows)

            return {
                rows: rows.map((row) =>
                    _.omit(row, ["columnSlug", "sortValue"])
                ),
                title: item.entityName,
            }
        })
        .exhaustive()

    return { rows, title }
}

function buildDataTableContentForStackedAreaAndBarChart({
    grapherState,
    chartState,
    maxRows,
}: Args<
    StackedAreaChartState | StackedBarChartState
>): SearchChartHitDataTableProps {
    const formatColumn = chartState.formatColumn

    const hasSingleSeriesPerFacet =
        grapherState.isFaceted && !grapherState.hasMultipleSeriesPerFacet
    let rows = chartState.series
        .map((series) => {
            // Pick the data point at the latest time
            const point = _.maxBy(series.points, (point) => point.time)
            if (!point) return undefined

            // Hacky way to fix a bug where `useValueBasedColorScheme` isn't
            // respected when faceted and the color swatches in the table don't
            // match the chart colors
            const color = hasSingleSeriesPerFacet
                ? undefined // Don't show a color swatch in the table
                : (point.color ?? series.color)

            // If the x-axis (that is usually time) has a label,
            // we append it to the time string in parentheses
            const xAxisLabel = grapherState.xAxis.label
            const time = appendInParens(
                formatColumn.formatTime(point.time),
                xAxisLabel
            )
            const timePreposition = !xAxisLabel
                ? OwidTable.getPreposition(
                      chartState.transformedTable.timeColumn
                  )
                : ""

            return {
                seriesName: series.seriesName,
                label: series.seriesName,
                color,
                value: formatColumn.formatValueShort(point.value),
                time,
                timePreposition,
                muted: series.focus?.background,
                point,
            }
        })
        .filter((row) => row !== undefined)

    // Take the first X rows if maxRows is specified
    if (maxRows > 0) rows = _.take(rows, maxRows)

    // Stacked area charts plot series from bottom to top and reverse the
    // original order, so that the first selected series appears on top.
    // We reverse the order again here, so that the first selected entity
    // (which is on top of the chart) is also on top of the table.
    rows = _.reverse(rows)

    const title = makeTableTitle(grapherState, chartState, formatColumn)

    return { rows: rows.map((row) => _.omit(row, ["point"])), title }
}

function buildDataTableContentForMarimekkoChart({
    grapherState,
    chartState,
    maxRows,
}: Args<MarimekkoChartState>): SearchChartHitDataTableProps {
    const formatColumn = chartState.formatColumn
    const series = chartState.series[0]

    let points = series.points
    if (chartState.selectionArray.selectedSet.size > 0) {
        points = points.filter((point) =>
            chartState.selectionArray.selectedSet.has(point.position)
        )
    }

    let rows = points
        .map((point) => {
            const entityColor = chartState.domainColorForEntityMap.get(
                point.position
            )
            return {
                point,
                seriesName: series.seriesName,
                label: point.position,
                color: entityColor?.color ?? point.color ?? series.color,
                value: formatColumn.formatValueShort(point.value),
                time: formatColumn.formatTime(point.time),
                timePreposition: OwidTable.getPreposition(
                    chartState.transformedTable.timeColumn
                ),
                muted: chartState.focusArray.state(point.position).background,
            }
        })
        .filter((row) => row !== undefined)

    // Take the first X rows if maxRows is specified
    if (maxRows > 0) rows = _.take(rows, maxRows)

    // Sort by value in descending order
    rows = _.orderBy(rows, [(row) => row.point.value], "desc")

    return {
        rows: rows.map((row) => _.omit(row, ["point"])),
        title: makeTableTitle(grapherState, chartState, formatColumn),
    }
}

function buildDataTableContentForScatterPlot({
    grapherState: _grapherState,
    chartState,
    maxRows,
}: Args<ScatterPlotChartState>): SearchChartHitDataTableProps {
    const { xColumn, yColumn } = chartState

    const yLabel =
        chartState.verticalAxisLabel || getColumnNameForDisplay(yColumn)
    const xLabel =
        chartState.horizontalAxisLabel || getColumnNameForDisplay(xColumn)

    let series = chartState.series
    if (chartState.selectionArray.selectedSet.size > 0)
        series = series.filter((series) =>
            chartState.selectionArray.selectedSet.has(series.seriesName)
        )

    const isTimeScatter = xColumn instanceof TimeColumn

    let rows = series
        .map((series) => {
            const point = _.maxBy(series.points, (point) => point.timeValue)
            if (!point) return undefined
            const yValue = yColumn.formatValueShort(point.y)
            const xValue = xColumn.formatValueShort(point.x)
            const value = isTimeScatter ? yValue : xValue
            const startValue = !isTimeScatter ? yValue : undefined
            return {
                seriesName: series.seriesName,
                label: series.seriesName,
                color: series.color,
                startValue,
                value,
                time: yColumn.formatTime(point.timeValue),
                timePreposition: OwidTable.getPreposition(
                    chartState.transformedTable.timeColumn
                ),
                yValue: point.y,
                rounded: true,
                muted: chartState.focusArray.state(series.seriesName)
                    .background,
            }
        })
        .filter((row) => row !== undefined)

    // Take the first X rows if maxRows is specified
    if (maxRows > 0) rows = _.take(rows, maxRows)

    // Sort by y-value in descending order
    rows = _.orderBy(rows, [(row) => row.yValue, "desc"])

    const title = isTimeScatter ? yLabel : `${yLabel} vs. ${xLabel}`

    return {
        rows: rows.map((row) => _.omit(row, ["yValue"])),
        title,
    }
}

function buildDataTableContentForWorldMap({
    grapherState,
    chartState,
    maxRows,
}: Args<MapChartState>): SearchChartHitDataTableProps {
    const formatColumn = chartState.mapColumn
    const bins = chartState.colorScale.legendBins

    // The table shows a map legend where each row corresponds to a legend bin
    let rows = bins
        .map((bin) => {
            if (bin.isHidden) return undefined
            const label = makeLabelForBin(bin)
            const numSeriesContainedInBin = chartState.series.filter((series) =>
                bin.contains(series.value)
            ).length
            return {
                bin,
                numSeriesContainedInBin,
                label,
                time: grapherState.endTime
                    ? formatColumn.formatTime(grapherState.endTime)
                    : undefined,
                color: bin.color,
                muted: !isNoDataBin(bin) && numSeriesContainedInBin === 0,
                outlined: true,
                striped: isNoDataBin(bin) ? ("no-data" as const) : false,
            }
        })
        .filter((row) => row !== undefined)

    // Take the first X rows if maxRows is specified
    if (maxRows > 0) rows = _.take(rows, maxRows)

    // Sort bins by the number of countries it contains, with the No Data bin at the bottom
    const hasNumericBins = bins.some((bin) => isNumericBin(bin))
    if (!hasNumericBins) {
        rows = _.orderBy(
            rows,
            (row) =>
                isNoDataBin(row.bin)
                    ? -Infinity // sort No Data bin to the bottom
                    : row.numSeriesContainedInBin,
            "desc"
        )
    }

    return {
        rows: rows.map((row) =>
            _.omit(row, ["bin", "numSeriesContainedInBin"])
        ),
        title: makeTableTitle(grapherState, chartState, formatColumn),
    }
}

// Only used to build a data table when Grapher has neither a chart
// nor a map tab which should never (or very rarely) happen
function buildDataTableContentForTableTab({
    grapherState,
    maxRows,
}: BaseArgs): SearchChartHitDataTableProps {
    const yColumn = grapherState.tableForDisplay.get(grapherState.yColumnSlug)
    const columnName = getColumnNameForDisplay(yColumn)
    const unit = getDisplayUnit(yColumn, { allowTrivial: true })
    const title = unit ? `In ${unit}` : columnName

    const time = grapherState.endTime ?? grapherState.tableForDisplay.maxTime

    if (!time) return { rows: [], title }

    let owidRows = grapherState.tableForDisplay
        .filterByTargetTimes([time])
        .get(grapherState.yColumnSlug).owidRows
    owidRows = _.orderBy(owidRows, [(row) => row.value], "desc")

    let tableRows = owidRows.map((row) => ({
        label: row.entityName,
        time: yColumn.formatTime(row.originalTime),
        timePreposition: OwidTable.getPreposition(
            grapherState.transformedTable.timeColumn
        ),
        value: yColumn.formatValueShort(row.value),
    }))

    // Take the first X rows if maxRows is specified
    if (maxRows > 0) tableRows = _.take(tableRows, maxRows)

    return { rows: tableRows, title }
}

function makeTableTitle(
    grapherState: GrapherState,
    chartState: ChartState,
    formatColumn: CoreColumn
): string {
    const { seriesStrategy = SeriesStrategy.entity } = chartState
    const isEntityStrategy = seriesStrategy === SeriesStrategy.entity
    const isFacetedByEntity =
        grapherState.facetStrategy === FacetStrategy.entity

    const columnName = getColumnNameForDisplay(formatColumn)
    const unit = getDisplayUnit(formatColumn, { allowTrivial: true })

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
        (series) => series.seriesName === facetName
    )

    if (facetSeriesIndex < 0) return undefined
    const chartInstance =
        facetChartInstance.intermediateChartInstances[facetSeriesIndex]

    const series = chartInstance?.chartState.series.find(
        (series) => series.seriesName === seriesName
    )

    return series?.color
}

function appendInParens(text: string, parenthetical?: string): string {
    return parenthetical ? `${text} (${parenthetical})` : text
}

const makeLabelForNumericBin = (bin: NumericBin): string => {
    if (bin.text) return bin.text
    if (bin.props.isOpenLeft) return `<${bin.maxText}`
    if (bin.props.isOpenRight) return `>${bin.minText}`
    return `${bin.minText}-${bin.maxText}`
}

const makeLabelForBin = (bin: ColorScaleBin): string =>
    isNumericBin(bin) ? makeLabelForNumericBin(bin) : bin.text

function getColumnNameForDisplay(column: CoreColumn): string {
    return column.titlePublicOrDisplayName.title ?? column.nonEmptyDisplayName
}
