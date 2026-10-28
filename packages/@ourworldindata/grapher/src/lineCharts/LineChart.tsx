import * as _ from "lodash-es"
import React from "react"
import { hideAll } from "tippy.js"
import * as R from "remeda"
import {
    guid,
    getRelativeMouse,
    exposeInstanceOnWindow,
    excludeUndefined,
    Bounds,
    HorizontalAlign,
} from "@ourworldindata/utils"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"

import { DualAxisComponent } from "../axis/AxisViews"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { VerticalLabels } from "../verticalLabels/VerticalLabels"
import { VerticalLabelsState } from "../verticalLabels/VerticalLabelsState"
import { TooltipState } from "../tooltip/Tooltip"
import { LineChartTooltip } from "./LineChartTooltip"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import { SeriesName, VerticalAlign, Time } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    getMinHitAreaSize,
} from "../core/GrapherConstants"
import { ChartInterface } from "../chart/ChartInterface"
import {
    LineChartSeries,
    LineChartManager,
    LinePoint,
    PlacedLineChartSeries,
    RenderLineChartSeries,
    CATEGORICAL_LEGEND_STYLE,
    NUMERIC_LEGEND_STYLE,
    LEGEND_PADDING,
    VARIABLE_COLOR_STROKE_WIDTH,
    DEFAULT_STROKE_WIDTH,
    VARIABLE_COLOR_LINE_OUTLINE_WIDTH,
    DEFAULT_LINE_OUTLINE_WIDTH,
    DISCONNECTED_DOTS_MARKER_RADIUS,
    VARIABLE_COLOR_MARKER_RADIUS,
    STATIC_SMALL_MARKER_RADIUS,
    DEFAULT_MARKER_RADIUS,
    LINE_CHART_CLASS_NAME,
    ELEVATED_MARKER_RADIUS,
    AnnotationTooltipEvent,
    AnnotationTooltipState,
    PlacedRangeAnnotation,
    RenderPointAnnotation,
    RenderRangeAnnotation,
} from "./LineChartConstants"
import {
    getHoverStateForSeries,
    getSeriesKey,
    isTargetOutsideElement,
} from "../chart/ChartUtils"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { ColorScale } from "../color/ColorScale"
import { HorizontalNumericColorLegend } from "../legend/HorizontalNumericColorLegend"
import { HorizontalNumericColorLegendState } from "../legend/HorizontalNumericColorLegendState"
import { ExternalColorLegendData } from "../legend/HorizontalColorLegendTypes"
import {
    findClosestTimeAtMouse,
    getAnnotationsForSeries,
    getYAxisConfigDefaults,
    toPlacedLineChartSeries,
    toRenderLineChartSeries,
    toSeriesLabelAnnotations,
    transitionAnnotationTooltipState,
} from "./LineChartHelpers"
import { LineChartActiveTimeMarkers } from "./LineChartActiveTimeMarkers"
import {
    LineChartPointAnnotations,
    LineChartRangeAnnotations,
} from "./LineChartAnnotations"
import { LabelSeries } from "../verticalLabels/VerticalLabelsTypes"
import { Lines } from "./Lines"
import { LineChartState } from "./LineChartState.js"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { InteractionState } from "../interaction/InteractionState"
import { resolveEmphasis } from "../interaction/Emphasis"
import { LegendStyleConfig } from "../legend/LegendStyleConfig"

export type LineChartProps = ChartComponentProps<LineChartState>

