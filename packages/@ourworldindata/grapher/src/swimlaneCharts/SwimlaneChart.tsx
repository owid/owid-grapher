import React from "react"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import { scalePoint, ScalePoint } from "d3-scale"
import { SeriesName, SwimlaneSegmentLabelMode } from "@ourworldindata/types"
import {
    Bounds,
    excludeUndefined,
    exposeInstanceOnWindow,
    getRelativeMouse,
    guid,
    makeFigmaId,
    HorizontalAlign,
} from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    FontSettings,
    makePatternId,
    Patterns,
} from "../core/GrapherConstants"
import { AnimatedRows } from "../animation/AnimatedRows"
import { enrichSeriesWithLabels } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import {
    HorizontalAxisComponent,
    HorizontalAxisDomainLine,
    SOLID_TICK_COLOR,
} from "../axis/AxisViews"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { HorizontalAxis } from "../axis/Axis"
import { ChartInterface } from "../chart/ChartInterface"
import { TooltipState } from "../tooltip/Tooltip"
import { roundFontSize, scaleFontSize } from "../chart/ChartUtils"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { ChartComponentProps } from "../chart/ChartTypeMap"
import {
    CategoricalBin,
    ColorScaleBin,
    addPatternRefToBin,
    isCategoricalBin,
    isNoDataBin,
    mergeCategoricalBinsByLabelAndColor,
} from "../color/ColorScaleBin"
import { HorizontalCategoricalColorLegend } from "../legend/HorizontalCategoricalColorLegend"
import { HorizontalCategoricalColorLegendState } from "../legend/HorizontalCategoricalColorLegendState"
import { HorizontalNumericColorLegend } from "../legend/HorizontalNumericColorLegend"
import { HorizontalNumericColorLegendState } from "../legend/HorizontalNumericColorLegendState"
import { BinEmphasis, toBinEmphasis } from "../legend/LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"
import {
    ENTITY_LABEL_CHART_GAP,
    PADDING_BETWEEN_LEGEND_AND_ROWS,
    PlacedSwimlaneSeries,
    RenderSwimlaneSeries,
    SizedSwimlaneSeries,
    SWIMLANE_LEGEND_STYLE,
    SwimlaneChartManager,
    SwimlaneSegmentLabelStyle,
    SwimlaneSeries,
    SwimlaneTooltipTarget,
} from "./SwimlaneChartConstants"
import { SwimlaneChartState } from "./SwimlaneChartState"
import {
    computeHeightPerSeries,
    findRowAtY,
    findSegmentAtX,
    toPlacedSwimlaneSeries,
    toLabelledNumericBin,
    toRenderSwimlaneSeries,
} from "./SwimlaneChartHelpers"
import { SwimlaneRow } from "./SwimlaneRow"
import { SwimlaneChartTooltip } from "./SwimlaneChartTooltip"

export type SwimlaneChartProps = ChartComponentProps<SwimlaneChartState>

