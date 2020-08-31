import * as React from "react"
import { select } from "d3-selection"
import { min, max, maxBy } from "../utils/Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ChartConfig } from "charts/core/ChartConfig"
import { Bounds } from "charts/utils/Bounds"
import {
    Color,
    TickFormattingOptions,
    EntityDimensionKey,
    ScaleType
} from "charts/core/ChartConstants"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines
} from "charts/axis/AxisViews"
import { NoDataOverlay } from "../core/NoDataOverlay"
import { ControlsOverlay, AddEntityButton } from "../controls/Controls"
import { ChartView } from "charts/core/ChartView"
import { HorizontalAxis } from "charts/axis/Axis"

export interface DiscreteBarDatum {
    entityDimensionKey: EntityDimensionKey
    value: number
    year: number
    label: string
    color: Color
    formatValue: (value: number, options?: TickFormattingOptions) => string
}

const labelToTextPadding = 10
const labelToBarPadding = 5

@observer
export class DiscreteBarChart extends React.Component<{
    bounds: Bounds
    chart: ChartConfig
    chartView: ChartView
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed get chart() {
        return this.props.chart
    }
    @computed.struct get bounds() {
        return this.props.bounds.padRight(10)
    }

    @computed get failMessage() {
        return this.chart.discreteBarTransform.failMessage
    }

    @computed get currentData() {
        return this.chart.discreteBarTransform.currentData
    }

    @computed get allData() {
        return this.chart.discreteBarTransform.allData
    }

    @computed get displayData() {
        // Uses allData when the timeline handles are being dragged, and currentData otherwise
        return this.chart.useTimelineDomains ? this.allData : this.currentData
    }

    @computed get legendLabelStyle() {
        return {
            fontSize: 0.75 * this.props.chart.baseFontSize,
            fontWeight: 700
        }
    }

    @computed get valueLabelStyle() {
        return {
            fontSize: 0.75 * this.props.chart.baseFontSize,
            fontWeight: 400
        }
    }

    @computed get chartView() {
        return this.props.chartView
    }

    // Account for the width of the legend
    @computed get legendWidth() {
        const labels = this.currentData.map(d => d.label)
        if (this.hasFloatingAddButton)
            labels.push(` + ${this.chartView.controls.addButtonLabel}`)

        const longestLabel = maxBy(labels, d => d.length)
        return Bounds.forText(longestLabel, this.legendLabelStyle).width
    }

    @computed get hasPositive() {
        return this.displayData.some(d => d.value >= 0)
    }

    @computed get hasNegative() {
        return this.displayData.some(d => d.value < 0)
    }

