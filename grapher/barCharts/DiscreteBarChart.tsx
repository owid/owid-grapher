import * as React from "react"
import { select } from "d3-selection"
import { min, max, maxBy, sortBy } from "grapher/utils/Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import {
    ScaleType,
    BASE_FONT_SIZE,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import { SortOrder } from "coreTable/CoreTableConstants"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
} from "grapher/axis/AxisViews"
import { NoDataModal } from "grapher/noDataModal/NoDataModal"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ColorSchemes } from "grapher/color/ColorSchemes"
import { ChartInterface } from "grapher/chart/ChartInterface"
import {
    DiscreteBarChartManager,
    DiscreteBarSeries,
} from "./DiscreteBarChartConstants"
import { OwidTableSlugs } from "coreTable/OwidTableConstants"

const labelToTextPadding = 10
const labelToBarPadding = 5

const DEFAULT_BAR_COLOR = "#2E5778"

@observer
export class DiscreteBarChart
    extends React.Component<{
        bounds?: Bounds
        manager: DiscreteBarChartManager
    }>
    implements ChartInterface {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get manager() {
        return this.props.manager
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

        axis.formatColumn = this.rootYColumn
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

        const maxX = bounds.width + 40 // This is only used to shift the ScaleSelector left if it exceeds the container. Hard coded for now but could be improved

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
                    maxX={maxX}
                    bounds={bounds}
                    isInteractive={!this.manager.isStaticSvg}
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
                            style={{ transition: "transform 200ms ease" }}
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
        const column = this.rootYColumn

        if (!column) return "No column to chart"

        if (!column.table.hasSelection) return `No data selected`

        return column.isEmpty ? `No matching data in column ${column.name}` : ""
    }

    private formatValue(series: DiscreteBarSeries) {
        const column = this.rootYColumn
        const { maxTime } = column
        const { table } = this

        const showYearLabels =
            this.manager.showYearLabels || series.time !== maxTime
        const displayValue = column.formatValueShort(series.value)
        return (
            displayValue +
            (showYearLabels
                ? ` (${table.timeColumnFormatFunction(series.time)})`
                : "")
        )
    }

    @computed get rootYColumn() {
        return this.inputTable.get(this.yColumnSlugs[0])!
    }

    @computed private get yColumn() {
        return this.table.get(this.yColumnSlugs[0])!
    }

    @computed protected get yColumnSlugs() {
        return this.manager.yColumnSlugs
            ? this.manager.yColumnSlugs
            : this.manager.yColumnSlug
            ? [this.manager.yColumnSlug]
            : this.inputTable.numericColumnSlugs
    }

    @computed get table() {
        const { slug, maxTime, tolerance } = this.rootYColumn
        let table = this.inputTable
            .filterBySelectedOnly()
            .filterByTargetTime(maxTime, tolerance)

        // Here we can filter entire rows instead of using "replaceNonPositiveCellsForLogScale" since we currently don't support
        // multiple ycolumn bar charts.
        if (this.isLogScale) table = table.filterNegativesForLogScale(slug)
        return table.sortBy(
            [slug, OwidTableSlugs.entityName],
            [SortOrder.desc, SortOrder.asc]
        )
    }

    @computed private get seriesStrategy() {
        return (
            this.manager.seriesStrategy ||
            (this.yColumnSlugs.length > 1 &&
            this.inputTable.numSelectedEntities === 1
                ? SeriesStrategy.column
                : SeriesStrategy.entity)
        )
    }

    @computed get inputTable() {
        return this.manager.table
    }

    @computed private get valuesToColorsMap() {
        const { manager, yColumn } = this
        // todo: Restore if derived from line chart, use line chart colors
        const uniqValues = yColumn.uniqTimesAsc
        const colorScheme = manager.baseColorScheme
            ? ColorSchemes[manager.baseColorScheme]
            : undefined
        const colors = colorScheme?.getColors(uniqValues.length) || []
        if (manager.invertColorScheme) colors.reverse()

        // We want to display same values using the same color, e.g. two values of 100 get the same shade of green
        // Therefore, we create a map from all possible (unique) values to the corresponding color
        const colorByValue = new Map<number, string>()
        uniqValues.forEach((value, i) => colorByValue.set(value, colors[i]))
        return colorByValue
    }

    @computed protected get yColumns() {
        return this.table.getColumns(this.yColumnSlugs)
    }

    @computed private get columnsAsSeries() {
        const { table, valuesToColorsMap } = this
        return sortBy(
            this.yColumns.map((col) => {
                const row = col.owidRows[0]
                const seriesName = col.displayName
                const series: DiscreteBarSeries = {
                    ...row,
                    seriesName,
                    color:
                        table.getColorForEntityName(seriesName) ||
                        valuesToColorsMap.get(row.value) ||
                        DEFAULT_BAR_COLOR,
                }
                return series
            }),
            "value"
        ).reverse()
    }

    @computed private get entitiesAsSeries() {
        const { table, valuesToColorsMap } = this
        return this.yColumn.owidRows.map((row) => {
            const seriesName = row.entityName
            const series: DiscreteBarSeries = {
                ...row,
                seriesName,
                color:
                    table.getColorForEntityName(seriesName) ||
                    valuesToColorsMap.get(row.value) ||
                    DEFAULT_BAR_COLOR,
            }
            return series
        })
    }

    @computed get series() {
        return this.seriesStrategy === SeriesStrategy.entity
            ? this.entitiesAsSeries
            : this.columnsAsSeries
    }

    @computed private get isLogScale() {
        return this.yAxis.scaleType === ScaleType.log
    }
}
