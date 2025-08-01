import * as _ from "lodash-es"
import React from "react"
import { select } from "d3-selection"
import {
    exposeInstanceOnWindow,
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
} from "../core/GrapherConstants"
import { HorizontalAxisZeroLine } from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import {
    BACKGROUND_COLOR,
    DiscreteBarChartManager,
    DiscreteBarSeries,
    PlacedDiscreteBarSeries,
} from "./DiscreteBarChartConstants"
import { OwidTable } from "@ourworldindata/core-table"
import { HorizontalAxis } from "../axis/Axis"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import {
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../horizontalColorLegend/HorizontalColorLegends"
import type { BaseType, Selection } from "d3-selection"
import { TextWrap } from "@ourworldindata/components"
import { DiscreteBarChartState } from "./DiscreteBarChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"

const labelToTextPadding = 10
const labelToBarPadding = 5

const LEGEND_PADDING = 25
const DEFAULT_PROJECTED_DATA_COLOR_IN_LEGEND = "#787878"

// if an entity name exceeds this width, we use the short name instead (if available)
const SOFT_MAX_LABEL_WIDTH = 90

const BAR_SPACING_FACTOR = 0.35

export interface Label {
    valueString: string
    timeString: string
    width: number
}

export type DiscreteBarChartProps = ChartComponentProps<DiscreteBarChartState>

@observer
export class DiscreteBarChart
    extends React.Component<DiscreteBarChartProps>
    implements ChartInterface, AxisManager, HorizontalColorLegendManager
{
    base = React.createRef<SVGGElement>()

    constructor(props: DiscreteBarChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): DiscreteBarChartState {
        return this.props.chartState
    }

    @computed private get manager(): DiscreteBarChartManager {
        return this.chartState.manager
    }

    @computed private get transformedTable(): OwidTable {
        return this.chartState.transformedTable
    }

    @computed private get targetTime(): Time | undefined {
        return this.manager.endTime
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padRight(10)
    }

    @computed private get boundsWithoutColorLegend(): Bounds {
        return this.bounds.padTop(
            this.showColorLegend ? this.legendHeight + LEGEND_PADDING : 0
        )
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get labelFontSize(): number {
        const availableHeight =
            this.boundsWithoutColorLegend.height / this.barCount
        return Math.min(
            GRAPHER_FONT_SCALE_12 * this.fontSize,
            1.1 * availableHeight
        )
    }

    @computed private get legendLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return {
            fontSize: this.labelFontSize,
            fontWeight: 700,
        }
    }

    @computed private get valueLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return {
            fontSize: this.labelFontSize,
            fontWeight: 400,
        }
    }

    // Account for the width of the legend
    @computed private get seriesLegendWidth(): number {
        return _.max(this.sizedSeries.map((s) => s.label?.width ?? 0)) ?? 0
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
            this.boundsWithoutColorLegend.left +
                Math.max(this.seriesLegendWidth, this.leftValueLabelWidth),
            this.boundsWithoutColorLegend.right - this.rightValueLabelWidth,
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
        return this.boundsWithoutColorLegend
            .padLeft(Math.max(this.seriesLegendWidth, this.leftValueLabelWidth))
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

    // useful if `barHeight` can't be used due to a cyclic dependency
    // keep in mind though that this is not exactly the same as `barHeight`
    @computed private get approximateBarHeight(): number {
        const { height } = this.boundsWithoutColorLegend
        const approximateMaxBarHeight = height / this.barCount
        const approximateBarSpacing =
            approximateMaxBarHeight * BAR_SPACING_FACTOR
        const totalWhiteSpace = this.barCount * approximateBarSpacing
        return (height - totalWhiteSpace) / this.barCount
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
        exposeInstanceOnWindow(this)
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
                                    { textProps: style }
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
                            opacity={GRAPHER_AREA_OPACITY_DEFAULT}
                            style={{ transition: "height 200ms ease" }}
                        />
                    )
                })}
            </g>
        )
    }

    private renderDefs(): React.ReactElement | void {
        const projections = this.series.filter(
            (series) => series.yColumn.isProjection
        )
        const uniqProjections = _.uniqBy(projections, (series) => series.color)
        if (projections.length === 0) return

        return (
            <defs>
                {/* passed to the legend as pattern for the projected data legend item */}
                <StripedProjectedDataPattern
                    patternId={makeProjectedDataPatternId(
                        this.projectedDataColorInLegend
                    )}
                    color={this.projectedDataColorInLegend}
                />
                {/* make a pattern for every series with a unique color */}
                {uniqProjections.map((series) => (
                    <StripedProjectedDataPattern
                        key={series.color}
                        patternId={makeProjectedDataPatternId(series.color)}
                        color={series.color}
                    />
                ))}
            </defs>
        )
    }

    private renderChartArea(): React.ReactElement {
        const { yAxis, innerBounds } = this

        return (
            <>
                {this.renderDefs()}
                {this.showColorLegend && (
                    <HorizontalNumericColorLegend manager={this} />
                )}
                <HorizontalAxisZeroLine
                    horizontalAxis={yAxis}
                    bounds={innerBounds}
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

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return this.manager.isStatic ? (
            this.renderChartArea()
        ) : (
            <g
                ref={this.base}
                id={makeIdForHumanConsumption("discrete-bar-chart")}
                className="DiscreteBarChart"
            >
                {this.renderChartArea()}
            </g>
        )
    }

    formatValue(series: DiscreteBarSeries): Label {
        const { transformedTable } = this
        const { yColumn } = series

        const showYearLabels =
            this.manager.showYearLabels || series.time !== this.targetTime
        const valueString = yColumn.formatValueShort(series.value)
        let timeString = ""
        if (showYearLabels) {
            const { timeColumn } = transformedTable
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

    // Color legend props

    @computed private get hasColorLegend(): boolean {
        return this.chartState.hasColorScale || this.chartState.hasProjectedData
    }

    @computed private get showColorLegend(): boolean {
        return this.hasColorLegend && !!this.manager.showLegend
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get legendMaxWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    // TODO just pass colorScale to legend and let it figure it out?
    @computed get numericLegendData(): ColorScaleBin[] {
        const legendBins = this.chartState.colorScale.legendBins.slice()

        // Show a "Projected data" legend item with a striped pattern if appropriate
        if (this.chartState.hasProjectedData) {
            legendBins.push(
                new CategoricalBin({
                    color: this.projectedDataColorInLegend,
                    label: "Projected data",
                    index: 0,
                    value: "projected",
                    patternRef: makeProjectedDataPatternId(
                        this.projectedDataColorInLegend
                    ),
                })
            )
        }

        // Move CategoricalBins to end
        return _.sortBy(legendBins, (bin) => bin instanceof CategoricalBin)
    }

    @computed private get projectedDataColorInLegend(): string {
        // if a single color is in use, use that color in the legend
        if (_.uniqBy(this.series, "color").length === 1)
            return this.series[0].color
        return DEFAULT_PROJECTED_DATA_COLOR_IN_LEGEND
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (this.hasColorLegend) {
            return {
                numericLegendData: this.numericLegendData,
            }
        }
        return undefined
    }

    numericBinSize = 10
    numericBinStroke = BACKGROUND_COLOR
    numericBinStrokeWidth = 1
    legendTextColor = "#555"
    legendTickSize = 1

    @computed private get numericLegend():
        | HorizontalNumericColorLegend
        | undefined {
        return this.chartState.hasColorScale && this.manager.showLegend
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    @computed get numericLegendY(): number {
        return this.bounds.top
    }

    @computed get legendTitle(): string | undefined {
        return this.chartState.hasColorScale
            ? this.chartState.colorScale.legendDescription
            : undefined
    }

    @computed get legendHeight(): number {
        return this.numericLegend?.height ?? 0
    }

    // End of color legend props

    @computed private get series(): DiscreteBarSeries[] {
        return this.chartState.series
    }

    @computed private get sizedSeries(): DiscreteBarSeries[] {
        // can't use `this.barHeight` due to a circular dependency
        const barHeight = this.approximateBarHeight

        return this.series.map((series) => {
            // make sure we're dealing with a single-line text fragment
            const entityName = series.entityName.replace(/\n/g, " ").trim()

            const maxLegendWidth = 0.3 * this.boundsWithoutColorLegend.width

            let label = new TextWrap({
                text: entityName,
                maxWidth: maxLegendWidth,
                ...this.legendLabelStyle,
            })

            // prevent labels from being taller than the bar
            let step = 0
            while (
                label.height > barHeight &&
                label.lines.length > 1 &&
                step < 10 // safety net
            ) {
                label = new TextWrap({
                    text: entityName,
                    maxWidth: label.maxWidth + 20,
                    ...this.legendLabelStyle,
                })
                step += 1
            }

            // if the label is too long, use the short name instead
            const tooLong =
                label.width > SOFT_MAX_LABEL_WIDTH ||
                label.width > maxLegendWidth
            if (tooLong && series.shortEntityName) {
                label = new TextWrap({
                    text: series.shortEntityName,
                    maxWidth: label.maxWidth,
                    ...this.legendLabelStyle,
                })
            }

            return { ...series, label }
        })
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

function StripedProjectedDataPattern({
    patternId,
    color,
    opacity = 0.5,
    size = 7,
    strokeWidth = 10,
}: {
    patternId: string
    color: string
    opacity?: number
    size?: number
    strokeWidth?: number
}): React.ReactElement {
    return (
        <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={size}
            height={size}
            patternTransform="rotate(45)"
        >
            {/* semi-transparent background */}
            <rect width={size} height={size} fill={color} opacity={opacity} />

            {/* stripes */}
            <line
                x1="0"
                y1="0"
                x2="0"
                y2={size}
                stroke={color}
                strokeWidth={strokeWidth}
            />
        </pattern>
    )
}

// Pattern IDs should be unique per document (!), not just per grapher instance.
// Including the color in the id guarantees that the pattern uses the correct color,
// even if it gets resolved to a striped pattern of a different grapher instance.
function makeProjectedDataPatternId(color: string): string {
    return `DiscreteBarChart_stripes_${color}`
}
