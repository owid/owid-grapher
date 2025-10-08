import * as _ from "lodash-es"
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
    WORLD_ENTITY_NAME,
    fetchInputTableForConfig,
} from "@ourworldindata/grapher"
import {
    excludeUndefined,
    getAggregates,
    getContinents,
    getIncomeGroups,
} from "@ourworldindata/utils"
import {
    DimensionProperty,
    EntityName,
    FacetStrategy,
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_NAMES,
    GrapherTrendArrowDirection,
    PrimitiveType,
    SearchChartHitDataTableContent,
    SearchChartHitDataTableProps,
    SeriesStrategy,
} from "@ourworldindata/types"
import { CoreColumn, OwidTable, TimeColumn } from "@ourworldindata/core-table"

// Population variable ID used to fetch latest population data for entities.
// This data helps determine which entities to display in Scatter plots and
// Marimekko charts when no specific selection is made
const POPULATION_VARIABLE_ID = 953903 // "Population (historical) (various sources, 2024-07-15)"

interface BaseArgs {
    grapherState: GrapherState
    dataApiUrl?: string
}

interface Args<State extends ChartState = ChartState> extends BaseArgs {
    chartState: State
}

export function constructSearchResultTable(
    props: BaseArgs
): SearchChartHitDataTableContent | undefined {
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
}: Args<LineChartState>): SearchChartHitDataTableContent {
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

    // Sort by value in descending order
    rows = _.orderBy(rows, [(row) => row.point.y], "desc")

    return {
        type: "data-table",
        props: {
            rows: rows.map((row) => _.omit(row, ["series", "point"])),
            title: makeTableTitle(grapherState, chartState, formatColumn),
        },
    }
}

function buildDataTableContentForDiscreteBarChart({
    grapherState,
    chartState,
}: Args<DiscreteBarChartState>): SearchChartHitDataTableContent {
    const formatColumn = chartState.formatColumn

    const rows = chartState.series.map((series) => ({
        series,
        seriesName: series.seriesName,
        label: series.shortEntityName ?? series.entityName,
        color: series.color,
        value: formatColumn.formatValueShort(series.value),
        time: formatColumn.formatTime(series.time),
        striped: series.yColumn.isProjection,
        muted: series.focus.background,
    }))

    return {
        type: "data-table",
        props: {
            rows: rows.map((row) => _.omit(row, ["series"])),
            title: makeTableTitle(grapherState, chartState, formatColumn),
        },
    }
}

function buildDataTableContentForSlopeChart({
    grapherState,
    chartState,
}: Args<SlopeChartState>): SearchChartHitDataTableContent {
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

    // Sort by value in descending order
    rows = _.orderBy(rows, [(row) => row.endValue], "desc")

    const title = makeTableTitle(grapherState, chartState, formatColumn)

    return { type: "data-table", props: { rows, title } }
}

function buildDataTableContentForStackedDiscreteBarChart({
    grapherState,
    chartState,
}: Args<StackedDiscreteBarChartState>): SearchChartHitDataTableContent {
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

            rows = _.orderBy(rows, [(row) => row.point.value], ["desc"])

            const columnName = getColumnNameForDisplay(formatColumn)
            const unit = getColumnUnitForDisplay(formatColumn)
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

            return {
                rows: rows.map((row) =>
                    _.omit(row, ["columnSlug", "sortValue"])
                ),
                title: item.entityName,
            }
        })
        .exhaustive()

    return { type: "data-table", props: { rows, title } }
}

function buildDataTableContentForStackedAreaAndBarChart({
    grapherState,
    chartState,
}: Args<
    StackedAreaChartState | StackedBarChartState
>): SearchChartHitDataTableContent {
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

    // Stacked area charts plot series from bottom to top and reverse the
    // original order, so that the first selected series appears on top.
    // We reverse the order again here, so that the first selected entity
    // (which is on top of the chart) is also on top of the table.
    rows = _.reverse(rows)

    const title = makeTableTitle(grapherState, chartState, formatColumn)

    return { type: "data-table", props: { rows, title } }
}

async function buildDataTableContentForMarimekkoChart({
    grapherState,
    chartState,
    dataApiUrl,
}: Args<MarimekkoChartState>): Promise<SearchChartHitDataTableContent> {
    const selectedEntities = grapherState.selection.selectedEntityNames

    // If one or two entities are selected, then display the x and y values for those entities
    if (selectedEntities.length > 0 && selectedEntities.length <= 2) {
        return buildDataPointsContentForMarimekko({
            grapherState,
            chartState,
            entityNames: selectedEntities,
        })
    }

    // Display a table where each row corresponds to an entity
    return buildValueTableContentForMarimekko({
        grapherState,
        chartState,
        dataApiUrl,
    })
}

