import * as _ from "lodash-es"
import React from "react"
import { select } from "d3-selection"
import {
    Bounds,
    Time,
    HorizontalAlign,
    AxisAlign,
    makeIdForHumanConsumption,
    dyFromAlign,
} from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ScaleType, VerticalAlign } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_THUMBNAIL_OPACITY_MUTE,
} from "../core/GrapherConstants"
import { HorizontalAxisZeroLine } from "../axis/AxisViews"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import {
    DiscreteBarChartManager,
    DiscreteBarSeries,
    PlacedDiscreteBarSeries,
} from "./DiscreteBarChartConstants"
import { OwidTable } from "@ourworldindata/core-table"
import { HorizontalAxis } from "../axis/Axis"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import { HorizontalColorLegendManager } from "../horizontalColorLegend/HorizontalColorLegends"
import type { BaseType, Selection } from "d3-selection"
import { DiscreteBarChartState } from "./DiscreteBarChartState"
import { makeProjectedDataPatternId } from "./DiscreteBarChartHelpers"

const labelToTextPadding = 10
const labelToBarPadding = 5

const BAR_SPACING_FACTOR = 0.35

export interface Label {
    valueString: string
    timeString: string
    width: number
}

export interface DiscreteBarsProps {
    chartState: DiscreteBarChartState
    bounds?: Bounds
    series: DiscreteBarSeries[]
    labelFontSize?: number
}