    // The amount of space we need to allocate for bar end labels on the right
    @computed get rightEndLabelWidth(): number {
        if (this.hasPositive) {
            const positiveLabels = this.displayData
                .filter(d => d.value >= 0)
                .map(d => this.barValueFormat(d))
            const longestPositiveLabel = maxBy(positiveLabels, l => l.length)
            return Bounds.forText(longestPositiveLabel, this.valueLabelStyle)
                .width
        } else {
            return 0
        }
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed get leftEndLabelWidth(): number {
        if (this.hasNegative) {
            const negativeLabels = this.displayData
                .filter(d => d.value < 0)
                .map(d => this.barValueFormat(d))
            const longestNegativeLabel = maxBy(negativeLabels, l => l.length)
            return (
                Bounds.forText(longestNegativeLabel, this.valueLabelStyle)
                    .width + labelToTextPadding
            )
        } else {
            return 0
        }
    }

    @computed get x0(): number {
        if (this.isLogScale) {
            const minValue = min(this.allData.map(d => d.value))
            return minValue !== undefined ? Math.min(1, minValue) : 1
        }
        return 0
    }

    // Now we can work out the main x axis scale
    @computed get xDomainDefault(): [number, number] {
        const allValues = this.displayData.map(d => d.value)

        const minStart = this.x0
        return [
            Math.min(minStart, min(allValues) as number),
            Math.max(minStart, max(allValues) as number)
        ]
    }

    @computed get isLogScale() {
        return this.chart.yAxisOptions.scaleType === ScaleType.log
    }

    @computed get xRange(): [number, number] {
        return [
            this.bounds.left + this.legendWidth + this.leftEndLabelWidth,
            this.bounds.right - this.rightEndLabelWidth
        ]
    }

    @computed get xAxis() {
        const view = this.chart.yAxisOptions
            .toVerticalAxis()
            .updateDomain(this.xDomainDefault)

        view.tickFormat = this.chart.discreteBarTransform.tickFormat
        view.range = this.xRange
        view.label = ""
        return view
    }

    @computed private get innerBounds() {
        return this.bounds
            .padLeft(this.legendWidth + this.leftEndLabelWidth)
            .padBottom(this.xAxis.height)
            .padRight(this.rightEndLabelWidth)
    }

    @computed private get hasFloatingAddButton() {
        return (
            this.chartView.controls.hasFloatingAddButton &&
            this.chart.showAddEntityControls
        )
    }

    // Leave space for extra bar at bottom to show "Add country" button
    @computed private get totalBars() {
        return this.hasFloatingAddButton
            ? this.currentData.length + 1
            : this.currentData.length
    }

    @computed private get barHeight() {
        return (0.8 * this.innerBounds.height) / this.totalBars
    }

    @computed private get barSpacing() {
        return this.innerBounds.height / this.totalBars - this.barHeight
    }

    @computed private get barPlacements() {
        const { currentData, xAxis } = this
        return currentData.map(d => {
            const isNegative = d.value < 0
            const barX = isNegative
                ? xAxis.place(d.value)
                : xAxis.place(this.x0)
            const barWidth = isNegative
                ? xAxis.place(this.x0) - barX
                : xAxis.place(d.value) - barX

            return { x: barX, width: barWidth }
        })
    }

    @computed private get barWidths() {
        return this.barPlacements.map(b => b.width)
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

    @computed get barValueFormat() {
        return this.chart.discreteBarTransform.barValueFormat
    }

    @action.bound onAddClick() {
        this.chart.isSelectingData = true
    }

    get addEntityButton() {
        if (!this.hasFloatingAddButton) return undefined
        const y =
            this.bounds.top +
            (this.barHeight + this.barSpacing) * (this.totalBars - 1) +
            this.barHeight / 2
        const paddingTop = AddEntityButton.calcPaddingTop(
            y,
            "middle",
            this.barHeight
        )
        return (
            <ControlsOverlay id="add-country" paddingTop={paddingTop}>
                <AddEntityButton
                    x={this.bounds.left + this.legendWidth}
                    y={y}
                    align="right"
                    verticalAlign="middle"
                    height={this.barHeight}
                    label={`Add ${this.chart.entityType}`}
                    onClick={this.onAddClick}
                />
            </ControlsOverlay>
        )
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataOverlay
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            currentData,
            bounds,
            xAxis,
            innerBounds,
            barHeight,
            barSpacing,
            barValueFormat
        } = this

        let yOffset = innerBounds.top + barHeight / 2

        const onScaleTypeChange = (scaleType: ScaleType) => {
            this.chart.yAxisOptions.scaleType = scaleType
        }

        // todo: add explanation
        const xAxisAsVerticalAxis = (xAxis as any) as HorizontalAxis

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
                    maxX={this.chartView.tabBounds.width}
                    bounds={bounds}
                    isInteractive={this.chart.isInteractive}
                    axis={xAxisAsVerticalAxis}
                    onScaleTypeChange={
                        this.chart.yAxisOptions.canChangeScaleType
                            ? onScaleTypeChange
                            : undefined
                    }
                    axisPosition={innerBounds.bottom}
                />
                <HorizontalAxisGridLines
                    horizontalAxis={xAxisAsVerticalAxis}
                    bounds={innerBounds}
                />
                {currentData.map(d => {
                    const isNegative = d.value < 0
                    const barX = isNegative
                        ? xAxis.place(d.value)
                        : xAxis.place(this.x0)
                    const barWidth = isNegative
                        ? xAxis.place(this.x0) - barX
                        : xAxis.place(d.value) - barX
                    const valueLabel = barValueFormat(d)
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
                            key={d.entityDimensionKey}
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
                                {d.label}
                            </text>
                            <rect
                                x={0}
                                y={0}
                                transform={`translate(${barX}, ${
                                    -barHeight / 2
                                })`}
                                width={barWidth}
                                height={barHeight}
                                fill={d.color}
                                opacity={0.85}
                                style={{ transition: "height 200ms ease" }}
                            />
                            <text
                                x={0}
                                y={0}
                                transform={`translate(${
                                    xAxis.place(d.value) +
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
                {this.addEntityButton}
            </g>
        )
    }
}