@observer
export class LineChart
    extends React.Component<LineChartProps>
    implements ChartInterface, AxisManager
{
    private readonly base = React.createRef<SVGGElement>()

    private readonly tooltipId = guid()
    private readonly tooltipState = new TooltipState<{ time: Time }>({
        fade: "immediate",
    })

    private hoveredLabelSeriesName: SeriesName | undefined = undefined
    private annotationTooltipState: AnnotationTooltipState = { kind: "idle" }
    private hoverTimer: number | undefined = undefined

    constructor(props: LineChartProps) {
        super(props)

        makeObservable<
            LineChart,
            "tooltipState" | "hoveredLabelSeriesName" | "annotationTooltipState"
        >(this, {
            tooltipState: observable,
            hoveredLabelSeriesName: observable,
            annotationTooltipState: observable,
        })
    }

    @computed get chartState(): LineChartState {
        return this.props.chartState
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed get detailsOrderedByReference(): string[] {
        return this.manager.detailsOrderedByReference ?? []
    }

    @action.bound private dismissTooltip(): void {
        this.tooltipState.target = null
    }

    @action.bound private onCursorLeave(): void {
        if (!this.manager.shouldPinTooltipToBottom) {
            this.dismissTooltip()
        }
        this.debouncedClearVerticalLabelHover()
    }

    @computed private get allValues(): LinePoint[] {
        return this.placedSeries.flatMap((series) => series.points)
    }

    @action.bound private onCursorMove(
        ev: React.MouseEvent | React.TouchEvent
    ): void {
        const ref = this.base.current,
            parentRef = this.manager.base?.current

        // The tooltip's origin needs to be in the parent's coordinates
        if (parentRef) {
            this.tooltipState.position = getRelativeMouse(parentRef, ev)
        }

        if (!ref) return

        const mouse = getRelativeMouse(ref, ev)

        const hoverTime = findClosestTimeAtMouse({
            mouse,
            innerBounds: this.dualAxis.innerBounds,
            horizontalAxis: this.dualAxis.horizontalAxis,
            allValues: this.allValues,
        })

        // Be sure all lines are un-dimmed if the cursor is above the graph itself
        if (this.dualAxis.innerBounds.contains(mouse)) {
            this.clearVerticalLabelHover()
        }

        if (this.isAnnotationTooltipOpen) return

        this.tooltipState.target =
            hoverTime === undefined ? null : { time: hoverTime }
    }

    @computed private get manager(): LineChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get boundsWithoutColorLegend(): Bounds {
        return this.bounds.padTop(
            this.hasColorLegend ? this.legendHeight + LEGEND_PADDING : 0
        )
    }

    @computed private get maxVerticalLabelsWidth(): number {
        return this.bounds.width / 3
    }

    @computed private get lineStrokeWidth(): number {
        if (this.manager.lineStrokeWidth) return this.manager.lineStrokeWidth
        const factor = this.manager.isStaticAndSmall ? 2 : 1
        return this.hasColorScale
            ? factor * VARIABLE_COLOR_STROKE_WIDTH
            : factor * DEFAULT_STROKE_WIDTH
    }

    @computed private get lineOutlineWidth(): number {
        return this.hasColorScale
            ? VARIABLE_COLOR_LINE_OUTLINE_WIDTH
            : DEFAULT_LINE_OUTLINE_WIDTH
    }

    @computed private get markerRadius(): number {
        if (this.hasMarkersOnlySeries) return DISCONNECTED_DOTS_MARKER_RADIUS
        if (this.hasColorScale) return VARIABLE_COLOR_MARKER_RADIUS
        if (this.manager.isStaticAndSmall) return STATIC_SMALL_MARKER_RADIUS
        if (this.renderSeries.length === 1) return ELEVATED_MARKER_RADIUS
        return DEFAULT_MARKER_RADIUS
    }

    @computed get activeTimes(): Time[] {
        const tooltipTime = this.tooltipState.target?.time
        const highlightedTimes = this.manager.highlightedTimesInLineChart ?? []
        return _.uniq(
            tooltipTime !== undefined
                ? [tooltipTime, ...highlightedTimes]
                : highlightedTimes
        )
    }

    @computed private get activeTimeCircleRadius(): number {
        return this.lineStrokeWidth / 2 + 3.5
    }

    @computed private get annotationMarkerRadius(): number {
        return 2 * this.activeTimeCircleRadius
    }

    @computed private get annotationMarkerHitRadius(): number {
        return getMinHitAreaSize() / 2
    }

    @computed private get isTooltipActive(): boolean {
        return this.manager.tooltip?.get()?.id === this.tooltipId
    }

    @action.bound private onVerticalLabelMouseEnter(
        seriesName: SeriesName
    ): void {
        this.chartState.focusArray.clear()
        clearTimeout(this.hoverTimer)
        this.hoveredLabelSeriesName = seriesName
    }

    @action.bound private clearVerticalLabelHover(): void {
        this.hoveredLabelSeriesName = undefined
    }

    @action.bound private debouncedClearVerticalLabelHover(): void {
        clearTimeout(this.hoverTimer)

        // Wait before clearing selection in case the mouse is moving
        // quickly over neighboring labels
        this.hoverTimer = window.setTimeout(() => {
            this.clearVerticalLabelHover()
        }, 200)
    }

    @action.bound private onVerticalLabelMouseLeave(): void {
        this.debouncedClearVerticalLabelHover()
    }

    @action.bound private onVerticalLabelTooltipShow(
        seriesName: SeriesName
    ): void {
        this.chartState.focusArray.clear()
        this.dismissTooltip()
        this.dispatchAnnotationTooltipEvent({
            type: "labelTooltipShow",
            seriesName,
        })
    }

    @action.bound private onVerticalLabelTooltipHide(
        seriesName: SeriesName
    ): void {
        this.dispatchAnnotationTooltipEvent({
            type: "labelTooltipHide",
            seriesName,
        })
    }

    @action.bound private onAnnotationMarkerClick(
        seriesName: SeriesName,
        time: Time
    ): void {
        this.chartState.focusArray.clear()
        this.dismissTooltip()
        hideAll()
        this.dispatchAnnotationTooltipEvent({
            type: "markerClick",
            seriesName,
            time,
        })
    }

    @action.bound private onAnnotationTooltipClose(): void {
        this.dispatchAnnotationTooltipEvent({ type: "markerTooltipClose" })
    }

    @action.bound private onDocumentKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") this.onAnnotationTooltipClose()
    }

    @action.bound private dispatchAnnotationTooltipEvent(
        event: AnnotationTooltipEvent
    ): void {
        this.annotationTooltipState = transitionAnnotationTooltipState(
            this.annotationTooltipState,
            event
        )
    }

    @computed private get isAnnotationTooltipOpen(): boolean {
        const { kind } = this.annotationTooltipState
        return kind === "labelOpen" || kind === "markerOpen"
    }

    @computed private get verticalLabelTooltipSeriesName():
        | SeriesName
        | undefined {
        const state = this.annotationTooltipState
        return state.kind === "labelOpen" ? state.seriesName : undefined
    }

    @computed private get hoveredSeriesNames(): string[] {
        const { externalLegendHoverBin } = this.manager
        const hoveredSeriesNames = excludeUndefined([
            this.hoveredLabelSeriesName,
            this.verticalLabelTooltipSeriesName,
        ])
        if (externalLegendHoverBin) {
            hoveredSeriesNames.push(
                ...this.series
                    .map((s) => s.seriesName)
                    .filter((name) => externalLegendHoverBin.contains(name))
            )
        }
        return hoveredSeriesNames
    }

    @computed private get isHoverModeActive(): boolean {
        return (
            this.hoveredSeriesNames.length > 0 ||
            // if the external legend is hovered, we want to mute
            // all non-hovered series even if the chart doesn't plot
            // the currently hovered series
            (!!this.manager.externalLegendHoverBin && !this.hasColorScale)
        )
    }

    @computed private get hasTimeHighlights(): boolean {
        const { highlightedTimesInLineChart = [] } = this.manager
        return highlightedTimesInLineChart.length > 0
    }

    @action.bound private onDocumentClick(e: MouseEvent): void {
        // Only dismiss the tooltip if the click is outside of the chart area
        // and outside of the chart areas of neighboring facets
        const chartContainer = this.manager.base?.current
        if (!chartContainer) return
        const chartAreas = chartContainer.getElementsByClassName(
            LINE_CHART_CLASS_NAME
        )
        const isTargetOutsideChartAreas = Array.from(chartAreas).every(
            (chartArea) => isTargetOutsideElement(e.target!, chartArea)
        )
        if (isTargetOutsideChartAreas) {
            this.dismissTooltip()
        }
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })
        document.addEventListener("keydown", this.onDocumentKeyDown)
    }

    override componentWillUnmount(): void {
        document.removeEventListener("click", this.onDocumentClick, {
            capture: true,
        })
        document.removeEventListener("keydown", this.onDocumentKeyDown)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get fontWeight(): number {
        return this.hasColorScale ? 700 : 400
    }

    @computed private get hidePoints(): boolean {
        return !!this.manager.hidePoints
    }

    @computed private get verticalLabelsX(): number {
        return this.bounds.right - this.verticalLabelsWidth
    }

    @computed private get verticalLabelsYRange(): [number, number] {
        return [
            this.boundsWithoutColorLegend.top,
            this.boundsWithoutColorLegend.bottom,
        ]
    }

    @computed private get verticalLabelsState(): VerticalLabelsState {
        return new VerticalLabelsState(this.verticalLabelsSeries, {
            yAxis: () => this.yAxis,
            yRange: () => this.verticalLabelsYRange,
            maxWidth: this.maxVerticalLabelsWidth,
            baseFontSize: this.fontSize,
            fontWeight: this.fontWeight,
            verticalAlign: VerticalAlign.top,
            isInteractive: !this.isStatic,
        })
    }

    @computed private get verticalLabelsWidth(): number {
        if (!this.manager.showSeriesLabels) return 0
        return this.verticalLabelsState.stableWidth
    }

    private renderDualAxis(): React.ReactElement {
        const { manager, dualAxis } = this

        return (
            <DualAxisComponent
                dualAxis={dualAxis}
                showTickMarks={true}
                detailsMarker={manager.detailsMarkerInSvg}
            />
        )
    }

    private renderColorLegend(): React.ReactElement | null {
        if (!this.hasColorLegend || !this.numericLegendState) return null
        return (
            <HorizontalNumericColorLegend
                state={this.numericLegendState}
                x={this.bounds.x}
                y={this.bounds.top}
                interactive={!this.isStatic}
                styleConfig={this.numericLegendStyleConfig}
            />
        )
    }

    /**
     * Render the lines themselves and their labels
     */
    private renderChartElements(): React.ReactElement {
        const { manager } = this
        return (
            <>
                {manager.showSeriesLabels && (
                    <VerticalLabels
                        state={this.verticalLabelsState}
                        x={this.verticalLabelsX}
                        onMouseEnter={this.onVerticalLabelMouseEnter}
                        onMouseLeave={this.onVerticalLabelMouseLeave}
                        onTooltipShow={this.onVerticalLabelTooltipShow}
                        onTooltipHide={this.onVerticalLabelTooltipHide}
                        seriesNamesWithInfoIcon={
                            this.seriesNamesWithLabelInfoIcon
                        }
                    />
                )}
                <Lines
                    dualAxis={this.dualAxis}
                    series={this.renderSeries}
                    multiColor={this.hasColorScale}
                    hidePoints={this.hidePoints}
                    lineStrokeWidth={this.lineStrokeWidth}
                    lineOutlineWidth={this.lineOutlineWidth}
                    markerRadius={this.markerRadius}
                    isStatic={manager.isStatic}
                />
            </>
        )
    }

    private renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderColorLegend()}
                {this.renderDualAxis()}
                {this.renderChartElements()}
            </>
        )
    }

    private renderInteractive(): React.ReactElement {
        return (
            <g
                ref={this.base}
                className={LINE_CHART_CLASS_NAME}
                onMouseLeave={this.onCursorLeave}
                onTouchEnd={this.onCursorLeave}
                onTouchCancel={this.onCursorLeave}
                onMouseMove={this.onCursorMove}
                onTouchStart={this.onCursorMove}
                onTouchMove={this.onCursorMove}
            >
                <rect {...this.bounds.toProps()} fillOpacity="0">
                    {/* This <rect> ensures that the parent <g> is big enough such that
                        we get mouse hover events for the whole charting area, including
                        the axis, the entity labels, and the whitespace next to them.
                        We need these to be able to show the tooltip for the first/last
                        year even if the mouse is outside the charting area. */}
                </rect>
                {this.renderColorLegend()}
                {this.renderDualAxis()}
                {this.renderChartElements()}
                <LineChartRangeAnnotations
                    annotations={this.renderRangeAnnotations}
                />

                {(this.isTooltipActive || this.hasTimeHighlights) && (
                    <LineChartActiveTimeMarkers
                        times={this.activeTimes}
                        renderSeries={this.renderSeries}
                        dualAxis={this.dualAxis}
                        chartState={this.chartState}
                        dotRadius={this.activeTimeCircleRadius}
                    />
                )}
                <LineChartPointAnnotations
                    annotations={this.renderPointAnnotations}
                    radius={this.annotationMarkerRadius}
                    hitRadius={this.annotationMarkerHitRadius}
                    onClick={this.onAnnotationMarkerClick}
                    onTooltipClose={this.onAnnotationTooltipClose}
                />
                <LineChartTooltip
                    id={this.tooltipId}
                    chartState={this.chartState}
                    tooltipState={this.tooltipState}
                    series={this.renderSeries}
                    xAxisLabel={this.xAxis.label}
                    dismissTooltip={this.dismissTooltip}
                />
            </g>
        )
    }

    override render(): React.ReactElement {
        const { manager } = this

        if (this.chartState.errorInfo.reason)
            return (
                <g>
                    {this.renderDualAxis()}
                    <NoDataMessage
                        manager={manager}
                        bounds={this.bounds}
                        message={this.chartState.errorInfo.reason}
                    />
                </g>
            )

        return manager.isStatic ? this.renderStatic() : this.renderInteractive()
    }

    @computed protected get yColumnSlugs(): string[] {
        return this.chartState.yColumnSlugs
    }

    @computed private get hasColorScale(): boolean {
        return this.chartState.hasColorScale
    }

    @computed private get hasColorLegend(): boolean {
        return this.hasColorScale && !!this.manager.showLegend
    }

    @computed private get colorScale(): ColorScale {
        return this.chartState.colorScale
    }

    // TODO just pass colorScale to legend and let it figure it out?
    @computed private get numericLegendData(): ColorScaleBin[] {
        // Move CategoricalBins to end
        return _.sortBy(
            this.colorScale.legendBins,
            (bin) => bin instanceof CategoricalBin
        )
    }

    private readonly numericBinHeight = 6
    private readonly legendTickSize = 1

    // Used when faceted
    categoricalLegendStyleConfig: LegendStyleConfig = CATEGORICAL_LEGEND_STYLE

    // Used when the lines are colored by a numeric scale
    numericLegendStyleConfig = NUMERIC_LEGEND_STYLE

    @computed private get numericLegendState():
        | HorizontalNumericColorLegendState
        | undefined {
        return this.hasColorScale && this.manager.showLegend
            ? new HorizontalNumericColorLegendState(this.numericLegendData, {
                  baseFontSize: this.fontSize,
                  maxWidth: this.bounds.width,
                  align: HorizontalAlign.center,
                  title: this.legendTitle,
                  tickSize: this.legendTickSize,
                  binHeight: this.numericBinHeight,
              })
            : undefined
    }

    @computed private get legendTitle(): string | undefined {
        return this.hasColorScale
            ? this.colorScale.legendDescription
            : undefined
    }

    @computed private get legendHeight(): number {
        return this.numericLegendState?.height ?? 0
    }

    // End of color legend props

    @computed get series(): readonly LineChartSeries[] {
        return this.chartState.series
    }

    @computed private get hasMarkersOnlySeries(): boolean {
        return this.series.some((series) => series.plotMarkersOnly)
    }

    @computed get placedSeries(): PlacedLineChartSeries[] {
        return toPlacedLineChartSeries(this.series, {
            chartState: this.chartState,
            dualAxis: this.dualAxis,
        })
    }

    private hoverStateForSeries(series: LineChartSeries): InteractionState {
        return getHoverStateForSeries(series, {
            isHoverModeActive: this.isHoverModeActive,
            hoveredSeriesNames: this.hoveredSeriesNames,
        })
    }

    @computed private get renderSeries(): RenderLineChartSeries[] {
        return toRenderLineChartSeries(this.placedSeries, {
            isFocusModeActive: this.chartState.isFocusModeActive,
            isHoverModeActive: this.isHoverModeActive,
            hoveredSeriesNames: this.hoveredSeriesNames,
        })
    }

    private isAtHoveredTime(time: Time): boolean {
        return this.isTooltipActive && this.activeTimes.includes(time)
    }

    private isActiveTimeInRange({
        startTime,
        endTime,
    }: PlacedRangeAnnotation["snappedTimeRange"]): boolean {
        return (
            this.isTooltipActive &&
            this.activeTimes.some(
                (time) => time >= startTime && time <= endTime
            )
        )
    }

    @computed private get seriesNamesWithLabelInfoIcon(): Set<SeriesName> {
        return new Set(
            this.renderSeries
                .filter(
                    (series) =>
                        !series.hover.background &&
                        series.placedPointAnnotations.some(({ point }) =>
                            this.isAtHoveredTime(point.time)
                        )
                )
                .map((series) => series.seriesName)
        )
    }

    @computed private get renderPointAnnotations(): RenderPointAnnotation[] {
        return this.renderSeries.flatMap((series, index) => {
            const state = this.annotationTooltipState
            const isTooltipOpenAt = (time: Time): boolean =>
                state.kind === "markerOpen" &&
                state.seriesName === series.seriesName &&
                state.time === time
            return series.placedPointAnnotations
                .filter(
                    ({ point }) =>
                        isTooltipOpenAt(point.time) ||
                        (!series.hover.background &&
                            (series.seriesName ===
                                this.verticalLabelTooltipSeriesName ||
                                this.isAtHoveredTime(point.time)))
                )
                .map((placedAnnotation) => ({
                    ...placedAnnotation,
                    key: `${getSeriesKey(series, index)}-${placedAnnotation.point.time}`,
                    seriesName: series.seriesName,
                    emphasis: series.emphasis,
                    isTooltipOpen: isTooltipOpenAt(placedAnnotation.point.time),
                }))
        })
    }

    @computed private get renderRangeAnnotations(): RenderRangeAnnotation[] {
        return this.renderSeries.flatMap((series, index) =>
            series.placedRangeAnnotations
                .filter(
                    ({ snappedTimeRange }) =>
                        !series.hover.background &&
                        (series.seriesName ===
                            this.verticalLabelTooltipSeriesName ||
                            this.isActiveTimeInRange(snappedTimeRange))
                )
                .map((placedAnnotation) => ({
                    ...placedAnnotation,
                    key: `${getSeriesKey(series, index)}-${placedAnnotation.annotation.startTime}-${placedAnnotation.annotation.endTime}`,
                    seriesName: series.seriesName,
                    emphasis: series.emphasis,
                }))
        )
    }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed private get verticalLabelsSeries(): LabelSeries[] {
        // If there are any projections, ignore non-projection legends (bit of a hack)
        let series = this.series
        if (series.some((series) => !!series.isProjection))
            series = series.filter((series) => series.isProjection)

        // Deduplicate series by seriesName to avoid showing the same label multiple times
        const deduplicatedSeries: LineChartSeries[] = []
        const seriesGroupedByName = Map.groupBy(series, (s) => s.seriesName)
        for (const duplicates of seriesGroupedByName.values()) {
            // keep only the label for the series with the most recent data
            // (series are sorted by time, so we can just take the last one)
            deduplicatedSeries.push(R.last(duplicates)!)
        }

        return deduplicatedSeries.map((series) => {
            const { seriesName, displayName, color, focus } = series
            const lastValue = R.last(series.points)!.y
            const hover = this.hoverStateForSeries(series)
            return {
                color,
                seriesName,
                label: !this.manager.showSeriesLabels ? "" : displayName,
                inlineAnnotation: getAnnotationsForSeries(
                    this.chartState.annotationsMap,
                    seriesName
                ),
                annotations: toSeriesLabelAnnotations(
                    series,
                    this.chartState.formatColumn
                ),
                yValue: lastValue,
                emphasis: resolveEmphasis({ focus, hover }),
            } satisfies LabelSeries
        })
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const defaults = getYAxisConfigDefaults(yAxisConfig)
        return new AxisConfig({ ...defaults, ...yAxisConfig }, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig, hasScatter } = this.manager
        const customConfig = { hideGridlines: true }

        // If a secondary scatter tab is present, then the xAxisConfig
        // applies to the scatter's x-axis, not the line chart's time axis
        const userConfig = hasScatter ? undefined : xAxisConfig

        return new AxisConfig({ ...customConfig, ...userConfig }, this)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed private get innerBounds(): Bounds {
        return (
            this.boundsWithoutColorLegend
                .padRight(
                    this.manager.showSeriesLabels ? this.verticalLabelsWidth : 1
                )
                // The top padding leaves room for tick labels.
                // No padding is needed when plotted on a log axis because the
                // log scale notice leaves enough space for tick labels.
                .padTop(this.chartState.isLogScale ? 0 : 6)
                // The bottom padding avoids axis labels to be cut off at some resolutions
                .padBottom(2)
        )
    }

    @computed get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
            comparisonLines: this.manager.comparisonLines,
        })
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @computed get externalLegend(): ExternalColorLegendData | undefined {
        if (!this.manager.showSeriesLabels) {
            const numericLegendData = this.hasColorScale
                ? this.numericLegendData
                : []
            const categoricalLegendData = this.hasColorScale
                ? []
                : this.series.map(
                      (series, index) =>
                          new CategoricalBin({
                              index,
                              value: series.seriesName,
                              label: series.displayName,
                              color: series.color,
                          })
                  )
            return {
                numericLegendData,
                categoricalLegendData,
                legendTitle: this.legendTitle,
                legendTickSize: this.legendTickSize,
                numericBinHeight: this.numericBinHeight,
                categoricalLegendStyleConfig: this.categoricalLegendStyleConfig,
                numericLegendStyleConfig: this.numericLegendStyleConfig,
            }
        }
        return undefined
    }
}
