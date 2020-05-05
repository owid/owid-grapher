import * as React from "react"
import { select } from "d3-selection"
import { sortBy, min, max } from "./Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ChartConfig } from "./ChartConfig"
import { Bounds } from "./Bounds"
import { AxisScale, ScaleType } from "./AxisScale"
import { Color } from "./Color"
import { HorizontalAxis, HorizontalAxisView } from "./HorizontalAxis"
import { AxisGridLines } from "./AxisBox"
import { NoData } from "./NoData"
import { TickFormattingOptions } from "./TickFormattingOptions"
import { ChartViewContextType, ChartViewContext } from "./ChartViewContext"
import { ControlsOverlay, AddEntityButton } from "./Controls"
import { EntityDimensionKey } from "./EntityDimensionKey"

export interface DiscreteBarDatum {
    entityDimensionKey: EntityDimensionKey
    value: number
    year: number
    label: string
    color: Color
    formatValue: (value: number, options?: TickFormattingOptions) => string
}

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

    @computed get legendFontSize() {
        return 0.85 * this.props.chart.baseFontSize
    }

    // Account for the width of the legend
    @computed get legendWidth() {
        const labels = this.currentData.map(d => d.label)
        if (this.hasAddButton)
            labels.push(` + ${this.context.chartView.controls.addButtonLabel}`)
        // TypeScript assumes that indexes always return the array type, but it can also be undefined
        // Issue: https://github.com/microsoft/TypeScript/issues/13778
        const longestLabel = sortBy(labels, d => -d.length)[0] as
            | string
            | undefined
        return Bounds.forText(longestLabel, { fontSize: this.legendFontSize })
            .width
    }

    // Account for the width of the little value labels at the end of bars
    @computed get endLabelFontSize() {
        return 0.75 * this.props.chart.baseFontSize
    }

    @computed get hasPositive() {
        return this.allData.some(d => d.value >= 0)
    }

    @computed get hasNegative() {
        return this.allData.some(d => d.value < 0)
    }

    // The amount of space we need to allocate for bar end labels on the right
    @computed get rightEndLabelWidth(): number {
        if (this.hasPositive) {
            const positiveLabels = this.allData
                .filter(d => d.value >= 0)
                .map(d => this.barValueFormat(d))
            const longestPositiveLabel = sortBy(
                positiveLabels,
                l => -l.length
            )[0]
            return Bounds.forText(longestPositiveLabel, {
                fontSize: this.endLabelFontSize
            }).width
        } else {
            return 0
        }
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed get leftEndLabelWidth(): number {
        if (this.hasNegative) {
            const negativeLabels = this.allData
                .filter(d => d.value < 0)
                .map(d => this.barValueFormat(d))
            const longestNegativeLabel = sortBy(
                negativeLabels,
                l => -l.length
            )[0]
            return (
                Bounds.forText(longestNegativeLabel, {
                    fontSize: this.endLabelFontSize
                }).width + 10
            )
        } else {
            return 0
        }
    }

    @computed get x0(): number {
        return this.isLogScale ? 1 : 0
    }

    // Now we can work out the main x axis scale
    @computed get xDomainDefault(): [number, number] {
        const allValues = (this.chart.useTimelineDomains
            ? this.allData
            : this.currentData
        ).map(d => d.value)

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

    @computed get hasAddButton() {
        return this.context.chartView.controls.hasAddButton
    }

    // Leave space for extra bar at bottom to show "Add country" button
    @computed get totalBars() {
        return this.hasAddButton
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

    componentDidMount() {
        const widths = this.barPlacements.map(b => b.width)
        const bars = select(this.base.current).selectAll("g.bar > rect")
        bars.attr("width", 0)
            .transition()
            .attr("width", (_, i) => widths[i])
    }

    @computed get barValueFormat() {
        return this.chart.discreteBar.barValueFormat
    }

    @action.bound onAddClick() {
        this.context.chartView.isSelectingData = true
    }

    render() {
        if (this.failMessage)
            return <NoData bounds={this.bounds} message={this.failMessage} />

        const {
            currentData,
            bounds,
            legendWidth,
            xAxis,
            xScale,
            innerBounds,
            barHeight,
            barSpacing,
            endLabelFontSize,
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
                                transform={`translate(${bounds.left +
                                    legendWidth -
                                    5}, 0)`}
                                fill="#666"
                                dominantBaseline="middle"
                                textAnchor="end"
                                fontSize={endLabelFontSize}
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
                                    (isNegative ? -5 : 5)}, 0)`}
                                fill="#666"
                                dominantBaseline="middle"
                                textAnchor={isNegative ? "end" : "start"}
                                fontSize={endLabelFontSize}
                            >
                                {barValueFormat(d)}
                            </text>
                        </g>
                    )

                    yOffset += barHeight + barSpacing

                    return result
                })}
                {this.chart.showChangeEntityButton && (
                    <ControlsOverlay id="add-country">
                        <AddEntityButton
                            x={this.bounds.left + this.legendWidth}
                            y={
                                this.bounds.top +
                                (this.barHeight + this.barSpacing) *
                                    (this.totalBars - 1) +
                                this.barHeight / 2
                            }
                            align="right"
                            verticalAlign="middle"
                            height={this.barHeight}
                            label={`Add ${this.context.chart.entityType}`}
                            onClick={this.onAddClick}
                        />
                    </ControlsOverlay>
                )}
            </g>
        )
    }
}
