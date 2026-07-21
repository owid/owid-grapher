import * as _ from "lodash-es"
import { scalePoint } from "d3-scale"
import React from "react"
import { match } from "ts-pattern"
import {
    Bounds,
    HorizontalAlign,
    makeFigmaId,
    exposeInstanceOnWindow,
    ScaleType,
    formatValue,
    getRelativeMouse,
    guid,
    Pair,
} from "@ourworldindata/utils"
import {
    DumbbellValueLabelMode,
    TickFormattingOptions,
} from "@ourworldindata/types"
import { action, computed, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
    FontSettings,
} from "../core/GrapherConstants"
import {
    enrichSeriesWithLabels,
    computeCenteredLabelYPositions,
} from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
    HorizontalAxisZeroLine,
} from "../axis/AxisViews"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { HorizontalAxis } from "../axis/Axis"
import { ChartInterface } from "../chart/ChartInterface"
import {
    DumbbellChartManager,
    DumbbellMode,
    DumbbellSeries,
    SizedDumbbellSeries,
    PlacedDumbbellSeries,
    RenderDumbbellSeries,
    VALUE_LABEL_DOT_GAP,
    ENTITY_LABEL_CHART_GAP,
    DumbbellValueLabel,
    TOP_LEGEND_BOTTOM_PADDING,
    LegendLabel,
    PlacedDumbbellHead,
    MIN_LEGEND_LABEL_GAP,
} from "./DumbbellChartConstants"
import { DumbbellChartState } from "./DumbbellChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap"
import { resolveEmphasis } from "../interaction/Emphasis"
import { InteractionState } from "../interaction/InteractionState"
import { DumbbellChartRow } from "./DumbbellChartRow"
import {
    AxisLayout,
    calculateAxisLayout,
    computePercentChange,
} from "./DumbbellChartHelpers"
import { AnimatedRows } from "../animation/AnimatedRows"
import { roundFontSize, textWidth } from "../chart/ChartUtils.js"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { darkenColorForText } from "../color/ColorUtils.js"
import { HorizontalLabelPair } from "../horizontalLabelPair/HorizontalLabelPair.js"
import { HorizontalLabelPairState } from "../horizontalLabelPair/HorizontalLabelPairState.js"
import { HorizontalLabel } from "../horizontalLabelPair/HorizontalLabelPairTypes.js"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../legend/HorizontalColorLegends.js"
import { CategoricalBin } from "../color/ColorScaleBin.js"
import { TooltipState } from "../tooltip/Tooltip"
import {
    DumbbellTimeRangeTooltip,
    DumbbellTwoColumnTooltip,
} from "./DumbbellTooltips.js"

export type DumbbellChartProps = ChartComponentProps<DumbbellChartState>

type TopLegendType = "inline" | "swatches" | "none"

