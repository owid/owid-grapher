import * as React from "react"
import { select } from "d3-selection"
import { min, max, maxBy } from "grapher/utils/Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "grapher/core/Grapher"
import { Bounds } from "grapher/utils/Bounds"
import {
    Color,
    TickFormattingOptions,
    EntityDimensionKey,
    ScaleType,
} from "grapher/core/GrapherConstants"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
} from "grapher/axis/AxisViews"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import { ControlsOverlay } from "grapher/controls/ControlsOverlay"
import { AddEntityButton } from "grapher/controls/AddEntityButton"

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
    grapher: Grapher
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed get grapher() {
        return this.props.grapher
    }
    @computed.struct private get bounds() {
        return this.props.bounds.padRight(10)
    }

    @computed private get failMessage() {
        return this.grapher.discreteBarTransform.failMessage
    }

    @computed private get currentData() {
        return this.grapher.discreteBarTransform.currentData
    }

    @computed private get allData() {
        return this.grapher.discreteBarTransform.allData
    }

    @computed private get displayData() {
        // Uses allData when the timeline handles are being dragged, and currentData otherwise
        return this.grapher.useTimelineDomains ? this.allData : this.currentData
    }

    @computed private get legendLabelStyle() {
        return {
            fontSize: 0.75 * this.props.grapher.baseFontSize,
            fontWeight: 700,
        }
    }

    @computed private get valueLabelStyle() {
        return {
            fontSize: 0.75 * this.props.grapher.baseFontSize,
            fontWeight: 400,
        }
    }

    // Account for the width of the legend
    @computed private get legendWidth() {
        const labels = this.currentData.map((d) => d.label)
        if (this.hasFloatingAddButton)
            labels.push(` + ${this.grapher.addButtonLabel}`)

        const longestLabel = maxBy(labels, (d) => d.length)
        return Bounds.forText(longestLabel, this.legendLabelStyle).width
    }

    @computed private get hasPositive() {
        return this.displayData.some((d) => d.value >= 0)
    }

    @computed private get hasNegative() {
        return this.displayData.some((d) => d.value < 0)
    }

    // The amount of space we need to allocate for bar end labels on the right
    @computed private get rightEndLabelWidth(): number {
        if (this.hasPositive) {
            const positiveLabels = this.displayData
                .filter((d) => d.value >= 0)
                .map((d) => this.barValueFormat(d))
            const longestPositiveLabel = maxBy(positiveLabels, (l) => l.length)
            return Bounds.forText(longestPositiveLabel, this.valueLabelStyle)
                .width
        } else {
            return 0
        }
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed private get leftEndLabelWidth(): number {
        if (this.hasNegative) {
            const negativeLabels = this.displayData
                .filter((d) => d.value < 0)
                .map((d) => this.barValueFormat(d))
            const longestNegativeLabel = maxBy(negativeLabels, (l) => l.length)
            return (
                Bounds.forText(longestNegativeLabel, this.valueLabelStyle)
                    .width + labelToTextPadding
            )
        } else {
            return 0
        }
    }

    @computed private get x0(): number {
        if (this.isLogScale) {
            const minValue = min(this.allData.map((d) => d.value))
            return minValue !== undefined ? Math.min(1, minValue) : 1
        }
        return 0
    }

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const allValues = this.displayData.map((d) => d.value)

        const minStart = this.x0
        return [
            Math.min(minStart, min(allValues) as number),
            Math.max(minStart, max(allValues) as number),
        ]
    }

    @computed private get isLogScale() {
        return this.grapher.yAxis.scaleType === ScaleType.log
    }

    @computed private get xRange(): [number, number] {
        return [
            this.bounds.left + this.legendWidth + this.leftEndLabelWidth,
            this.bounds.right - this.rightEndLabelWidth,
        ]
    }

    @computed private get axis() {
        // NB: We use the user's YAxis options here to make the XAxis
        const axis = this.grapher.yAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.tickFormatFn = this.grapher.discreteBarTransform.tickFormat
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

    @computed private get hasFloatingAddButton() {
        return (
            this.grapher.hasFloatingAddButton &&
            this.grapher.showAddEntityControls
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
        const { currentData, axis } = this
        return currentData.map((d) => {
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

    @computed get barValueFormat() {
        return this.grapher.discreteBarTransform.barValueFormat
    }

    @action.bound onAddClick() {
        this.grapher.isSelectingData = true
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
                    label={`Add ${this.grapher.entityType}`}
                    onClick={this.onAddClick}
                />
            </ControlsOverlay>
        )
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataOverlay
                    options={this.grapher}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            currentData,
            bounds,
            axis,
            innerBounds,
            barHeight,
            barSpacing,
            barValueFormat,
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
                    isInteractive={this.grapher.isInteractive}
                    axis={axis}
                    axisPosition={innerBounds.bottom}
                />
                <HorizontalAxisGridLines
                    horizontalAxis={axis}
                    bounds={innerBounds}
                />
                {currentData.map((d) => {
                    const isNegative = d.value < 0
                    const barX = isNegative
                        ? axis.place(d.value)
                        : axis.place(this.x0)
                    const barWidth = isNegative
                        ? axis.place(this.x0) - barX
                        : axis.place(d.value) - barX
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
                                    axis.place(d.value) +
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
