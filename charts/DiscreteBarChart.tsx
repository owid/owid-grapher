import * as React from "react"
import { select } from "d3-selection"
import { sortBy, min, max, first } from "./Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ChartConfig } from "./ChartConfig"
import { Bounds } from "./Bounds"
import { AxisScale } from "./AxisScale"
import { Color } from "./Color"
import { HorizontalAxis, HorizontalAxisView } from "./HorizontalAxis"
import { AxisGridLines } from "./AxisBox"
import { NoData } from "./NoData"
import { TickFormattingOptions } from "./TickFormattingOptions"
import { ChartViewContextType, ChartViewContext } from "./ChartViewContext"
import { ControlsOverlay, AddEntityButton } from "./Controls"
import { EntityDimensionKey } from "./EntityDimensionKey"
import { ScaleType } from "./ScaleType"

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
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    static contextType = ChartViewContext
    context!: ChartViewContextType

    @computed get chart() {
        return this.props.chart
    }
    @computed.struct get bounds() {
        return this.props.bounds.padRight(10)
    }

    @computed get failMessage() {
        return this.chart.discreteBar.failMessage
    }

    @computed get currentData() {
        return this.chart.discreteBar.currentData
    }

    @computed get allData() {
        return this.chart.discreteBar.allData
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

    // Account for the width of the legend
    @computed get legendWidth() {
        const labels = this.currentData.map(d => d.label)
        if (this.hasFloatingAddButton)
            labels.push(` + ${this.context.chartView.controls.addButtonLabel}`)

        const longestLabel = first(sortBy(labels, d => -d.length))
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
            const longestPositiveLabel = sortBy(
                positiveLabels,
                l => -l.length
            )[0]
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
            const longestNegativeLabel = sortBy(
                negativeLabels,
                l => -l.length
            )[0]
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
        return this.chart.yAxis.scaleType === "log"
    }

    @computed get xRange() {
        return [
            this.bounds.left + this.legendWidth + this.leftEndLabelWidth,
            this.bounds.right - this.rightEndLabelWidth
        ]
    }

    @computed get xScale() {
        const xAxis = this.chart.yAxis.toSpec({
            defaultDomain: this.xDomainDefault
        }) // XXX
        return new AxisScale(xAxis).extend({
            domain: this.xDomainDefault,
            range: this.xRange,
            tickFormat: this.chart.discreteBar.tickFormat
        })
    }

    @computed get xAxis() {
        const that = this
        return new HorizontalAxis({
            get scale() {
                return that.xScale
            },
            get fontSize() {
                return that.chart.baseFontSize
            }
        })
    }

    @computed get innerBounds() {
        return this.bounds
            .padLeft(this.legendWidth + this.leftEndLabelWidth)
            .padBottom(this.xAxis.height)
            .padRight(this.rightEndLabelWidth)
    }

    @computed get hasFloatingAddButton() {
        return (
            this.context.chartView.controls.hasFloatingAddButton &&
            this.chart.showAddEntityControls
        )
    }

    // Leave space for extra bar at bottom to show "Add country" button
    @computed get totalBars() {
        return this.hasFloatingAddButton
            ? this.currentData.length + 1
            : this.currentData.length
    }

    @computed get barHeight() {
        return (0.8 * this.innerBounds.height) / this.totalBars
    }

    @computed get barSpacing() {
        return this.innerBounds.height / this.totalBars - this.barHeight
    }

    @computed get barPlacements() {
        const { currentData, xScale } = this
        return currentData.map(d => {
            const isNegative = d.value < 0
            const barX = isNegative
                ? xScale.place(d.value)
                : xScale.place(this.x0)
            const barWidth = isNegative
                ? xScale.place(this.x0) - barX
                : xScale.place(d.value) - barX

            return { x: barX, width: barWidth }
        })
    }

    @computed get barWidths() {
        return this.barPlacements.map(b => b.width)
    }

    private d3Bars() {
        return select(this.base.current).selectAll("g.bar > rect")
    }

    componentDidMount() {
        this.d3Bars()
            .attr("width", 0)
            .transition()
            .attr("width", (_, i) => this.barWidths[i])
    }

    componentDidUpdate() {
        this.d3Bars()
            .transition()
            .attr("width", (_, i) => this.barWidths[i])
    }

    @computed get barValueFormat() {
        return this.chart.discreteBar.barValueFormat
    }

    @action.bound onAddClick() {
        this.context.chartView.isSelectingData = true
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
                    label={`Add ${this.context.chart.entityType}`}
                    onClick={this.onAddClick}
                />
            </ControlsOverlay>
        )
    }

    render() {
        if (this.failMessage)
            return <NoData bounds={this.bounds} message={this.failMessage} />

        const {
            currentData,
            bounds,
            xAxis,
            xScale,
            innerBounds,
            barHeight,
            barSpacing,
            barValueFormat
        } = this

        let yOffset = innerBounds.top + barHeight / 2

        const onScaleTypeChange = (scaleType: ScaleType) => {
            this.chart.yAxis.scaleType = scaleType
        }

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
                <HorizontalAxisView
                    bounds={bounds}
                    axis={xAxis}
                    onScaleTypeChange={
                        this.chart.yAxis.canChangeScaleType
                            ? onScaleTypeChange
                            : undefined
                    }
                    axisPosition={innerBounds.bottom}
                />
                <AxisGridLines
                    orient="bottom"
                    scale={xScale}
                    bounds={innerBounds}
                />
                {currentData.map(d => {
                    const isNegative = d.value < 0
                    const barX = isNegative
                        ? xScale.place(d.value)
                        : xScale.place(this.x0)
                    const barWidth = isNegative
                        ? xScale.place(this.x0) - barX
                        : xScale.place(d.value) - barX
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
                                transform={`translate(${barX}, ${-barHeight /
                                    2})`}
                                width={barWidth}
                                height={barHeight}
                                fill={d.color}
                                opacity={0.85}
                                style={{ transition: "height 200ms ease" }}
                            />
                            <text
                                x={0}
                                y={0}
                                transform={`translate(${xScale.place(d.value) +
                                    (isNegative
                                        ? -labelToBarPadding
                                        : labelToBarPadding)}, 0)`}
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