/**
 * Builds data points props for Marimekko charts, extracting the values for
 * specific entities
 */
function buildDataPointsContentForMarimekko({
    grapherState,
    chartState,
    entityNames,
}: {
    grapherState: GrapherState
    chartState: MarimekkoChartState
    entityNames: EntityName[]
}): SearchChartHitDataTableContent {
    // Marimekko charts can be stacked, but this feature has never been used.
    // It's safe to assume we're dealing with a single y-indicator chart.
    const series = chartState.series[0]
    const yColumn = chartState.yColumns[0]

    const dataPoints = entityNames.map((entityName) => {
        const point = series.points.find(
            (point) => point.position === entityName
        )

        const value = point ? yColumn.formatValueShort(point.value) : "No data"
        const time = point
            ? yColumn.formatTime(point.time)
            : yColumn.formatTime(grapherState.endTime!)

        return {
            entityName,
            columnName: getColumnNameForDisplay(yColumn),
            unit: getColumnUnitForDisplay(yColumn),
            value,
            time,
            timePreposition: OwidTable.getPreposition(
                chartState.transformedTable.timeColumn
            ),
        }
    })

    return { type: "data-points", props: { dataPoints } }
}

/**
 * Creates a table where each row represents an entity in Marimekko chart.
 */
async function buildValueTableContentForMarimekko({
    grapherState,
    chartState,
    dataApiUrl,
}: {
    grapherState: GrapherState
    chartState: MarimekkoChartState
    dataApiUrl?: string
}): Promise<SearchChartHitDataTableContent> {
    const formatColumn = chartState.formatColumn
    const series = chartState.series[0]

    // Determine which entities to display in the table
    const displayEntities = chartState.selectionArray.hasSelection
        ? chartState.selectionArray.selectedSet
        : new Set(
              await pickDisplayEntitiesForMarimekko({
                  grapherState,
                  chartState,
                  dataApiUrl,
              })
          )

    let points = series.points
    if (displayEntities.size > 0) {
        points = points.filter((point) => displayEntities.has(point.position))
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
            }
        })
        .filter((row) => row !== undefined)

    // Sort by value in descending order
    rows = _.orderBy(rows, [(row) => row.point.value], "desc")

    return {
        type: "data-table",
        props: {
            rows: rows.map((row) => _.omit(row, ["point"])),
            title: makeTableTitle(grapherState, chartState, formatColumn),
        },
    }
}

async function pickDisplayEntitiesForMarimekko({
    grapherState,
    chartState,
    dataApiUrl,
    maxRows = 12,
}: {
    grapherState: GrapherState
    chartState: MarimekkoChartState
    dataApiUrl?: string
    maxRows?: number
}): Promise<EntityName[]> {
    const { items, colorColumnSlug, xColumnSlug } = chartState

    // Pick income groups or continents if available
    const regions = findBestAvailableRegions(grapherState.availableEntityNames)
    if (regions.length > 0) return regions

    // Helper functions
    type MarimekkoItem = MarimekkoChartState["items"][number]
    const getName = (item: MarimekkoItem) => item.entityName
    const getColor = (item: MarimekkoItem) =>
        item.entityColor?.colorDomainValue ?? ""
    const getX = (item: MarimekkoItem) => item.xPoint?.value ?? 0

    // When both color and x dimensions are available, select the entity
    // with the largest x from each color group
    if (colorColumnSlug && xColumnSlug) {
        return maxByGroup(items, getColor, getX).map(getName)
    }

    // When only the color dimension is available, select the entity with the
    // largest population from each color group
    if (colorColumnSlug) {
        const populationByEntityName = await fetchLatestPopulationData({
            dataApiUrl,
        })

        const getPopulation = (item: MarimekkoItem) =>
            populationByEntityName?.get(item.entityName) ?? 0

        return maxByGroup(items, getColor, getPopulation).map(getName)
    }

    // When only the x dimension is available, select the entities
    // with the largest x
    if (xColumnSlug) {
        return R.pipe(
            items,
            R.sortBy((item) => -getX(item)),
            R.take(maxRows),
            R.map(getName)
        )
    }

    // Otherwise, just take the first x entities
    return R.pipe(items, R.take(maxRows), R.map(getName))
}