@observer
export class SwimlaneChart
    extends React.Component<SwimlaneChartProps>
    implements ChartInterface, AxisManager
{
    private readonly hitAreaRef = React.createRef<SVGGElement>()

    private readonly tooltipId = guid()
    private readonly tooltipState = new TooltipState<SwimlaneTooltipTarget>({
        fade: "immediate",
    })

    private hoveredLegendBin: ColorScaleBin | undefined = undefined

    constructor(props: SwimlaneChartProps) {
        super(props)
        makeObservable<SwimlaneChart, "tooltipState" | "hoveredLegendBin">(
            this,
            { tooltipState: observable, hoveredLegendBin: observable.ref }
        )
    }

    @computed get chartState(): SwimlaneChartState {
        return this.props.chartState
    }

    @computed private get manager(): SwimlaneChartManager {
        return this.chartState.manager
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get bounds(): Bounds {
        // 2px padding at the bottom prevents the tick labels from overflowing
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padBottom(2)
    }

    @computed private get showLegend(): boolean {
        return this.manager.showLegend ?? true
    }

    @computed private get noDataPatternId(): string {
        return makePatternId(
            Patterns.noDataPattern,
            this.manager.patternIdSuffix
        )
    }

    @computed private get noDataLegendBin(): CategoricalBin | undefined {
        const bin =
            this.chartState.colorScale.categoricalLegendBins.find(isNoDataBin)
        return bin && addPatternRefToBin(bin, this.noDataPatternId)
    }

    @computed private get categoryLegendBins(): CategoricalBin[] {
        return mergeCategoricalBinsByLabelAndColor(
            this.chartState.colorScale.categoricalLegendBins.filter(
                (bin) => !bin.isHidden && !isNoDataBin(bin)
            )
        )
    }

    @computed private get categoricalLegendBins(): CategoricalBin[] {
        return excludeUndefined([
            this.noDataLegendBin,
            ...this.categoryLegendBins,
        ])
    }

    /** The ordinal legend's numeric bins, each mapped to the category it stands for */
    @computed private get categoryByOrdinalLegendBin(): Map<
        ColorScaleBin,
        CategoricalBin
    > {
        return new Map(
            this.categoryLegendBins.map((bin, index) => [
                toLabelledNumericBin(bin, index),
                bin,
            ])
        )
    }

    @computed private get ordinalLegendBins(): ColorScaleBin[] {
        return excludeUndefined([
            this.noDataLegendBin,
            ...this.categoryByOrdinalLegendBin.keys(),
        ])
    }

    @computed private get legendBinSize(): number {
        return 0.625 * this.fontSize
    }

    @computed private get hoveredCategoricalBin(): CategoricalBin | undefined {
        const { hoveredLegendBin } = this
        if (!hoveredLegendBin) return undefined
        return isCategoricalBin(hoveredLegendBin)
            ? hoveredLegendBin
            : this.categoryByOrdinalLegendBin.get(hoveredLegendBin)
    }

    private readonly resolveLegendBinEmphasis = (
        bin: ColorScaleBin
    ): Emphasis => {
        const { hoveredLegendBin } = this
        if (!hoveredLegendBin) return Emphasis.Default
        return bin === hoveredLegendBin ? Emphasis.Highlighted : Emphasis.Muted
    }

    @computed private get legendEmphasis(): BinEmphasis {
        const bins = this.ordinalLegendState
            ? this.ordinalLegendBins
            : this.categoricalLegendBins
        return toBinEmphasis(bins, this.resolveLegendBinEmphasis)
    }

    @computed private get ordinalLegendState():
        | HorizontalNumericColorLegendState
        | undefined {
        if (!this.showLegend || this.chartState.categoryKind !== "ordinal")
            return undefined

        return new HorizontalNumericColorLegendState(this.ordinalLegendBins, {
            baseFontSize: this.fontSize,
            maxWidth: this.bounds.width,
            align: HorizontalAlign.center,
            binSize: this.legendBinSize,
        })
    }

    @computed private get categoricalLegendState():
        | HorizontalCategoricalColorLegendState
        | undefined {
        if (!this.showLegend || this.chartState.categoryKind !== "categorical")
            return undefined

        return new HorizontalCategoricalColorLegendState(
            this.categoricalLegendBins,
            {
                baseFontSize: this.fontSize,
                width: this.bounds.width,
                align: HorizontalAlign.left,
            }
        )
    }

    @computed private get boundsWithoutLegend(): Bounds {
        const legendHeight =
            this.ordinalLegendState?.height ??
            this.categoricalLegendState?.height ??
            0

        return this.bounds.padTop(
            legendHeight > 0
                ? legendHeight + PADDING_BETWEEN_LEGEND_AND_ROWS
                : 0
        )
    }

    @computed private get series(): SwimlaneSeries[] {
        return this.chartState.series
    }

    @computed private get availableHeightPerSeries(): number {
        return computeHeightPerSeries({
            height: this.boundsWithoutLegend.height,
            rowCount: this.series.length,
        })
    }

    @computed private get entityLabelStyle(): FontSettings {
        const fontSize = roundFontSize(
            Math.min(
                scaleFontSize(12, this.fontSize),
                1.1 * this.availableHeightPerSeries
            )
        )

        return { fontSize, fontWeight: 700, lineHeight: 1 }
    }

    @computed private get shouldShowSegmentLabels(): boolean {
        return (
            this.chartState.segmentLabelMode !== SwimlaneSegmentLabelMode.None
        )
    }

    @computed private get segmentLabelStyle(): SwimlaneSegmentLabelStyle {
        const fontSize = scaleFontSize(12, this.fontSize)
        return {
            category: { fontSize, fontWeight: 700, lineHeight: 1.2 },
            timeRange: { fontSize, fontWeight: 500, lineHeight: 1.2 },
        }
    }

    @computed private get sizedSeries(): SizedSwimlaneSeries[] {
        return enrichSeriesWithLabels({
            series: this.series,
            availableHeightPerSeries: this.availableHeightPerSeries,
            minLabelWidth: 0.3 * this.boundsWithoutLegend.width,
            maxLabelWidth: 0.66 * this.boundsWithoutLegend.width,
            fontSettings: this.entityLabelStyle,
            showRegionTooltip: !this.manager.isStatic,
        })
    }

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(
            { isDomainEndExclusive: true, ...this.manager.xAxisConfig },
            this
        )
    }

    @computed private get entityLabelMaxWidth(): number {
        const labelWidths = this.sizedSeries.map((series) => series.label.width)
        if (labelWidths.length === 0) return 0
        return Math.max(...labelWidths)
    }

    @computed get axisBounds(): Bounds {
        return this.boundsWithoutLegend.padLeft(
            this.entityLabelMaxWidth + ENTITY_LABEL_CHART_GAP
        )
    }

    @computed get xAxis(): HorizontalAxis {
        const axis = this.chartState.toHorizontalAxis(this.xAxisConfig)
        axis.range = this.axisBounds.xRange()
        return axis
    }

    @computed private get innerBounds(): Bounds {
        return this.axisBounds.padBottom(this.xAxis.height)
    }

    @computed private get heightPerSeries(): number {
        return computeHeightPerSeries({
            height: this.innerBounds.height,
            rowCount: this.series.length,
        })
    }

    @computed private get yScale(): ScalePoint<SeriesName> {
        const { innerBounds, heightPerSeries, series } = this
        const totalHeight = heightPerSeries * series.length
        return scalePoint<SeriesName>()
            .domain(series.map((s) => s.seriesName))
            .range([
                innerBounds.centerY - totalHeight / 2,
                innerBounds.centerY + totalHeight / 2,
            ])
            .padding(0.5)
    }

    @computed private get placedSeries(): PlacedSwimlaneSeries[] {
        const { visibleTimeRange } = this.chartState
        if (!visibleTimeRange) return []
        return toPlacedSwimlaneSeries({
            series: this.sizedSeries,
            labelX: this.innerBounds.left - ENTITY_LABEL_CHART_GAP,
            heightPerSeries: this.heightPerSeries,
            placeSeries: (seriesName) => this.yScale(seriesName)!,
            placeTime: (time) => this.xAxis.place(time),
            visibleExclusiveEndTime: visibleTimeRange.exclusiveEndTime,
            shouldShowSegmentLabels: this.shouldShowSegmentLabels,
            segmentLabelStyle: this.segmentLabelStyle,
        })
    }

    @computed private get renderSeries(): RenderSwimlaneSeries[] {
        return toRenderSwimlaneSeries({
            series: this.placedSeries,
            hoveredSegment: this.tooltipState.target,
            focusArray: this.chartState.focusArray,
            hoveredLegendBin: this.hoveredCategoricalBin,
        })
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    @action.bound private onCursorEnter(
        event: React.MouseEvent | React.TouchEvent
    ): void {
        this.chartState.focusArray.clear()
        this.updateTooltipTarget(event)
    }

    @action.bound private onCursorMove(
        event: React.MouseEvent | React.TouchEvent
    ): void {
        this.updateTooltipTarget(event)
    }

    @action.bound private dismissTooltip(): void {
        this.tooltipState.target = null
    }

    @action.bound private onCursorLeave(): void {
        if (!this.manager.shouldPinTooltipToBottom) {
            this.dismissTooltip()
        }
    }

    @action.bound private onLegendMouseOver(bin: ColorScaleBin): void {
        this.chartState.focusArray.clear()
        this.hoveredLegendBin = bin
    }

    @action.bound private onLegendMouseLeave(): void {
        this.hoveredLegendBin = undefined
    }

    private updateTooltipTarget(
        event: React.MouseEvent | React.TouchEvent
    ): void {
        const ref = this.hitAreaRef.current
        const parentRef = this.manager.base?.current

        // The tooltip's origin needs to be in the parent's coordinates
        if (parentRef) {
            this.tooltipState.position = getRelativeMouse(parentRef, event)
        }

        if (!ref) return

        const mouse = getRelativeMouse(ref, event)
        const row = findRowAtY(this.placedSeries, mouse.y)
        const segment = row
            ? findSegmentAtX(row.placedSegments, mouse.x)
            : undefined

        const currentTarget = this.tooltipState.target
        const isSameTarget =
            !!row &&
            !!segment &&
            !this.tooltipState.fading && // reassigning cancels the fade-out
            currentTarget?.entityName === row.entityName &&
            currentTarget.segment.startTime === segment.startTime
        if (isSameTarget) return

        this.tooltipState.target =
            row && segment ? { entityName: row.entityName, segment } : null
    }

    private renderLegend(): React.ReactElement | undefined {
        if (this.ordinalLegendState)
            return (
                <HorizontalNumericColorLegend
                    state={this.ordinalLegendState}
                    x={this.bounds.x}
                    y={this.bounds.top}
                    interactive={!this.manager.isStatic}
                    styleConfig={SWIMLANE_LEGEND_STYLE}
                    binEmphasis={this.legendEmphasis}
                    onMouseOver={this.onLegendMouseOver}
                    onMouseLeave={this.onLegendMouseLeave}
                />
            )
        if (this.categoricalLegendState)
            return (
                <HorizontalCategoricalColorLegend
                    state={this.categoricalLegendState}
                    x={this.bounds.x}
                    y={this.bounds.top}
                    interactive={!this.manager.isStatic}
                    styleConfig={SWIMLANE_LEGEND_STYLE}
                    binEmphasis={this.legendEmphasis}
                    onMouseOver={this.onLegendMouseOver}
                    onMouseLeave={this.onLegendMouseLeave}
                />
            )
        return undefined
    }

    private renderRows(): React.ReactElement[] {
        return this.renderSeries.map((series) => (
            <SwimlaneRow
                key={series.seriesName}
                series={series}
                y={series.y}
                noDataPatternId={this.noDataPatternId}
            />
        ))
    }

    private renderAnimatedRows(): React.ReactElement {
        return (
            <AnimatedRows
                items={this.renderSeries}
                keyAccessor={(series: RenderSwimlaneSeries): string =>
                    series.seriesName
                }
                getY={(series: RenderSwimlaneSeries): number => series.y}
                immediate={this.manager.disableChartRowAnimation}
                renderRow={(series): React.ReactElement => (
                    <SwimlaneRow
                        key={series.seriesName}
                        series={series}
                        y={0}
                        noDataPatternId={this.noDataPatternId}
                    />
                )}
            />
        )
    }

    private renderAxis(): React.ReactElement {
        return (
            <>
                <HorizontalAxisComponent
                    bounds={this.boundsWithoutLegend}
                    axis={this.xAxis}
                    tickColor={GRAPHER_LIGHT_TEXT}
                    showTickMarks={true}
                    preferredAxisPosition={this.innerBounds.bottom}
                />
                <HorizontalAxisDomainLine
                    bounds={this.innerBounds}
                    stroke={SOLID_TICK_COLOR}
                />
            </>
        )
    }

    private renderStatic(): React.ReactElement {
        return (
            <g>
                {this.renderLegend()}
                {this.renderAxis()}
                <g id={makeFigmaId("rows")}>{this.renderRows()}</g>
            </g>
        )
    }

    private renderInteractive(): React.ReactElement {
        return (
            <g>
                {this.renderLegend()}
                {this.renderAxis()}
                <g id={makeFigmaId("rows")}>{this.renderAnimatedRows()}</g>
                <g
                    ref={this.hitAreaRef}
                    onMouseEnter={this.onCursorEnter}
                    onMouseMove={this.onCursorMove}
                    onMouseLeave={this.onCursorLeave}
                    onTouchStart={this.onCursorEnter}
                    onTouchMove={this.onCursorMove}
                    onTouchEnd={this.onCursorLeave}
                    onTouchCancel={this.onCursorLeave}
                >
                    <rect {...this.innerBounds.toProps()} fillOpacity={0} />
                </g>
                <SwimlaneChartTooltip
                    id={this.tooltipId}
                    chartState={this.chartState}
                    tooltipState={this.tooltipState}
                    dismissTooltip={this.dismissTooltip}
                />
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
