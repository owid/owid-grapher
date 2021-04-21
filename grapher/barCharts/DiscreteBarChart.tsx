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
import { computed, action } from "mobx"
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
import { AxisConfig } from "../axis/AxisConfig"
import { ColorSchemes } from "../color/ColorSchemes"
import { ChartInterface } from "../chart/ChartInterface"
import {
    DEFAULT_BAR_COLOR,
    DiscreteBarChartManager,
    DiscreteBarSeries,
} from "./DiscreteBarChartConstants"
import { OwidTable } from "../../coreTable/OwidTable"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"

const labelToTextPadding = 10
const labelToBarPadding = 5

@observer
export class DiscreteBarChart
    extends React.Component<{
        bounds?: Bounds
        manager: DiscreteBarChartManager
    }>
    implements ChartInterface {
    base: React.RefObject<SVGGElement> = React.createRef()

    transformTable(table: OwidTable) {
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

    @computed get inputTable() {
        return this.manager.table
    }

    @computed get transformedTable() {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed private get targetTime() {
        return this.manager.endTime
    }

    @computed private get bounds() {
        return (this.props.bounds ?? DEFAULT_BOUNDS).padRight(10)
    }

    @computed private get baseFontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get legendLabelStyle() {
        return {
            fontSize: 0.75 * this.baseFontSize,
            fontWeight: 700,
        }
    }

    @computed private get valueLabelStyle() {
        return {
            fontSize: 0.75 * this.baseFontSize,
            fontWeight: 400,
        }
    }

    // Account for the width of the legend
    @computed private get legendWidth() {
        const labels = this.series.map((series) => series.seriesName)
        const longestLabel = maxBy(labels, (d) => d.length)
        return Bounds.forText(longestLabel, this.legendLabelStyle).width
    }

    @computed private get hasPositive() {
        return this.series.some((d) => d.value >= 0)
    }

    @computed private get hasNegative() {
        return this.series.some((d) => d.value < 0)
    }

    // The amount of space we need to allocate for bar end labels on the right
    @computed private get rightEndLabelWidth() {
        if (!this.hasPositive) return 0

        const positiveLabels = this.series
            .filter((mark) => mark.value >= 0)
            .map((mark) => this.formatValue(mark))
        const longestPositiveLabel = maxBy(positiveLabels, (l) => l.length)
        return Bounds.forText(longestPositiveLabel, this.valueLabelStyle).width
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed private get leftEndLabelWidth() {
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

    @computed private get x0() {
        if (!this.isLogScale) return 0

        const minValue = min(this.series.map((d) => d.value))
        return minValue !== undefined ? Math.min(1, minValue) : 1
    }

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const allValues = this.series.map((d) => d.value)

        const minStart = this.x0
        return [
            Math.min(minStart, min(allValues) as number),
            Math.max(minStart, max(allValues) as number),
        ]
    }

    @computed private get xRange(): [number, number] {
        return [
            this.bounds.left + this.legendWidth + this.leftEndLabelWidth,
            this.bounds.right - this.rightEndLabelWidth,
        ]
    }

    @computed private get yAxis() {
        return this.manager.yAxis || new AxisConfig()
    }

    @computed private get axis() {
        // NB: We use the user's YAxis options here to make the XAxis
        const axis = this.yAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.formatColumn = this.yColumns[0] // todo: does this work for columns as series?
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get innerBounds() {
        return this.bounds
            .padLeft(this.legendWidth + this.leftEndLabelWidth)
            .padBottom(this.axis.height)
            .padRight(this.rightEndLabelWidth)
    }

    @computed private get selectionArray() {
        return makeSelectionArray(this.manager)
    }

    // Leave space for extra bar at bottom to show "Add country" button
    @computed private get totalBars() {
        return this.series.length
    }

    @computed private get barHeight() {
        return (0.8 * this.innerBounds.height) / this.totalBars
    }

    @computed private get barSpacing() {
        return this.innerBounds.height / this.totalBars - this.barHeight
    }

    @computed private get barPlacements() {
        const { series, axis } = this
        return series.map((d) => {
            const isNegative = d.value < 0
            const barX = isNegative ? axis.place(d.value) : axis.place(this.x0)
            const barWidth = isNegative
                ? axis.place(this.x0) - barX
                : axis.place(d.value) - barX

            return { x: barX, width: barWidth }
        })
    }

    @computed private get barWidths() {
        return this.barPlacements.map((b) => b.width)
    }

    private d3Bars() {
        return select(this.base.current).selectAll("g.bar > rect")
    }

    private animateBarWidth() {
        this.d3Bars()
            .transition()
            .attr("width", (_, i) => this.barWidths[i])
    }

    componentDidMount() {
        this.d3Bars().attr("width", 0)
        this.animateBarWidth()
        exposeInstanceOnWindow(this)
    }

    componentDidUpdate() {
        // Animating the bar width after a render ensures there's no race condition, where the
        // initial animation (in componentDidMount) did override the now-changed bar width in
        // some cases. Updating the animation with the updated bar widths fixes that.
        this.animateBarWidth()
    }

    @action.bound private onAddClick() {
        this.manager.isSelectingData = true
    }

    render() {
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
            axis,
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
                    axis={axis}
                    axisPosition={innerBounds.bottom}
                />
                <HorizontalAxisGridLines
                    horizontalAxis={axis}
                    bounds={innerBounds}
                />
                {series.map((series) => {
                    // Todo: add a "placedSeries" getter to get the transformed series, then just loop over the placedSeries and render a bar for each
                    const isNegative = series.value < 0
                    const barX = isNegative
                        ? axis.place(series.value)
                        : axis.place(this.x0)
                    const barWidth = isNegative
                        ? axis.place(this.x0) - barX
                        : axis.place(series.value) - barX
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
                                    axis.place(series.value) +
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

    @computed get failMessage() {
        const column = this.yColumns[0]

        if (!column) return "No column to chart"

        if (!this.selectionArray.hasSelection) return `No data selected`

        // TODO is it better to use .series for this check?
        return this.yColumns.every((col) => col.isEmpty)
            ? `No matching data in columns ${this.yColumnSlugs.join(", ")}`
            : ""
    }

    formatValue(series: DiscreteBarSeries) {
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

    @computed protected get yColumnSlugs() {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed private get seriesStrategy() {
        return (
            this.manager.seriesStrategy ??
            (this.yColumnSlugs.length > 1 &&
            this.selectionArray.numSelectedEntities === 1
                ? SeriesStrategy.column
                : SeriesStrategy.entity)
        )
    }

    @computed protected get yColumns() {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed private get columnsAsSeries() {
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

    @computed private get entitiesAsSeries() {
        const { transformedTable } = this
        return this.yColumns[0].owidRows.map((row) => {
            return {
                seriesName: row.entityName,
                color: transformedTable.getColorForEntityName(row.entityName),
                row,
            }
        })
    }

    @computed private get sortedRawSeries() {
        const raw =
            this.seriesStrategy === SeriesStrategy.entity
                ? this.entitiesAsSeries
                : this.columnsAsSeries
        return sortBy(raw, (series) => series.row.value)
    }

    @computed private get colorScheme() {
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

    @computed private get valuesToColorsMap() {
        const { manager, colorScheme, sortedRawSeries } = this

        return colorScheme?.getUniqValueColorMap(
            uniq(sortedRawSeries.map((series) => series.row.value)),
            manager.invertColorScheme
        )
    }

    @computed get series() {
        const { manager, colorScheme } = this

        const series = this.sortedRawSeries
            .slice() // we need to clone/slice here so `.reverse()` doesn't modify `this.sortedRawSeries` in-place
            .reverse()
            .map((rawSeries) => {
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

    @computed private get isLogScale() {
        return this.yAxis.scaleType === ScaleType.log
    }
}