async function buildDataTableContentForScatterPlot({
    grapherState,
    chartState,
    dataApiUrl,
}: Args<ScatterPlotChartState>): Promise<SearchChartHitDataTableContent> {
    const selectedEntities: EntityName[] =
        grapherState.selection.selectedEntityNames

    // If exactly one entity is selected, then display the x and y values for that entity
    if (selectedEntities.length === 1) {
        return buildDataPointsContentForScatterPlot({
            grapherState,
            chartState,
            entityName: selectedEntities[0],
        })
    }

    // Special handling for two cases (if the selection is empty):
    // Case 1:
    //   The scatter plot has exactly one entity. In this case, displaying
    //   the x-and y-value of that entity in a large format is nicer than
    //   a single-row table.
    // Case 2:
    //   The scatter plot is connected and has more than one entity. In this
    //   case, we can't fit the start and end values for both dimensions into
    //   a single table row. That's why we simply display the x- and y-values
    //   of one of the entities.
    if (
        selectedEntities.length === 0 &&
        (chartState.series.length === 1 || chartState.isConnected)
    ) {
        const displayEntity =
            findSingleDisplayEntityForScatterPlot(chartState) ??
            chartState.series[0]?.seriesName
        return buildDataPointsContentForScatterPlot({
            grapherState,
            chartState,
            entityName: displayEntity,
        })
    }

    // Display a table where each row corresponds to an entity and lists x and
    // y-values in this format: '<x-value> vs. <y-value>'.
    return buildValueTableContentForScatterPlot({
        grapherState,
        chartState,
        dataApiUrl,
    })
}

function findSingleDisplayEntityForScatterPlot(
    chartState: ScatterPlotChartState
): string | undefined {
    // If entities are selected, use the first selected entity
    const selectedEntities = chartState.selectionArray.selectedEntityNames
    if (selectedEntities.length > 0) return selectedEntities[0]

    // For non-connected scatter plots, use the first entity
    if (!chartState.isConnected) return chartState.series[0]?.seriesName

    // For connected scatter plots, prefer an entity with multiple data points
    // (indicating a connected line) over an entity with just a single point
    return (
        chartState.series.find((series) => series.points.length > 1) ??
        chartState.series[0]
    )?.seriesName
}

/**
 * Creates a table where each row represents an entity in a scatter plot,
 * displaying both x and y values in a "y vs x" format for each entity.
 */
async function buildValueTableContentForScatterPlot({
    grapherState,
    chartState,
    dataApiUrl,
}: {
    grapherState: GrapherState
    chartState: ScatterPlotChartState
    dataApiUrl?: string
}): Promise<SearchChartHitDataTableContent> {
    const { xColumn, yColumn } = chartState

    const yLabel =
        chartState.verticalAxisLabel || getColumnNameForDisplay(yColumn)
    const xLabel =
        chartState.horizontalAxisLabel || getColumnNameForDisplay(xColumn)

    // Determine which entities to display in the table
    const displayEntities = chartState.selectionArray.hasSelection
        ? chartState.selectionArray.selectedSet
        : new Set(
              await pickDisplayEntitiesForScatterPlot({
                  grapherState,
                  chartState,
                  dataApiUrl,
              })
          )

    let series = chartState.series
    if (displayEntities.size > 0)
        series = series.filter((series) =>
            displayEntities.has(series.seriesName)
        )

    const isTimeScatter = xColumn instanceof TimeColumn

    let rows = series
        .map((series) => {
            const point = series.points[0]
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
            }
        })
        .filter((row) => row !== undefined)

    // Sort by y-value in descending order
    rows = _.orderBy(rows, [(row) => row.yValue, "desc"])

    const title = isTimeScatter ? yLabel : `${yLabel} vs. ${xLabel}`

    return {
        type: "data-table",
        props: {
            rows: rows.map((row) => _.omit(row, ["yValue"])),
            title,
        },
    }
}