@observer
export class DiscreteBars
    extends React.Component<DiscreteBarsProps>
    implements ChartInterface, AxisManager, HorizontalColorLegendManager
{
    base = React.createRef<SVGGElement>()

    constructor(props: DiscreteBarsProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): DiscreteBarChartState {
        return this.props.chartState
    }

    @computed private get manager(): DiscreteBarChartManager {
        return this.chartState.manager
    }

    @computed private get targetTime(): Time | undefined {
        return this.manager.endTime
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get labelFontSize(): number {
        return this.props.labelFontSize ?? GRAPHER_FONT_SCALE_12 * this.fontSize
    }

    @computed private get sizedSeries(): DiscreteBarSeries[] {
        return this.props.series
    }

    @computed private get valueLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return { fontSize: this.labelFontSize, fontWeight: 400 }
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

        return (
            _.max(
                this.series
                    .filter((d) => d.value >= 0)
                    .map((d) => this.formatValue(d).width)
            ) ?? 0
        )
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed private get leftValueLabelWidth(): number {
        if (!this.hasNegative) return 0

        const labelAndValueWidths = this.sizedSeries
            .filter((s) => s.value < 0)
            .map((s) => {
                const labelWidth = s.label?.width ?? 0
                const valueWidth = this.formatValue(s).width
                return labelWidth + valueWidth + labelToTextPadding
            })

        return _.max(labelAndValueWidths) ?? 0
    }

    @computed private get x0(): number {
        return 0
    }

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const allValues = this.series.map((d) => d.value)
        return [
            Math.min(this.x0, _.min(allValues) as number),
            Math.max(this.x0, _.max(allValues) as number),
        ]
    }

    @computed private get xRange(): [number, number] {
        return [
            this.bounds.left + this.leftValueLabelWidth,
            this.bounds.right - this.rightValueLabelWidth,
        ]
    }

    // NB: y-axis settings are used for the horizontal axis in DiscreteBarChart
    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                // if we have a single-value x axis, we want to have the vertical axis
                // on the left of the chart
                singleValueAxisPointAlign: AxisAlign.start,
                ...this.manager.yAxisConfig,
            },
            this
        )
    }

    @computed get yAxis(): HorizontalAxis {
        // NB: We use the user's YAxis options here to make the XAxis
        const axis = this.yAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.chartState.yColumns[0] // todo: does this work for columns as series?
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padLeft(this.leftValueLabelWidth)
            .padRight(this.rightValueLabelWidth)
    }

    @computed private get barCount(): number {
        return this.series.length
    }

    /** The total height of the series, i.e. the height of the bar + the white space around it */
    @computed private get seriesHeight(): number {
        return this.innerBounds.height / this.barCount
    }

    @computed private get barSpacing(): number {
        return this.seriesHeight * BAR_SPACING_FACTOR
    }

    @computed private get barHeight(): number {
        const totalWhiteSpace = this.barCount * this.barSpacing
        return (this.innerBounds.height - totalWhiteSpace) / this.barCount
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

    private d3Bars(): Selection<
        BaseType,
        unknown,
        SVGGElement | null,
        unknown
    > {
        return select(this.base.current).selectAll("g.bar > rect")
    }

    private animateBarWidth(): void {
        this.d3Bars()
            .transition()
            .attr("width", (_, i) => this.barWidths[i])
    }

    override componentDidMount(): void {
        if (!this.manager.disableIntroAnimation) {
            this.d3Bars().attr("width", 0)
            this.animateBarWidth()
        }
    }

    override componentDidUpdate(): void {
        // Animating the bar width after a render ensures there's no race condition, where the
        // initial animation (in override componentDidMount) did override the now-changed bar width in
        // some cases. Updating the animation with the updated bar widths fixes that.
        if (!this.manager.disableIntroAnimation) this.animateBarWidth()
    }

    private renderEntityLabels(): React.ReactElement {
        const style = { fill: "#555", textAnchor: "end" }
        return (
            <g id={makeIdForHumanConsumption("entity-labels")}>
                {this.placedSeries.map((series) => {
                    return (
                        series.label && (
                            <React.Fragment key={series.seriesName}>
                                {series.label.renderSVG(
                                    series.entityLabelX,
                                    series.barY - series.label.height / 2,
                                    {
                                        textProps: {
                                            ...style,
                                            opacity: series.focus.background
                                                ? GRAPHER_THUMBNAIL_OPACITY_MUTE
                                                : 1,
                                        },
                                    }
                                )}
                            </React.Fragment>
                        )
                    )
                })}
            </g>
        )
    }

    private renderValueLabels(): React.ReactElement {
        return (
            <g id={makeIdForHumanConsumption("value-labels")}>
                {this.placedSeries.map((series) => {
                    const formattedLabel = this.formatValue(series)
                    return (
                        <text
                            key={series.seriesName}
                            x={0}
                            y={0}
                            transform={`translate(${series.valueLabelX}, ${series.barY})`}
                            fill={GRAPHER_DARK_TEXT}
                            dy={dyFromAlign(VerticalAlign.middle)}
                            textAnchor={series.value < 0 ? "end" : "start"}
                            opacity={
                                series.focus.background
                                    ? GRAPHER_THUMBNAIL_OPACITY_MUTE
                                    : 1
                            }
                            {...this.valueLabelStyle}
                        >
                            {formattedLabel.valueString}
                            <tspan fill="#999">
                                {formattedLabel.timeString}
                            </tspan>
                        </text>
                    )
                })}
            </g>
        )
    }

    private renderBars(): React.ReactElement {
        return (
            <g id={makeIdForHumanConsumption("bars")}>
                {this.placedSeries.map((series) => {
                    const barColor = series.yColumn.isProjection
                        ? `url(#${makeProjectedDataPatternId(series.color)})`
                        : series.color

                    // Using transforms for positioning to enable better (subpixel) transitions
                    // Width transitions don't work well on iOS Safari – they get interrupted and
                    // it appears very slow. Also be careful with negative bar charts.
                    return (
                        <rect
                            id={makeIdForHumanConsumption(series.seriesName)}
                            key={series.seriesName}
                            x={0}
                            y={0}
                            transform={`translate(${series.barX}, ${series.barY - this.barHeight / 2})`}
                            width={series.barWidth}
                            height={this.barHeight}
                            fill={barColor}
                            opacity={
                                series.focus.background
                                    ? GRAPHER_THUMBNAIL_OPACITY_MUTE
                                    : GRAPHER_AREA_OPACITY_DEFAULT
                            }
                            style={{ transition: "height 200ms ease" }}
                        />
                    )
                })}
            </g>
        )
    }

    override render(): React.ReactElement {
        return (
            <>
                <HorizontalAxisZeroLine
                    horizontalAxis={this.yAxis}
                    bounds={this.innerBounds}
                    strokeWidth={0.5}
                    // if the chart doesn't have negative values, then we
                    // move the zero line a little to the left to avoid
                    // overlap with the bars
                    align={
                        this.hasNegative
                            ? HorizontalAlign.center
                            : HorizontalAlign.right
                    }
                />
                {this.renderBars()}
                {this.renderValueLabels()}
                {this.renderEntityLabels()}
            </>
        )
    }

    formatValue(series: DiscreteBarSeries): Label {
        const { yColumn } = series

        const showYearLabels =
            this.manager.showYearLabels || series.time !== this.targetTime
        const valueString = yColumn.formatValueShort(series.value)
        let timeString = ""
        if (showYearLabels) {
            const { timeColumn } = this.chartState.transformedTable
            const preposition = OwidTable.getPreposition(timeColumn)
            timeString = ` ${preposition} ${timeColumn.formatTime(series.time)}`
        }

        const labelBounds = Bounds.forText(
            valueString + timeString,
            this.valueLabelStyle
        )

        return {
            valueString,
            timeString,
            width: labelBounds.width,
        }
    }

    @computed private get series(): DiscreteBarSeries[] {
        return this.chartState.series
    }

    @computed private get placedSeries(): PlacedDiscreteBarSeries[] {
        const yOffset =
            this.innerBounds.top + this.barHeight / 2 + this.barSpacing / 2
        return this.sizedSeries.map((series, index) => {
            const barY = yOffset + index * (this.barHeight + this.barSpacing)
            const isNegative = series.value < 0
            const barX = isNegative
                ? this.yAxis.place(series.value)
                : this.yAxis.place(this.x0)
            const barWidth = isNegative
                ? this.yAxis.place(this.x0) - barX
                : this.yAxis.place(series.value) - barX
            const label = this.formatValue(series)
            const entityLabelX = isNegative
                ? barX - label.width - labelToTextPadding
                : barX - labelToBarPadding
            const valueLabelX =
                this.yAxis.place(series.value) +
                (isNegative ? -labelToBarPadding : labelToBarPadding)

            return {
                ...series,
                barX,
                barY,
                barWidth,
                entityLabelX,
                valueLabelX,
            }
        })
    }
}
