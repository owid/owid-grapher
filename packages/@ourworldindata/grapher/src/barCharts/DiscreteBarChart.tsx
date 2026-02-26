import * as _ from "lodash-es"
import React from "react"
import { select } from "d3-selection"
import {
    exposeInstanceOnWindow,
    Bounds,
    Time,
    HorizontalAlign,
    AxisAlign,
    makeFigmaId,
    dyFromAlign,
} from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ScaleType, VerticalAlign } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_MUTE,
    FontSettings,
} from "../core/GrapherConstants"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { HorizontalAxisZeroLine } from "../axis/AxisViews"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import {
    BAR_SPACING_FACTOR,
    DiscreteBarChartManager,
    DiscreteBarSeries,
    PlacedDiscreteBarSeries,
    SizedDiscreteBarSeries,
} from "./DiscreteBarChartConstants"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import {
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../legend/HorizontalColorLegends"
import { DiscreteBarChartState } from "./DiscreteBarChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import {
    makeProjectedDataPatternId,
    enrichSeriesWithLabels,
} from "./DiscreteBarChartHelpers"
import { SeriesLabel } from "../seriesLabel/SeriesLabel.js"
import { OwidTable } from "@ourworldindata/core-table"
import { HorizontalAxis } from "../axis/Axis"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import type { BaseType, Selection } from "d3-selection"
import { NUMERIC_LEGEND_STYLE } from "../lineCharts/LineChartConstants"
import { HashMap, NodeGroup } from "react-move"
import { easeQuadOut } from "d3-ease"

const DEFAULT_PROJECTED_DATA_COLOR_IN_LEGEND = "#787878"

/** The gap between the entity label and the bar */
const GAP__ENTITY_LABEL__BAR = 5

/** The gap between the the entity label and negative value label */
const GAP__ENTITY_LABEL__VALUE_LABEL = 10