async function pickDisplayEntitiesForScatterPlot({
    grapherState,
    chartState,
    dataApiUrl,
    maxRows = 12,
}: {
    grapherState: GrapherState
    chartState: ScatterPlotChartState
    dataApiUrl?: string
    maxRows?: number
}): Promise<EntityName[]> {
    const { series, colorColumnSlug, sizeColumnSlug, isConnected } = chartState

    if (isConnected) return []

    // Pick income groups or continents if available
    const regions = findBestAvailableRegions(grapherState.availableEntityNames)
    if (regions.length > 0) return regions

    // Helper functions
    type ScatterSeries = ScatterPlotChartState["series"][number]
    const getName = (series: ScatterSeries) => series.seriesName
    const getColor = (series: ScatterSeries) => series.points.at(0)?.color ?? ""
    const getSize = (series: ScatterSeries) => series.points.at(0)?.size ?? 0

    // When both color and size dimensions are available, select the entity
    // with the largest size from each color group
    if (colorColumnSlug && sizeColumnSlug) {
        return maxByGroup(series, getColor, getSize).map(getName)
    }

    // When only the color dimension is available, select the entity with the
    // largest population from each color group
    if (colorColumnSlug) {
        const populationByEntityName = await fetchLatestPopulationData({
            dataApiUrl,
        })

        const getPopulation = (series: ScatterSeries) =>
            populationByEntityName?.get(series.seriesName) ?? 0

        return maxByGroup(series, getColor, getPopulation).map(getName)
    }

    // When only the size dimension is available, select the entities
    // with the largest size
    if (sizeColumnSlug) {
        return R.pipe(
            series,
            R.sortBy((series) => -getSize(series)),
            R.take(maxRows),
            R.map(getName)
        )
    }

    // Otherwise, just take the first x entities
    return R.pipe(series, R.take(maxRows), R.map(getName))
}

/**
 * Finds the best available regions from a set of available entities,
 * prioritizing income groups, then continents, then other aggregates.
 */
function findBestAvailableRegions(availableEntities: EntityName[]) {
    const availableEntitySet = new Set(availableEntities)

    const regionGroups = [getIncomeGroups(), getContinents(), getAggregates()]
    for (const regions of regionGroups) {
        const availableRegions: EntityName[] = regions
            .filter((region) => availableEntitySet.has(region.name))
            .map((region) => region.name)

        if (availableRegions.length > 0) {
            // Also add the World entity if it's available
            if (availableEntitySet.has(WORLD_ENTITY_NAME)) {
                availableRegions.push(WORLD_ENTITY_NAME)
            }

            return availableRegions
        }
    }
    return []
}

/**
 * Builds data points props for scatter plot charts, extracting x and y values
 * for a specific entity. For connected scatter plots, includes both start and
 * end values.
 */
function buildDataPointsContentForScatterPlot({
    grapherState,
    chartState,
    entityName,
}: {
    grapherState: GrapherState
    chartState: ScatterPlotChartState
    entityName: EntityName
}): SearchChartHitDataTableContent {
    const { xColumn, yColumn } = chartState

    const yLabel =
        chartState.verticalAxisLabel || getColumnNameForDisplay(yColumn)
    const xLabel =
        chartState.horizontalAxisLabel || getColumnNameForDisplay(xColumn)

    const series = chartState.series.find(
        (series) => series.seriesName === entityName
    )
    const points = series?.points ?? []
    const endPoint = _.maxBy(points, (point) => point.timeValue)
    const startPoint =
        points.length > 1
            ? _.minBy(points, (point) => point.timeValue)
            : undefined

    const formattedStartTime = startPoint
        ? yColumn.formatTime(startPoint.timeValue)
        : undefined
    const formattedEndTime = yColumn.formatTime(
        endPoint?.timeValue ?? grapherState.endTime!
    )

    const time = formattedStartTime
        ? `${formattedStartTime}–${formattedEndTime}`
        : formattedEndTime

    const yDataPoint = {
        entityName,
        columnName: yLabel,
        unit: getColumnUnitForDisplay(yColumn),
        time,
        value: endPoint ? yColumn.formatValueShort(endPoint.y) : "No data",
        startValue: startPoint
            ? yColumn.formatValueShort(startPoint.y)
            : undefined,
        trend: calculateTrendDirection(startPoint?.y, endPoint?.y),
    }

    const xDataPoint = grapherState.xColumnSlug
        ? {
              entityName,
              columnName: xLabel,
              unit: getColumnUnitForDisplay(xColumn),
              time,
              value: endPoint
                  ? xColumn.formatValueShort(endPoint.x)
                  : "No data",
              startValue: startPoint
                  ? xColumn.formatValueShort(startPoint.x)
                  : undefined,
              trend: calculateTrendDirection(startPoint?.x, endPoint?.x),
          }
        : undefined

    const dataPoints = excludeUndefined([yDataPoint, xDataPoint])

    return { type: "data-points", props: { dataPoints } }
}

