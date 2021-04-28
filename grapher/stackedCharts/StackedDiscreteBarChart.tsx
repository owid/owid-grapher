import * as React from "react"
import {
    min,
    max,
    maxBy,
    exposeInstanceOnWindow,
    excludeUndefined,
    sortBy,
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
import { AxisConfig } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import { OwidTable } from "../../coreTable/OwidTable"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import {
    stackedSeriesMaxY,
    stackSeries,
    stackSeriesOrthogonal,
} from "../stackedCharts/StackedUtils"
import { ChartManager } from "../chart/ChartManager"
import { Time } from "../../clientUtils/owidTypes"
import { StackedSeries } from "./StackedConstants"

// const labelToTextPadding = 10
// const labelToBarPadding = 5

export interface StackedDiscreteBarChartManager extends ChartManager {
    endTime?: Time
}

const DEFAULT_BAR_COLOR = "#2E5778"

@observer
export class StackedDiscreteBarChart
    extends React.Component<{
        bounds?: Bounds
        manager: StackedDiscreteBarChartManager
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

    @computed private get isLogScale() {
        return this.yAxis.scaleType === ScaleType.log
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

    @computed private get x0() {
        if (!this.isLogScale) return 0

        const minValue = min(this.series.map(stackedSeriesMaxY))
        return minValue !== undefined ? Math.min(1, minValue) : 1
    }

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const maxYs = this.series.map(stackedSeriesMaxY)
        return [
            Math.min(this.x0, min(maxYs) as number),
            Math.max(this.x0, max(maxYs) as number),
        ]
    }

    @computed private get xRange(): [number, number] {
        return [this.bounds.left + this.legendWidth, this.bounds.right]
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
        return this.bounds.padLeft(this.legendWidth).padBottom(this.axis.height)
    }

    @computed private get selectionArray() {
        return makeSelectionArray(this.manager)
    }

    // Leave space for extra bar at bottom to show "Add country" button
    @computed private get barCount() {
        return this.series.length
    }

    @computed private get barHeight() {
        return (0.8 * this.innerBounds.height) / this.barCount
    }

    @computed private get barSpacing() {
        return this.innerBounds.height / this.barCount - this.barHeight
    }

    componentDidMount() {
        exposeInstanceOnWindow(this)
    }

    componentDidUpdate() {
        // Animating the bar width after a render ensures there's no race condition, where the
        // initial animation (in componentDidMount) did override the now-changed bar width in
        // some cases. Updating the animation with the updated bar widths fixes that.
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
            <g ref={this.base} className="StackedDiscreteBarChart">
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
                                transform={`translate(${axis.place(
                                    this.x0
                                )}, 0)`}
                                fill="#555"
                                dominantBaseline="middle"
                                textAnchor="end"
                                {...this.legendLabelStyle}
                            >
                                {series.seriesName}
                            </text>
                            {series.points.map((point, i) => {
                                const barX = axis.place(this.x0 + point.yOffset)
                                const barWidth =
                                    axis.place(point.y) - axis.place(this.x0)
                                return (
                                    <rect
                                        // TODO pick a better `key`
                                        key={i}
                                        x={0}
                                        y={0}
                                        transform={`translate(${barX}, ${
                                            -barHeight / 2
                                        })`}
                                        width={barWidth}
                                        height={barHeight}
                                        fill={point.color}
                                        opacity={0.85}
                                        style={{
                                            transition: "height 200ms ease",
                                        }}
                                    />
                                )
                            })}
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

    @computed protected get yColumnSlugs() {
        return (
            this.manager.yColumnSlugsInSelectionOrder ??
            autoDetectYColumnSlugs(this.manager)
        )
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
        // We want the first selected series to be on top, so we reverse the order.
        return this.transformedTable.getColumns(this.yColumnSlugs).reverse()
    }

    @computed private get columnsAsSeries() {
        return (
            this.yColumns
                .map((col) => {
                    return {
                        isProjection: col.isProjection,
                        seriesName: col.displayName,
                        color: DEFAULT_BAR_COLOR,
                        rows: col.owidRows,
                        points: col.owidRows.map((row) => ({
                            x: row.time,
                            y: row.value,
                            color: this.transformedTable.getColorForEntityName(
                                row.entityName
                            ),
                            yOffset: 0,
                        })),
                    }
                })
                // Do not plot columns without data
                .filter((series) => series.points.length > 0)
        )
    }

    @computed private get entitiesAsSeries() {
        return this.selectionArray.selectedEntityNames
            .map((seriesName) => {
                return {
                    seriesName,
                    points: excludeUndefined(
                        this.yColumns.map((col) => {
                            const rows = col.owidRowsByEntityName.get(
                                seriesName
                            )
                            if (!rows) return undefined
                            const row = rows[0]
                            return {
                                x: row.time,
                                y: row.value,
                                color: col.def.color,
                                yOffset: 0,
                            }
                        })
                    ),
                    color: DEFAULT_BAR_COLOR,
                }
            })
            .reverse()
    }

    @computed private get rawSeries(): readonly StackedSeries[] {
        // TODO sort series
        return this.seriesStrategy === SeriesStrategy.entity
            ? this.entitiesAsSeries
            : this.columnsAsSeries
    }

    @computed get unstackedSeries() {
        const series = this.rawSeries
            .slice() // we need to clone/slice here so `.reverse()` doesn't modify `this.sortedRawSeries` in-place
            .reverse()
            .map((rawSeries) => {
                const { seriesName, color, points } = rawSeries
                const series: StackedSeries = {
                    points,
                    seriesName,
                    color: color ?? DEFAULT_BAR_COLOR,
                }
                return series
            })

        return series
    }

    @computed get series() {
        return sortBy(
            stackSeriesOrthogonal(this.unstackedSeries),
            stackedSeriesMaxY
        ).reverse()
    }
}