/** The vertical padding between the entity label and the annotation */
const ANNOTATION_PADDING = 2

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

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padRight(10)
    }

    @computed private get targetTime(): Time | undefined {
        return this.manager.endTime
    }

    @computed private get legendPadding(): number {
        return 0.5 * this.legendHeight
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get barCount(): number {
        return this.series.length
    }

    @computed private get labelFontSize(): number {
        const availableHeight = this.bounds.height / this.barCount
        return Math.min(
            GRAPHER_FONT_SCALE_12 * this.fontSize,
            1.1 * availableHeight
        )
    }

    @computed private get entityLabelStyle(): FontSettings {
        return {
            fontSize: this.labelFontSize,
            fontWeight: 700,
            lineHeight: 1,
        }
    }

    @computed private get entityAnnotationStyle(): FontSettings {
        return {
            fontSize: this.labelFontSize * 0.9,
            fontWeight: 300,
            lineHeight: 1,
        }
    }

    @computed get sizedSeries(): SizedDiscreteBarSeries[] {
        return enrichSeriesWithLabels({
            series: this.series,
            availableHeightPerSeries: this.bounds.height / this.barCount,
            minLabelWidth: 0.3 * this.bounds.width,
            maxLabelWidth: 0.66 * this.bounds.width,
            fontSettings: this.entityLabelStyle,
            annotationFontSettings: this.entityAnnotationStyle,
            showRegionTooltip: !this.manager.isStatic,
        })
    }

    @computed private get valueLabelStyle(): FontSettings {
        return { fontSize: this.labelFontSize, fontWeight: 400, lineHeight: 1 }
    }

    @computed private get hasPositive(): boolean {
        return this.series.some((d) => d.value >= 0)
    }

    @computed private get hasNegative(): boolean {
        return this.series.some((d) => d.value < 0)
    }

    // The amount of space we need to allocate for bar end labels on the right
    @computed private get rightValueLabelsWidth(): number {
        if (!this.hasPositive) return 0

        const labelsWidths = this.series
            .filter((series) => series.value >= 0)
            .map((series) => this.formatValue(series).width)

        return _.max(labelsWidths) ?? 0
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
        return this.innerBounds.xRange()
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
        axis.formatColumn = this.chartState.formatColumn
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    /**
     * The maximum width needed for labels positioned on the left side of the chart.
     *
     * For positive values, returns the width of entity labels and annotations.
     * For negative values, returns the entity label width, annotation width, value label width
     * and the padding between them.
     */
    @computed private get leftLabelsWidth(): number {
        const labelWidths = this.sizedSeries.map((series) => {
            const labelWidth = series.label?.width ?? 0
            const annotationWidth = series.annotationTextWrap?.width ?? 0

            // Use the maximum width between label and annotation
            const textWidth = Math.max(labelWidth, annotationWidth)

            if (series.value < 0) {
                const valueWidth = this.formatValue(series).width
                return textWidth + valueWidth + GAP__ENTITY_LABEL__VALUE_LABEL
            } else {
                return textWidth
            }
        })

        return _.max(labelWidths) ?? 0
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padTop(
                this.showColorLegend
                    ? this.legendHeight + this.legendPadding
                    : 0
            )
            .padLeft(this.leftLabelsWidth)
            .padRight(this.rightValueLabelsWidth)
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
                ? barX - label.width - GAP__ENTITY_LABEL__VALUE_LABEL
                : barX - GAP__ENTITY_LABEL__BAR
            const valueLabelX =
                this.yAxis.place(series.value) +
                (isNegative ? -GAP__ENTITY_LABEL__BAR : GAP__ENTITY_LABEL__BAR)

            const annotationHeight = series.annotationTextWrap
                ? ANNOTATION_PADDING + series.annotationTextWrap.height
                : 0
            const totalLabelHeight = series.label.height + annotationHeight

            const entityLabelY = barY - totalLabelHeight / 2
            const annotationY = series.annotationTextWrap
                ? entityLabelY + series.label.height + ANNOTATION_PADDING
                : undefined

            return {
                ...series,
                barX,
                barY,
                barWidth,
                entityLabelX,
                entityLabelY,
                annotationY,
                valueLabelX,
            }
        })
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    private d3Bars(): Selection<
        BaseType,
        unknown,
        SVGGElement | null,
        unknown
    > {
        return select(this.base.current).selectAll("rect.bar")
    }

    private animateBarWidth(): void {
        this.d3Bars()
            .transition()
            .attr("width", (_, i) => this.barWidths[i])
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

    private renderBar({
        series,
        barY,
        yOffset,
    }: {
        series: PlacedDiscreteBarSeries
        barY: number
        yOffset: number
    }): React.ReactElement {
        const barColor = series.isProjection
            ? `url(#${makeProjectedDataPatternId(series.color)})`
            : series.color

        return (
            <rect
                key={`bar-${series.seriesName}`}
                className="bar"
                id={makeFigmaId(series.seriesName)}
                x={0}
                y={0}
                transform={`translate(${series.barX}, ${barY + yOffset})`}
                width={series.barWidth}
                height={this.barHeight}
                fill={barColor}
                opacity={
                    series.focus.background
                        ? GRAPHER_AREA_OPACITY_MUTE
                        : GRAPHER_AREA_OPACITY_DEFAULT
                }
                style={{ transition: "height 200ms ease" }}
            />
        )
    }

    private renderEntityLabel({
        series,
        barY,
        labelY,
    }: {
        series: PlacedDiscreteBarSeries
        barY: number
        labelY: number
    }): React.ReactElement | null {
        if (!series.label) return null

        const opacity = series.focus.background ? GRAPHER_AREA_OPACITY_MUTE : 1

        return (
            <SeriesLabel
                state={series.label}
                x={series.entityLabelX}
                y={barY + labelY}
                opacity={opacity}
            />
        )
    }

    private renderEntityAnnotation({
        series,
        barY,
        annotationY,
    }: {
        series: PlacedDiscreteBarSeries
        barY: number
        annotationY: number | undefined
    }): React.ReactElement | null {
        if (!series.annotationTextWrap || annotationY === undefined) {
            return null
        }

        return (
            <g key={`annotation-${series.seriesName}`}>
                {series.annotationTextWrap.renderSVG(
                    series.entityLabelX,
                    barY + annotationY,
                    {
                        textProps: {
                            fill: "#333",
                            textAnchor: "end",
                            opacity: series.focus.background
                                ? GRAPHER_AREA_OPACITY_MUTE
                                : 1,
                        },
                    }
                )}
            </g>
        )
    }

    private renderValueLabel({
        series,
        label,
        barY,
        labelY,
    }: {
        series: PlacedDiscreteBarSeries
        label: Label
        barY: number
        labelY: number
    }): React.ReactElement {
        return (
            <text
                key={`value-label-${series.seriesName}`}
                x={0}
                y={0}
                transform={`translate(${series.valueLabelX}, ${barY + labelY})`}
                fill={GRAPHER_DARK_TEXT}
                dy={dyFromAlign(VerticalAlign.middle)}
                textAnchor={series.value < 0 ? "end" : "start"}
                opacity={
                    series.focus.background ? GRAPHER_AREA_OPACITY_MUTE : 1
                }
                fontSize={this.valueLabelStyle.fontSize}
                fontWeight={this.valueLabelStyle.fontWeight}
            >
                {label.valueString}
                <tspan fill="#999">{label.timeString}</tspan>
            </text>
        )
    }

    private renderBars(): React.ReactElement {
        const yOffset = -this.barHeight / 2
        return (
            <g id={makeFigmaId("bars")}>
                {this.placedSeries.map((series) =>
                    this.renderBar({ series, barY: series.barY, yOffset })
                )}
            </g>
        )
    }

    private renderEntityLabels(): React.ReactElement {
        return (
            <g id={makeFigmaId("entity-labels")}>
                {this.placedSeries.map((series) => {
                    const labelY = series.entityLabelY - series.barY
                    return (
                        <React.Fragment
                            key={`entity-label-${series.seriesName}`}
                        >
                            {this.renderEntityLabel({
                                series,
                                barY: series.barY,
                                labelY,
                            })}
                        </React.Fragment>
                    )
                })}
            </g>
        )
    }

    private renderEntityAnnotations(): React.ReactElement | null {
        const hasAnnotations = this.placedSeries.some(
            (series) =>
                series.annotationTextWrap && series.annotationY !== undefined
        )

        if (!hasAnnotations) return null

        return (
            <g id={makeFigmaId("entity-annotations")}>
                {this.placedSeries.map((series) => {
                    const annotationY = series.annotationY
                        ? series.annotationY - series.barY
                        : undefined
                    return this.renderEntityAnnotation({
                        series,
                        barY: series.barY,
                        annotationY,
                    })
                })}
            </g>
        )
    }

    private renderValueLabels(): React.ReactElement {
        return (
            <g id={makeFigmaId("value-labels")}>
                {this.placedSeries.map((series) => {
                    const label = this.formatValue(series)
                    const labelY = 0 // Value label is centered on the bar
                    return this.renderValueLabel({
                        series,
                        label,
                        barY: series.barY,
                        labelY,
                    })
                })}
            </g>
        )
    }

    private renderDefs(): React.ReactElement | null {
        const projections = this.series.filter((series) => series.isProjection)
        const uniqProjections = _.uniqBy(projections, (series) => series.color)
        if (projections.length === 0) return null

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

    private renderRow({
        series,
        state,
    }: {
        series: PlacedDiscreteBarSeries
        state: { translateY: number }
    }): React.ReactElement {
        return (
            <g
                key={`row-${series.seriesName}`}
                className="bar-row"
                transform={`translate(0, ${state.translateY})`}
            >
                {this.renderBar({
                    series,
                    barY: 0,
                    yOffset: -this.barHeight / 2,
                })}
                {this.renderEntityLabel({
                    series,
                    barY: 0,
                    labelY: series.entityLabelY - series.barY,
                })}
                {this.renderEntityAnnotation({
                    series,
                    barY: 0,
                    annotationY: series.annotationY
                        ? series.annotationY - series.barY
                        : undefined,
                })}
                {this.renderValueLabel({
                    series,
                    label: this.formatValue(series),
                    barY: 0,
                    labelY: 0,
                })}
            </g>
        )
    }

    private renderAnimatedBars(): React.ReactElement {
        const handlePositionUpdate = (d: PlacedDiscreteBarSeries): HashMap => ({
            translateY: [d.barY],
            timing: { duration: 350, ease: easeQuadOut },
        })

        return (
            <NodeGroup
                data={this.placedSeries}
                keyAccessor={(d: PlacedDiscreteBarSeries): string =>
                    d.seriesName
                }
                start={handlePositionUpdate}
                update={handlePositionUpdate}
            >
                {(nodes): React.ReactElement => (
                    <g id={makeFigmaId("bar-rows")}>
                        {nodes.map((node) =>
                            this.renderRow({
                                series: node.data,
                                state: node.state,
                            })
                        )}
                    </g>
                )}
            </NodeGroup>
        )
    }

    private renderLegend(): React.ReactElement | null {
        if (!this.showColorLegend) return null

        return <HorizontalNumericColorLegend manager={this} />
    }

    private renderAxis(): React.ReactElement {
        return (
            <HorizontalAxisZeroLine
                horizontalAxis={this.yAxis}
                bounds={this.innerBounds}
                strokeWidth={0.5}
                // If the chart doesn't have negative values, then we
                // move the zero line a little to the left to avoid
                // overlap with the bars
                align={
                    this.hasNegative
                        ? HorizontalAlign.center
                        : HorizontalAlign.right
                }
            />
        )
    }

    private renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderDefs()}
                {this.renderLegend()}
                {this.renderAxis()}
                {this.renderBars()}
                {this.renderValueLabels()}
                {this.renderEntityLabels()}
                {this.renderEntityAnnotations()}
            </>
        )
    }

    private renderInteractive(): React.ReactElement {
        return (
            <g
                ref={this.base}
                id={makeFigmaId("discrete-bar-chart")}
                className="DiscreteBarChart"
            >
                {this.renderDefs()}
                {this.renderLegend()}
                {this.renderAxis()}
                {this.renderAnimatedBars()}
            </g>
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

        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
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

    // Used when the bars are colored by a numeric scale
    numericLegendStyleConfig = NUMERIC_LEGEND_STYLE

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (this.hasColorLegend) {
            return {
                numericLegendData: this.numericLegendData,
                numericLegendStyleConfig: this.numericLegendStyleConfig,
            }
        }
        return undefined
    }

    @computed get numericBinSize(): number {
        return 0.625 * this.fontSize
    }

    legendTickSize = 1

    @computed private get numericLegend():
        | HorizontalNumericColorLegend
        | undefined {
        return this.manager.showLegend
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