function buildDataTableContentForWorldMap({
    grapherState,
    chartState,
}: Args<MapChartState>): SearchChartHitDataTableContent {
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
        type: "data-table",
        props: {
            rows: rows.map((row) =>
                _.omit(row, ["bin", "numSeriesContainedInBin"])
            ),
            title: makeTableTitle(grapherState, chartState, formatColumn),
        },
    }
}

// Only used to build a data table when Grapher has neither a chart
// nor a map tab which should never (or very rarely) happen
function buildDataTableContentForTableTab({
    grapherState,
}: BaseArgs): SearchChartHitDataTableContent {
    const yColumn = grapherState.tableForDisplay.get(grapherState.yColumnSlug)
    const columnName = getColumnNameForDisplay(yColumn)
    const unit = getColumnUnitForDisplay(yColumn, { allowTrivial: true })
    const title = unit ? `In ${unit}` : columnName

    const time = grapherState.endTime ?? grapherState.tableForDisplay.maxTime

    if (!time) return { type: "data-table", props: { rows: [], title } }

    let owidRows = grapherState.tableForDisplay
        .filterByTargetTimes([time])
        .get(grapherState.yColumnSlug).owidRows
    owidRows = _.orderBy(owidRows, [(row) => row.value], "desc")

    const tableRows = owidRows.map((row) => ({
        label: row.entityName,
        time: yColumn.formatTime(row.originalTime),
        timePreposition: OwidTable.getPreposition(
            grapherState.transformedTable.timeColumn
        ),
        value: yColumn.formatValueShort(row.value),
    }))

    return { type: "data-table", props: { rows: tableRows, title } }
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

function getColumnUnitForDisplay(
    column: CoreColumn | { unit?: string; shortUnit?: string },
    { allowTrivial = false }: { allowTrivial?: boolean } = {}
): string | undefined {
    if (!column.unit) return undefined

    // The unit is considered trivial if it is the same as the short unit
    const isTrivial = column.unit === column.shortUnit
    const unit = allowTrivial || !isTrivial ? column.unit : undefined

    // Remove parentheses from the beginning and end of the unit
    const strippedUnit = unit?.replace(/(^\(|\)$)/g, "")

    return strippedUnit
}

function calculateTrendDirection(
    startValue?: PrimitiveType,
    endValue?: PrimitiveType
): GrapherTrendArrowDirection | undefined {
    if (typeof startValue !== "number" || typeof endValue !== "number")
        return undefined
    return endValue > startValue
        ? "up"
        : endValue < startValue
          ? "down"
          : "right"
}

let _populationDataCache: Map<EntityName, number> | undefined
/**
 * Fetch the latest population data and return a map from entity name to
 * population value. The data is cached after the first fetch to avoid
 * re-fetching and re-processing the table on subsequent calls.
 */
async function fetchLatestPopulationData({
    dataApiUrl,
}: {
    dataApiUrl: string
}): Promise<Map<EntityName, number> | undefined> {
    // Return cached population data if available to avoid re-fetching/re-processing the table
    if (_populationDataCache) return _populationDataCache

    // Fetch population data as OWID table
    const table = await fetchInputTableForConfig({
        dimensions: [
            {
                property: DimensionProperty.y,
                variableId: POPULATION_VARIABLE_ID,
            },
        ],
        dataApiUrl,
    })

    // Filter to the most recent year
    const maxTime = table.maxTime ?? 0
    const populationColumn = table
        .filterByTargetTimes([maxTime])
        .get(POPULATION_VARIABLE_ID.toString())
    if (populationColumn.isMissing) return undefined

    // Create a map from entity name to population value
    const data = new Map<EntityName, number>()
    for (const [entityName, rows] of populationColumn.owidRowsByEntityName) {
        if (rows.length > 0) data.set(entityName, rows[0].value)
    }

    // Update cache
    _populationDataCache = data

    return data
}

/**
 * Groups an array of items by a key function and returns the item with the
 * maximum value (according to sortFn) from each group
 */
export function maxByGroup<T>(
    arr: ReadonlyArray<T>,
    groupFn: (item: T) => string | number,
    sortFn: (item: T) => number
) {
    return R.pipe(
        arr,
        R.groupBy(groupFn),
        R.mapValues((item) => R.firstBy(item, [sortFn, "desc"])),
        R.values()
    )
}