@observer
export class DumbbellChart
    extends React.Component<DumbbellChartProps>
    implements ChartInterface, AxisManager, HorizontalColorLegendManager
{
    private readonly tooltipId = guid()
    private readonly tooltipState = new TooltipState<{ seriesName: string }>({
        fade: "immediate",
    })

    constructor(props: DumbbellChartProps) {
        super(props)
        makeObservable<DumbbellChart, "tooltipState">(this, {
            tooltipState: observable,
        })
    }

    @computed get chartState(): DumbbellChartState {
        return this.props.chartState
    }

    @computed private get manager(): DumbbellChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        // 2px padding at the bottom prevents the tick labels from overflowing
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padBottom(2)
    }

    @computed private get boundsWithoutLegend(): Bounds {
        return this.bounds.padTop(this.topLegendHeightWithPadding)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get series(): DumbbellSeries[] {
        return this.chartState.series
    }

    @computed private get availableHeightPerSeries(): number {
        return this.boundsWithoutLegend.height / this.series.length
    }

    @computed private get entityLabelStyle(): FontSettings {
        // Slightly overestimates the height available for a series
        // because `bounds` is used instead of `boundsWithoutLegend`
        // due to a circular dependency
        const availableHeightPerSeries = this.bounds.height / this.series.length

        const fontSize = roundFontSize(
            Math.min(
                GRAPHER_FONT_SCALE_12 * this.fontSize,
                availableHeightPerSeries
            )
        )

        return { fontSize, fontWeight: 700, lineHeight: 1 }
    }

    @computed private get valueLabelStyle(): FontSettings {
        const fontSize = this.entityLabelStyle.fontSize - 0.5

        return { fontSize, fontWeight: 400, lineHeight: 1 }
    }

    @computed private get inlineLegendLabelStyle(): FontSettings {
        return {
            fontSize: this.valueLabelStyle.fontSize,
            fontWeight: 700,
            lineHeight: 1,
        }
    }

    private buildValueLabel(text: string): DumbbellValueLabel {
        return {
            text,
            width: textWidth(text, this.valueLabelStyle),
            padding:
                this.chartState.mode === DumbbellMode.TimeRange
                    ? VALUE_LABEL_DOT_GAP
                    : VALUE_LABEL_DOT_GAP + this.dumbbellHeadRadius,
        }
    }

    private getValueLabels(
        startValue: number,
        endValue: number
    ): { start?: string; end?: string } {
        return match(this.chartState.valueLabelMode)
            .with(DumbbellValueLabelMode.Absolute, () => {
                // Only show one label if the values are the same
                if (
                    this.chartState.mode === DumbbellMode.TimeRange &&
                    startValue === endValue
                ) {
                    return { start: this.formatValue(startValue) }
                }

                return {
                    start: this.formatValue(startValue),
                    end: this.formatValue(endValue),
                }
            })
            .with(DumbbellValueLabelMode.Change, () => {
                const diff = endValue - startValue
                return { end: this.formatValue(diff, { showPlus: true }) }
            })
            .with(DumbbellValueLabelMode.PercentChange, () => {
                const change = computePercentChange(startValue, endValue)
                if (change === undefined) return {}
                return {
                    end: formatValue(change, {
                        showPlus: true,
                        unit: "%",
                        numDecimalPlaces: 1,
                    }),
                }
            })
            .with(DumbbellValueLabelMode.None, () => ({}))
            .exhaustive()
    }

    @computed get sizedSeries(): SizedDumbbellSeries[] {
        return enrichSeriesWithLabels({
            series: this.series,
            availableHeightPerSeries: this.availableHeightPerSeries,
            minLabelWidth: 0.3 * this.bounds.width,
            maxLabelWidth: 0.66 * this.bounds.width,
            fontSettings: this.entityLabelStyle,
            showRegionTooltip: !this.manager.isStatic,
        }).map((series) => {
            const { start, end } = this.getValueLabels(
                series.start.value,
                series.end.value
            )

            const startLabel = start ? this.buildValueLabel(start) : undefined
            const endLabel = end ? this.buildValueLabel(end) : undefined

            return {
                ...series,
                start: {
                    ...series.start,
                    label: startLabel,
                    radius: this.dumbbellHeadRadius,
                },
                end: {
                    ...series.end,
                    label: endLabel,
                    radius: this.dumbbellHeadRadius,
                },
            }
        })
    }

    @computed private get xRange(): [number, number] {
        return this.dataBounds.xRange()
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                ...this.manager.yAxisConfig,
                hideGridlines: false,
                shouldOffsetTickLabelAtStart: false,
            },
            this
        )
    }

    private toHorizontalAxis(args?: { skipRange: boolean }): HorizontalAxis {
        const axis = this.yAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.axisLayout.domain)
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.chartState.formatColumn
        if (!args?.skipRange) axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed get axisHeight(): number {
        // We can't use this.axis due to a circular dependency
        return this.toHorizontalAxis({ skipRange: true }).height
    }

    @computed get axis(): HorizontalAxis {
        return this.toHorizontalAxis()
    }

    @computed private get verticalScale() {
        return scalePoint<string>()
            .domain(this.series.map((s) => s.seriesName))
            .range([this.innerBounds.top, this.innerBounds.bottom])
            .padding(0.5)
    }

    /**
     * Ensures every row's value labels fit inside the chart area by adjusting
     * the axis domain and/or adding padding
     */
    @computed private get axisLayout(): AxisLayout {
        const [configMin, configMax] = this.yAxisConfig.domain

        const axis = this.yAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.chartState.yDomainDefault)

        return calculateAxisLayout({
            series: this.sizedSeries,
            domain: axis.domain,
            width: this.axisBounds.width,
            minFixed: Number.isFinite(configMin),
            maxFixed: Number.isFinite(configMax),
        })
    }

    @computed private get entityLabelMaxWidth(): number {
        const labelsWidths = this.sizedSeries.flatMap((series) => [
            series.label?.width ?? 0,
            series.annotationTextWrap?.width ?? 0,
        ])
        if (labelsWidths.length === 0) return 0
        return Math.max(...labelsWidths)
    }

    /** Bounds minus entity labels */
    @computed get axisBounds(): Bounds {
        return this.boundsWithoutLegend.padLeft(
            this.entityLabelMaxWidth + ENTITY_LABEL_CHART_GAP
        )
    }

    @computed private get innerBounds(): Bounds {
        return this.axisBounds.padBottom(this.axisHeight)
    }

    /** Bounds for plotting data points */
    @computed private get dataBounds(): Bounds {
        return this.innerBounds.pad(this.axisLayout.pad)
    }

    @computed private get dumbbellHeadRadius(): number {
        const valueLabelHeight =
            this.valueLabelStyle.fontSize * this.valueLabelStyle.lineHeight

        // Cap the radius based on the value label's height
        const maxRadius = roundToNearestHalf((valueLabelHeight / 2) * 1.1)

        return _.clamp(
            Math.floor(this.availableHeightPerSeries / 2),
            2,
            maxRadius
        )
    }

    @computed private get placedSeries(): PlacedDumbbellSeries[] {
        return this.sizedSeries
            .map((series) => {
                const centerY = this.verticalScale(series.seriesName)
                const labelX = this.innerBounds.x - ENTITY_LABEL_CHART_GAP

                if (centerY === undefined) return undefined

                const { labelY, annotationY } = computeCenteredLabelYPositions({
                    y: centerY,
                    label: series.label,
                    annotation: series.annotationTextWrap,
                })

                const labelPosition = { x: labelX, yOffset: labelY - centerY }
                const annotationPosition =
                    annotationY !== undefined
                        ? { x: labelX, yOffset: annotationY - centerY }
                        : undefined

                return {
                    ...series,
                    y: centerY,
                    labelPosition,
                    annotationPosition,
                    start: {
                        ...series.start,
                        x: this.axis.place(series.start.value),
                    },
                    end: {
                        ...series.end,
                        x: this.axis.place(series.end.value),
                    },
                }
            })
            .filter((series) => series !== undefined)
    }

    @computed private get hoveredSeriesName(): string | undefined {
        return this.tooltipState.target?.seriesName
    }

    @computed private get renderSeries(): RenderDumbbellSeries[] {
        return this.placedSeries.map((series) => {
            const hover = InteractionState.for(
                series.seriesName,
                this.hoveredSeriesName
            )
            const emphasis = resolveEmphasis({ hover, focus: series.focus })
            return { ...series, emphasis }
        })
    }

    @computed get legendLabels():
        | { start: LegendLabel; end: LegendLabel }
        | undefined {
        const { showLegend = true } = this.manager

        if (!showLegend || this.series.length === 0) return undefined

        return (
            match(this.chartState.mode)
                // In time-range mode, the legend labels are the start and end times
                .with(DumbbellMode.TimeRange, () => {
                    const { formatColumn, startTime, endTime } = this.chartState
                    return {
                        start: {
                            text: formatColumn.formatTime(startTime),
                            color: GRAPHER_LIGHT_TEXT,
                        } satisfies LegendLabel,
                        end: {
                            text: formatColumn.formatTime(endTime),
                            color: GRAPHER_LIGHT_TEXT,
                        } satisfies LegendLabel,
                    }
                })
                // In two-column mode, the legend labels are the two columns
                .with(DumbbellMode.TwoColumn, () => {
                    const { yColumns, columnColors } = this.chartState
                    const [startColumn, endColumn] = yColumns
                    if (!startColumn || !endColumn) return undefined
                    return {
                        start: {
                            text: startColumn.nonEmptyDisplayName,
                            color: darkenColorForText(columnColors.start),
                        } satisfies LegendLabel,
                        end: {
                            text: endColumn.nonEmptyDisplayName,
                            color: darkenColorForText(columnColors.end),
                        } satisfies LegendLabel,
                    }
                })
                .exhaustive()
        )
    }

    /** Whether the inline legend labels can fit side by side */
    @computed private get inlineLegendFits(): boolean {
        if (!this.legendLabels) return false
        const { start, end } = this.legendLabels
        // We can't use `inlineLegendState.hasOverlap` here due to a circular dependency
        const labelWidths =
            textWidth(start.text, this.inlineLegendLabelStyle) +
            textWidth(end.text, this.inlineLegendLabelStyle)
        return labelWidths + MIN_LEGEND_LABEL_GAP <= this.bounds.width
    }

    @computed private get topLegendType(): TopLegendType {
        if (!this.legendLabels) return "none"
        if (this.inlineLegendFits) return "inline"
        // In two-column mode, fall back to a categorical legend when the inline
        // labels don't fit. In time-range mode, no legend is shown in that case.
        return this.chartState.mode === DumbbellMode.TimeRange
            ? "none"
            : "swatches"
    }

    @computed private get topLegendHeight(): number {
        return match(this.topLegendType)
            .with(
                "inline",
                () =>
                    this.inlineLegendLabelStyle.fontSize *
                    this.inlineLegendLabelStyle.lineHeight
            )
            .with("swatches", () => this.categoricalLegend.height)
            .with("none", () => 0)
            .exhaustive()
    }

    @computed private get topLegendHeightWithPadding(): number {
        return this.topLegendHeight
            ? this.topLegendHeight + TOP_LEGEND_BOTTOM_PADDING
            : 0
    }

    @computed private get inlineLegendSeries():
        | Pair<HorizontalLabel>
        | undefined {
        const { legendLabels, topLegendType } = this

        if (!legendLabels || topLegendType !== "inline") return undefined

        const sortedSeries = _.sortBy(this.placedSeries, (series) => series.y)

        const topSeries = match(this.chartState.mode)
            // In time-range mode, anchor to the top-most series so the
            // legend labels align with its value labels
            .with(DumbbellMode.TimeRange, () => sortedSeries[0])
            // In two-column mode, anchor to the top-most series that has a
            // visible change
            .with(
                DumbbellMode.TwoColumn,
                () =>
                    sortedSeries.find((s) => s.start.x !== s.end.x) ??
                    sortedSeries[0]
            )
            .exhaustive()

        if (!topSeries) return undefined

        const resolveTextAnchor = ({
            head,
            otherHead,
        }: {
            head: PlacedDumbbellHead
            otherHead: PlacedDumbbellHead
        }): HorizontalAlign =>
            head.x <= otherHead.x ? HorizontalAlign.right : HorizontalAlign.left

        const offset = (textAnchor: HorizontalAlign): number =>
            match(this.chartState.mode)
                // In time-range mode, shift labels outward by the same gap
                // as the value labels so both align perfectly
                .with(DumbbellMode.TimeRange, () =>
                    textAnchor === HorizontalAlign.right
                        ? -VALUE_LABEL_DOT_GAP
                        : VALUE_LABEL_DOT_GAP
                )
                // In two-column mode, shift labels inward by a bit
                .with(DumbbellMode.TwoColumn, () => {
                    const magnitude = Math.min(
                        20,
                        Math.floor(
                            Math.abs(topSeries.end.x - topSeries.start.x) / 4
                        )
                    )
                    return textAnchor === HorizontalAlign.right
                        ? magnitude
                        : -magnitude
                })
                .exhaustive()

        const startAnchor = resolveTextAnchor({
            head: topSeries.start,
            otherHead: topSeries.end,
        })
        const endAnchor = resolveTextAnchor({
            head: topSeries.end,
            otherHead: topSeries.start,
        })

        return [
            {
                text: legendLabels.start.text,
                x: topSeries.start.x + offset(startAnchor),
                color: legendLabels.start.color,
                textAnchor: startAnchor,
            },
            {
                text: legendLabels.end.text,
                x: topSeries.end.x + offset(endAnchor),
                color: legendLabels.end.color,
                textAnchor: endAnchor,
            },
        ]
    }

    @computed private get inlineLegendState():
        | HorizontalLabelPairState
        | undefined {
        if (!this.inlineLegendSeries) return undefined

        return new HorizontalLabelPairState(this.inlineLegendSeries, {
            xRange: [this.bounds.left, this.bounds.right],
            fontSettings: this.inlineLegendLabelStyle,
            minGap: MIN_LEGEND_LABEL_GAP,
        })
    }

    @computed get legendX(): number {
        return this.bounds.left
    }

    @computed get categoryLegendY(): number {
        return this.bounds.top
    }

    @computed get legendWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.left
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        if (!this.legendLabels || this.topLegendType !== "swatches") return []
        const { start, end } = this.legendLabels
        return [
            new CategoricalBin({
                index: 0,
                value: start.text,
                label: start.text,
                color: start.color,
            }),
            new CategoricalBin({
                index: 1,
                value: end.text,
                label: end.text,
                color: end.color,
            }),
        ]
    }

    @computed
    private get categoricalLegend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    private formatValue(
        value: number,
        options?: TickFormattingOptions
    ): string {
        return this.chartState.formatColumn.formatValueShort(value, options)
    }

    @action.bound private dismissTooltip(): void {
        this.tooltipState.target = null
    }

    @action.bound private onSeriesMouseEnter(
        seriesName: string,
        event: React.MouseEvent<SVGElement>
    ): void {
        this.chartState.focusArray.clear()
        this.updateTooltipPosition(event)
        this.tooltipState.target = { seriesName }
    }

    @action.bound private onSeriesMouseMove(
        event: React.MouseEvent<SVGElement>
    ): void {
        this.updateTooltipPosition(event)
    }

    @action.bound private onSeriesMouseLeave(): void {
        this.tooltipState.target = null
    }

    private updateTooltipPosition(event: React.MouseEvent<SVGElement>): void {
        const ref = this.manager.base?.current
        if (ref) this.tooltipState.position = getRelativeMouse(ref, event)
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    private renderLegend(): React.ReactElement | null {
        return match(this.topLegendType)
            .with("swatches", () => (
                <HorizontalCategoricalColorLegend manager={this} />
            ))
            .with("inline", () =>
                this.inlineLegendState ? (
                    <HorizontalLabelPair
                        state={this.inlineLegendState}
                        y={this.bounds.top}
                    />
                ) : null
            )
            .with("none", () => null)
            .exhaustive()
    }

    private renderStatic(): React.ReactElement {
        return (
            <>
                <DumbbellChartAxis
                    bounds={this.boundsWithoutLegend}
                    dataBounds={this.dataBounds}
                    axis={this.axis}
                />
                <g id={makeFigmaId("rows")}>
                    {this.renderSeries.map((series) => (
                        <DumbbellChartRow
                            key={series.seriesName}
                            series={series}
                            mode={this.chartState.mode}
                            connectorStyle={this.chartState.connectorStyle}
                            range={this.xRange}
                            valueLabelStyle={this.valueLabelStyle}
                            y={series.y}
                        />
                    ))}
                </g>
                {this.renderLegend()}
            </>
        )
    }

    private renderInteractive(): React.ReactElement {
        const { xRange, valueLabelStyle } = this
        const { mode, connectorStyle } = this.chartState

        return (
            <g>
                <DumbbellChartAxis
                    bounds={this.boundsWithoutLegend}
                    dataBounds={this.dataBounds}
                    axis={this.axis}
                />
                <g className="hover-areas">
                    {this.placedSeries.map((series) => (
                        <DumbbellHoverArea
                            key={series.seriesName}
                            series={series}
                            height={this.availableHeightPerSeries}
                            containerBounds={this.boundsWithoutLegend}
                            onMouseEnter={this.onSeriesMouseEnter}
                            onMouseMove={this.onSeriesMouseMove}
                            onMouseLeave={this.onSeriesMouseLeave}
                        />
                    ))}
                </g>
                <AnimatedRows
                    items={this.renderSeries}
                    keyAccessor={(d: RenderDumbbellSeries): string =>
                        d.seriesName
                    }
                    getY={(d: RenderDumbbellSeries): number => d.y}
                    renderRow={(series): React.ReactElement => (
                        <DumbbellChartRow
                            key={series.seriesName}
                            series={series}
                            mode={mode}
                            connectorStyle={connectorStyle}
                            range={xRange}
                            valueLabelStyle={valueLabelStyle}
                            y={0}
                            onInfoTooltipShow={this.dismissTooltip}
                        />
                    )}
                />
                {this.renderLegend()}
                {this.chartState.mode === DumbbellMode.TimeRange ? (
                    <DumbbellTimeRangeTooltip
                        id={this.tooltipId}
                        chartState={this.chartState}
                        tooltipState={this.tooltipState}
                        series={this.sizedSeries}
                        dismissTooltip={this.dismissTooltip}
                    />
                ) : (
                    <DumbbellTwoColumnTooltip
                        id={this.tooltipId}
                        chartState={this.chartState}
                        tooltipState={this.tooltipState}
                        series={this.sizedSeries}
                        dismissTooltip={this.dismissTooltip}
                    />
                )}
            </g>
        )
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataMessage
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }
}

