import * as React from "react"
import { select } from "d3-selection"
import {
    min,
    max,
    maxBy,
    sortBy,
    exposeInstanceOnWindow,
    uniq,
    first,
    excludeUndefined,
} from "../../clientUtils/Util"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import {
    ScaleType,
    BASE_FONT_SIZE,
    SeriesStrategy,
} from "../core/GrapherConstants"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
} from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisConfig, FontSizeManager } from "../axis/AxisConfig"
import { ColorSchemes } from "../color/ColorSchemes"
import { ChartInterface } from "../chart/ChartInterface"
import {
    DEFAULT_BAR_COLOR,
    DiscreteBarChartManager,
    DiscreteBarSeries,
} from "./DiscreteBarChartConstants"
import { OwidTable } from "../../coreTable/OwidTable"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import { HorizontalAxis } from "../axis/Axis"
import { SelectionArray } from "../selection/SelectionArray"
import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { ColorScheme } from "../color/ColorScheme"
import {
    Time,
    SortOrder,
    SortBy,
    SortConfig,
} from "../../clientUtils/owidTypes"
import { LegacyOwidRow } from "../../coreTable/OwidTableConstants"

const labelToTextPadding = 10
const labelToBarPadding = 5

interface DiscreteBarItem {
    seriesName: string
    row: LegacyOwidRow<any>
    color?: string
}

@observer
export class DiscreteBarChart
    extends React.Component<{
        bounds?: Bounds
        manager: DiscreteBarChartManager
    }>
    implements ChartInterface, FontSizeManager {
    base: React.RefObject<SVGGElement> = React.createRef()

    transformTable(table: OwidTable): OwidTable {
        if (!this.yColumnSlugs.length) return table

        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(this.yColumnSlugs)

        table = table.dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        return table
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed private get manager(): DiscreteBarChartManager {
        return this.props.manager
    }

    @computed private get targetTime(): Time | undefined {
        return this.manager.endTime
    }

    @computed private get isLogScale(): boolean {
        return this.yAxisConfig.scaleType === ScaleType.log
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_BOUNDS).padRight(10)
    }

    @computed get fontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get legendLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return {
            fontSize: 0.75 * this.fontSize,
            fontWeight: 700,
        }
    }

    @computed private get valueLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return {
            fontSize: 0.75 * this.fontSize,
            fontWeight: 400,
        }
    }

    // Account for the width of the legend
    @computed private get legendWidth(): number {
        const labels = this.series.map((series) => series.seriesName)
        const longestLabel = maxBy(labels, (d) => d.length)
        return Bounds.forText(longestLabel, this.legendLabelStyle).width
    }

    @computed private get hasPositive(): boolean {
        return this.series.some((d) => d.value >= 0)
    }

    @computed private get hasNegative(): boolean {
        return this.series.some((d) => d.value < 0)
    }

    // The amount of space we need to allocate for bar end labels on the right
    @computed private get rightValueLabelWidth(): number {
        if (!this.hasPositive) return 0

        const positiveLabels = this.series
            .filter((d) => d.value >= 0)
            .map((d) => this.formatValue(d))
        const longestPositiveLabel = maxBy(positiveLabels, (l) => l.length)
        return Bounds.forText(longestPositiveLabel, this.valueLabelStyle).width
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed private get leftValueLabelWidth(): number {
        if (!this.hasNegative) return 0

        const negativeLabels = this.series
            .filter((d) => d.value < 0)
            .map((d) => this.formatValue(d))
        const longestNegativeLabel = maxBy(negativeLabels, (l) => l.length)
        return (
            Bounds.forText(longestNegativeLabel, this.valueLabelStyle).width +
            labelToTextPadding
        )
    }

    @computed private get x0(): number {
        if (!this.isLogScale) return 0

        const minValue = min(this.series.map((d) => d.value))
        return minValue !== undefined ? Math.min(1, minValue) : 1
    }

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const allValues = this.series.map((d) => d.value)
        return [
            Math.min(this.x0, min(allValues) as number),
            Math.max(this.x0, max(allValues) as number),
        ]
    }

    @computed private get xRange(): [number, number] {
        return [
            this.bounds.left + this.legendWidth + this.leftValueLabelWidth,
            this.bounds.right - this.rightValueLabelWidth,
        ]
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed get yAxis(): HorizontalAxis {
        // NB: We use the user's YAxis options here to make the XAxis
        const axis = this.yAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.formatColumn = this.yColumns[0] // todo: does this work for columns as series?
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padLeft(this.legendWidth + this.leftValueLabelWidth)
            .padBottom(this.yAxis.height)
            .padRight(this.rightValueLabelWidth)
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    // Leave space for extra bar at bottom to show "Add country" button
    @computed private get barCount(): number {
        return this.series.length
    }

    @computed private get barHeight(): number {
        return (0.8 * this.innerBounds.height) / this.barCount
    }

    @computed private get barSpacing(): number {
        return this.innerBounds.height / this.barCount - this.barHeight
    }

    @computed private get barPlacements(): { x: number; width: number }[] {
        const { series, yAxis } = this
        return series.map((d) => {
            const isNegative = d.value < 0
            const barX = isNegative
                ? yAxis.place(d.value)
                : yAxis.place(this.x0)
            const barWidth = isNegative
                ? yAxis.place(this.x0) - barX
                : yAxis.place(d.value) - barX

            return { x: barX, width: barWidth }
        })
    }

    @computed private get barWidths(): number[] {
        return this.barPlacements.map((b) => b.width)
    }

    private d3Bars() {
        return select(this.base.current).selectAll("g.bar > rect")
    }

    private animateBarWidth(): void {
        this.d3Bars()
            .transition()
            .attr("width", (_, i) => this.barWidths[i])
    }

    componentDidMount(): void {
        this.d3Bars().attr("width", 0)
        this.animateBarWidth()
        exposeInstanceOnWindow(this)
    }

    componentDidUpdate(): void {
        // Animating the bar width after a render ensures there's no race condition, where the
        // initial animation (in componentDidMount) did override the now-changed bar width in
        // some cases. Updating the animation with the updated bar widths fixes that.
        this.animateBarWidth()
    }

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            series,
            bounds,
            yAxis,
            innerBounds,
            barHeight,
            barSpacing,
        } = this

        let yOffset = innerBounds.top + barHeight / 2

        return (
            <g ref={this.base} className="DiscreteBarChart">
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                <HorizontalAxisComponent
                    bounds={bounds}
                    axis={yAxis}
                    axisPosition={innerBounds.bottom}
                />
                <HorizontalAxisGridLines
                    horizontalAxis={yAxis}
                    bounds={innerBounds}
                />
                {series.map((series) => {
                    // Todo: add a "placedSeries" getter to get the transformed series, then just loop over the placedSeries and render a bar for each
                    const isNegative = series.value < 0
                    const barX = isNegative
                        ? yAxis.place(series.value)
                        : yAxis.place(this.x0)
                    const barWidth = isNegative
                        ? yAxis.place(this.x0) - barX
                        : yAxis.place(series.value) - barX
                    const valueLabel = this.formatValue(series)
                    const labelX = isNegative
                        ? barX -
                          Bounds.forText(valueLabel, this.valueLabelStyle)
                              .width -
                          labelToTextPadding
                        : barX - labelToBarPadding

                    // Using transforms for positioning to enable better (subpixel) transitions
                    // Width transitions don't work well on iOS Safari – they get interrupted and
                    // it appears very slow. Also be careful with negative bar charts.
                    const result = (
                        <g
                            key={series.seriesName}
                            className="bar"
                            transform={`translate(0, ${yOffset})`}
                        >
                            <text
                                x={0}
                                y={0}
                                transform={`translate(${labelX}, 0)`}
                                fill="#555"
                                dominantBaseline="middle"
                                textAnchor="end"
                                {...this.legendLabelStyle}
                            >
                                {series.seriesName}
                            </text>
                            <rect
                                x={0}
                                y={0}
                                transform={`translate(${barX}, ${
                                    -barHeight / 2
                                })`}
                                width={barWidth}
                                height={barHeight}
                                fill={series.color}
                                opacity={0.85}
                                style={{ transition: "height 200ms ease" }}
                            />
                            <text
                                x={0}
                                y={0}
                                transform={`translate(${
                                    yAxis.place(series.value) +
                                    (isNegative
                                        ? -labelToBarPadding
                                        : labelToBarPadding)
                                }, 0)`}
                                fill="#666"
                                dominantBaseline="middle"
                                textAnchor={isNegative ? "end" : "start"}
                                {...this.valueLabelStyle}
                            >
                                {valueLabel}
                            </text>
                        </g>
                    )

                    yOffset += barHeight + barSpacing

                    return result
                })}
            </g>
        )
    }

    @computed get failMessage(): string {
        const column = this.yColumns[0]

        if (!column) return "No column to chart"

        if (!this.selectionArray.hasSelection) return `No data selected`

        // TODO is it better to use .series for this check?
        return this.yColumns.every((col) => col.isEmpty)
            ? `No matching data in columns ${this.yColumnSlugs.join(", ")}`
            : ""
    }

    formatValue(series: DiscreteBarSeries): string {
        const column = this.yColumns[0] // todo: do we need to use the right column here?
        const { transformedTable } = this

        const showYearLabels =
            this.manager.showYearLabels || series.time !== this.targetTime
        const displayValue = column.formatValueShort(series.value)
        return (
            displayValue +
            (showYearLabels
                ? ` (${transformedTable.timeColumnFormatFunction(series.time)})`
                : "")
        )
    }

    @computed protected get yColumnSlugs(): string[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed private get seriesStrategy(): SeriesStrategy {
        return (
            this.manager.seriesStrategy ??
            (this.yColumnSlugs.length > 1 &&
            this.selectionArray.numSelectedEntities === 1
                ? SeriesStrategy.column
                : SeriesStrategy.entity)
        )
    }

    @computed protected get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed private get columnsAsSeries(): DiscreteBarItem[] {
        return excludeUndefined(
            this.yColumns.map((col) => {
                const row = first(col.owidRows)
                // Do not plot a bar if column has no data for the selected time
                if (!row) return undefined
                return {
                    row,
                    seriesName: col.displayName,
                    color: col.def.color,
                }
            })
        )
    }

    @computed private get entitiesAsSeries(): DiscreteBarItem[] {
        const { transformedTable } = this
        return this.yColumns[0].owidRows.map((row) => {
            return {
                seriesName: row.entityName,
                color: transformedTable.getColorForEntityName(row.entityName),
                row,
            }
        })
    }

    @computed get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    @computed private get sortedRawSeries(): DiscreteBarItem[] {
        const raw =
            this.seriesStrategy === SeriesStrategy.entity
                ? this.entitiesAsSeries
                : this.columnsAsSeries

        let sortByFunc: (item: DiscreteBarItem) => number | string
        switch (this.sortConfig.sortBy) {
            case SortBy.entityName:
                sortByFunc = (item: DiscreteBarItem) => item.seriesName
                break
            default:
            case SortBy.total:
            case SortBy.column: // we only have one yColumn, so total and column are the same
                sortByFunc = (item: DiscreteBarItem) => item.row.value
                break
        }
        const sortedSeries = sortBy(raw, sortByFunc)
        const sortOrder = this.sortConfig.sortOrder ?? SortOrder.desc
        if (sortOrder === SortOrder.desc) sortedSeries.reverse()
        return sortedSeries
    }

    @computed private get colorScheme(): ColorScheme | undefined {
        // If this DiscreteBarChart stems from a LineChart, we want to match its (default) color
        // scheme OWID Distinct. Otherwise, use an all-blue color scheme (`undefined`) as default.
        const defaultColorScheme = this.manager.isLineChart
            ? ColorSchemes["owid-distinct"]
            : undefined

        return (
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : undefined) ?? defaultColorScheme
        )
    }

    @computed private get valuesToColorsMap(): Map<number, string> | undefined {
        const { manager, colorScheme, sortedRawSeries } = this

        return colorScheme?.getUniqValueColorMap(
            uniq(sortedRawSeries.map((series) => series.row.value)),
            !manager.invertColorScheme // negate here to be consistent with how things worked before
        )
    }

    @computed get series(): DiscreteBarSeries[] {
        const { manager, colorScheme } = this

        const series = this.sortedRawSeries.map((rawSeries) => {
            const { row, seriesName, color } = rawSeries
            const series: DiscreteBarSeries = {
                ...row,
                seriesName,
                color:
                    color ??
                    this.valuesToColorsMap?.get(row.value) ??
                    DEFAULT_BAR_COLOR,
            }
            return series
        })

        if (manager.isLineChart) {
            // For LineChart-based bar charts, we want to assign colors from the color scheme.
            // This way we get consistent between the DiscreteBarChart and the LineChart (by using the same logic).
            colorScheme?.assignColors(
                series,
                manager.invertColorScheme,
                this.seriesStrategy === SeriesStrategy.entity
                    ? this.inputTable.entityNameColorIndex
                    : this.inputTable.columnDisplayNameToColorMap,
                manager.seriesColorMap
            )
        }
        return series
    }
}