function DumbbellChartAxis({
    axis,
    bounds,
    dataBounds,
}: {
    axis: HorizontalAxis
    bounds: Bounds
    dataBounds: Bounds
}): React.ReactElement {
    return (
        <>
            <HorizontalAxisComponent
                bounds={bounds}
                axis={axis}
                tickColor={GRAPHER_LIGHT_TEXT}
            />
            <HorizontalAxisGridLines bounds={dataBounds} axis={axis} />
            {axis.contains(0) && (
                <HorizontalAxisZeroLine
                    bounds={dataBounds}
                    axis={axis}
                    color="#999"
                />
            )}
        </>
    )
}

function DumbbellHoverArea({
    series,
    height,
    maxHeight = 60,
    containerBounds,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
}: {
    series: PlacedDumbbellSeries
    height: number
    maxHeight?: number
    containerBounds: Bounds
    onMouseEnter: (seriesName: string, ev: React.MouseEvent<SVGElement>) => void
    onMouseMove: (ev: React.MouseEvent<SVGElement>) => void
    onMouseLeave: () => void
}): React.ReactElement {
    const cappedHeight = Math.min(height, maxHeight)
    return (
        <rect
            x={containerBounds.left}
            y={series.y - cappedHeight / 2}
            width={containerBounds.width}
            height={cappedHeight}
            fill="transparent"
            onMouseEnter={(ev) => onMouseEnter(series.seriesName, ev)}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
        />
    )
}

function roundToNearestHalf(value: number): number {
    return Math.round(value * 2) / 2
}
