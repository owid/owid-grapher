import * as _ from "lodash-es"
import React from "react"
import * as R from "remeda"
import {
    guid,
    excludeNullish,
    getRelativeMouse,
    exposeInstanceOnWindow,
    excludeUndefined,
    isMobile,
    Bounds,
    HorizontalAlign,
} from "@ourworldindata/utils"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { select, type Selection, type BaseType } from "d3-selection"
import { easeLinear } from "d3-ease"
import { DualAxisComponent } from "../axis/AxisViews"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { VerticalLabels } from "../verticalLabels/VerticalLabels"
import { VerticalLabelsState } from "../verticalLabels/VerticalLabelsState"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
    toTooltipTableColumns,
} from "../tooltip/Tooltip"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { extent } from "d3-array"
import { SeriesName, VerticalAlign, Time } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_OPACITY_MUTE,
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
} from "./LineChartConstants"
import { CoreColumn } from "@ourworldindata/core-table"
import {
    ClipPath,
    getHoverStateForSeries,
    getSeriesKey,
    isTargetOutsideElement,
    makeClipPath,
} from "../chart/ChartUtils"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { ColorScale } from "../color/ColorScale"
import { GRAPHER_BACKGROUND_DEFAULT } from "../color/ColorConstants"
import { darkenColorForLine } from "../color/ColorUtils"
import {
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../legend/HorizontalColorLegends"
import {
    AnnotationsMap,
    getAnnotationsForSeries,
    getAnnotationsMap,
    getYAxisConfigDefaults,
    toPlacedLineChartSeries,
    toRenderLineChartSeries,
} from "./LineChartHelpers"
import { LabelSeries } from "../verticalLabels/VerticalLabelsTypes"
import { Lines } from "./Lines"
import { LineChartState } from "./LineChartState.js"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { InteractionState } from "../interaction/InteractionState"
import { LegendStyleConfig } from "../legend/LegendInteractionState"

export type LineChartProps = ChartComponentProps<LineChartState>

@observer
export class LineChart
    extends React.Component<LineChartProps>
    implements ChartInterface, HorizontalColorLegendManager, AxisManager
{
    private base = React.createRef<SVGGElement>()

    private tooltipState = new TooltipState<{ time: Time }>({
        fade: "immediate",
    })

    private hoveredLabelSeriesName: SeriesName | undefined = undefined
    private hoverTimer: number | undefined = undefined

    constructor(props: LineChartProps) {
        super(props)

        makeObservable<LineChart, "tooltipState" | "hoveredLabelSeriesName">(
            this,
            { tooltipState: observable, hoveredLabelSeriesName: observable }
        )
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

    @computed get annotationsMap(): AnnotationsMap | undefined {
        return getAnnotationsMap(
            this.chartState.inputTable,
            this.yColumnSlugs[0]
        )
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

        // the tooltip's origin needs to be in the parent's coordinates
        if (parentRef) {
            this.tooltipState.position = getRelativeMouse(parentRef, ev)
        }

        if (!ref) return

        const mouse = getRelativeMouse(ref, ev)
        const boxPadding = isMobile() ? 44 : 25

        // expand the box width, so it's easier to see the tooltip for the first & last timepoints
        const boundedBox = this.dualAxis.innerBounds.expand({
            left: boxPadding,
            right: boxPadding,
        })

        let hoverTime
        if (boundedBox.contains(mouse)) {
            const invertedX = this.dualAxis.horizontalAxis.invert(mouse.x)

            const closestValue = _.minBy(this.allValues, (point) =>
                Math.abs(invertedX - point.x)
            )
            hoverTime = closestValue?.x
        }

        // be sure all lines are un-dimmed if the cursor is above the graph itself
        if (this.dualAxis.innerBounds.contains(mouse)) {
            this.clearVerticalLabelHover()
        }

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
        return DEFAULT_MARKER_RADIUS
    }

    @computed get activeTimes(): Time[] {
        const { highlightedTimesInLineChart = [] } = this.manager
        return _.uniq(
            this.tooltipState.target?.time
                ? [
                      this.tooltipState.target.time,
                      ...highlightedTimesInLineChart,
                  ]
                : highlightedTimesInLineChart
        )
    }

    @computed private get activeXVerticalLines(): React.ReactElement | null {
        const { activeTimes, dualAxis } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        if (!activeTimes) return null

        return (
            <>
                {activeTimes.map((time) => (
                    <g className="hoverIndicator" key={time}>
                        <line
                            x1={horizontalAxis.place(time)}
                            y1={verticalAxis.range[0]}
                            x2={horizontalAxis.place(time)}
                            y2={verticalAxis.range[1]}
                            stroke="rgba(180,180,180,.4)"
                        />
                        {this.renderSeries.map((series, index) => {
                            const point = series.points.find(
                                (point) => point.x === time
                            )
                            if (!point || series.hover.background) return null

                            const valueColor = this.hasColorScale
                                ? darkenColorForLine(
                                      this.chartState.getColorScaleColor(
                                          point.colorValue
                                      )
                                  )
                                : series.color
                            const isBackground =
                                series.focus.background && !series.hover.active
                            const opacity = isBackground
                                ? GRAPHER_OPACITY_MUTE
                                : 1

                            return (
                                <circle
                                    key={getSeriesKey(series, index)}
                                    cx={horizontalAxis.place(point.x)}
                                    cy={verticalAxis.place(point.y)}
                                    r={this.lineStrokeWidth / 2 + 3.5}
                                    fill={valueColor}
                                    fillOpacity={opacity}
                                    stroke={
                                        this.manager.backgroundColor ??
                                        GRAPHER_BACKGROUND_DEFAULT
                                    }
                                    strokeWidth={0.5}
                                />
                            )
                        })}
                    </g>
                ))}
            </>
        )
    }

    @computed private get tooltipId(): number {
        return this.renderUid
    }

    @computed private get isTooltipActive(): boolean {
        return this.manager.tooltip?.get()?.id === this.tooltipId
    }

    @computed private get tooltip(): React.ReactElement | undefined {
        const { formatColumn, colorColumn, hasColorScale } = this
        const { target, position, fading } = this.tooltipState

        if (!target) return undefined

        // Duplicate seriesNames will be present if there is a projected-values line
        const seriesSegments = _.mapValues(
            _.groupBy(this.series, "seriesName"),
            (segments) =>
                segments.find((series) =>
                    // Ideally pick series with a defined value at the target time
                    series.points.find((point) => point.x === target.time)
                ) ??
                segments.find((series): boolean | void => {
                    // Otherwise pick the series whose start & end contains the target time
                    // and display a "No data" notice.
                    const [startX, endX] = extent(series.points, ({ x }) => x)
                    return (
                        _.isNumber(startX) &&
                        _.isNumber(endX) &&
                        startX < target.time &&
                        target.time < endX
                    )
                }) ??
                null // If neither series matches, exclude the entity from the tooltip altogether
        )

        const sortedData = _.sortBy(
            excludeNullish(R.values(seriesSegments)),
            (series) => {
                const value = series.points.find(
                    (point) => point.x === target.time
                )
                return value !== undefined ? -value.y : Infinity
            }
        )

        const formattedTime = formatColumn.formatTime(target.time),
            { displayUnit: unitLabel } = formatColumn,
            { isRelativeMode, startTime } = this.manager

        const title = formattedTime
        const titleAnnotation = this.xAxis.label ? `(${this.xAxis.label})` : ""

        const columns = [formatColumn]
        if (hasColorScale && colorColumn.slug !== formatColumn.slug)
            columns.push(colorColumn)

        const subtitle =
            isRelativeMode && startTime
                ? `% change since ${formatColumn.formatTime(startTime)}`
                : unitLabel
        const subtitleFormat = subtitle === unitLabel ? "unit" : undefined

        const projectionNotice = sortedData.some(
            (series) => series.isProjection
        )
            ? { icon: TooltipFooterIcon.Stripes, text: "Projected data" }
            : undefined
        const roundingNotice = formatColumn.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.None,
                  text: makeTooltipRoundingNotice([
                      formatColumn.numSignificantFigures,
                  ]),
              }
            : undefined
        const footer = excludeUndefined([projectionNotice, roundingNotice])

        return (
            <Tooltip
                id={this.tooltipId}
                tooltipManager={this.manager}
                x={position.x}
                y={position.y}
                style={{ maxWidth: "400px" }}
                offsetXDirection="left"
                offsetX={20}
                offsetY={-16}
                title={title}
                titleAnnotation={titleAnnotation}
                subtitle={subtitle}
                subtitleFormat={subtitleFormat}
                footer={footer}
                dissolve={fading}
                dismiss={this.dismissTooltip}
            >
                <TooltipTable
                    columns={toTooltipTableColumns(columns)}
                    rows={sortedData.map((series) => {
                        const {
                            seriesName,
                            displayName,
                            isProjection: striped,
                        } = series
                        const annotation = getAnnotationsForSeries(
                            this.annotationsMap,
                            seriesName
                        )

                        const point = series.points.find(
                            (point) => point.x === target.time
                        )

                        const blurred =
                            this.hoverStateForSeries(series).background ||
                            series.focus.background ||
                            point === undefined

                        const color = this.hasColorScale
                            ? darkenColorForLine(
                                  this.chartState.getColorScaleColor(
                                      point?.colorValue
                                  )
                              )
                            : series.color
                        const opacity = blurred ? GRAPHER_OPACITY_MUTE : 1
                        const swatch = { color, opacity }

                        const values = excludeUndefined([
                            point?.y,
                            point?.colorValue as undefined | number,
                        ])

                        return {
                            name: displayName,
                            annotation,
                            swatch,
                            blurred,
                            striped,
                            values,
                        }
                    })}
                />
            </Tooltip>
        )
    }

    @action.bound private onVerticalLabelMouseEnter(
        seriesName: SeriesName
    ): void {
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

    @computed private get hoveredSeriesNames(): string[] {
        const { externalLegendHoverBin } = this.manager
        const hoveredSeriesNames = excludeUndefined([
            this.hoveredLabelSeriesName,
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
        // only dismiss the tooltip if the click is outside of the chart area
        // and outside of the chart areas of neighbouring facets
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

    private animSelection?: Selection<
        BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    override componentDidMount(): void {
        if (!this.manager.disableIntroAnimation) {
            this.runFancyIntroAnimation()
        }
        exposeInstanceOnWindow(this)
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })
    }

    override componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
        document.removeEventListener("click", this.onDocumentClick, {
            capture: true,
        })
    }

    @computed private get renderUid(): number {
        return guid()
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

    @computed private get clipPathBounds(): Bounds {
        const { dualAxis, boundsWithoutColorLegend } = this
        return boundsWithoutColorLegend
            .set({ x: dualAxis.innerBounds.x })
            .expand(10)
    }

    @computed private get clipPath(): ClipPath {
        return makeClipPath({
            renderUid: this.renderUid,
            box: this.clipPathBounds,
        })
    }

    private runFancyIntroAnimation(): void {
        this.animSelection = select(this.base.current)
            .selectAll("clipPath > rect")
            .attr("width", 0)
        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.clipPathBounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    @computed private get verticalLabelsState(): VerticalLabelsState {
        return new VerticalLabelsState(this.verticalLabelsSeries, {
            yAxis: () => this.yAxis,
            yRange: () => this.verticalLabelsYRange,
            maxWidth: this.maxVerticalLabelsWidth,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            verticalAlign: VerticalAlign.top,
            showRegionTooltip: !this.isStatic,
        })
    }

    @computed private get verticalLabelsWidth(): number {
        if (!this.manager.showLegend) return 0
        return this.verticalLabelsState.stableWidth
    }

    private renderDualAxis(): React.ReactElement {
        const { manager, dualAxis } = this

        return (
            <DualAxisComponent
                dualAxis={dualAxis}
                showTickMarks={true}
                detailsMarker={manager.detailsMarkerInSvg}
                backgroundColor={manager.backgroundColor}
            />
        )
    }

    private renderColorLegend(): React.ReactElement | null {
        if (!this.hasColorLegend) return null
        return <HorizontalNumericColorLegend manager={this} />
    }

    /**
     * Render the lines themselves and their labels
     */
    private renderChartElements(): React.ReactElement {
        const { manager } = this
        return (
            <>
                {manager.showLegend && (
                    <VerticalLabels
                        state={this.verticalLabelsState}
                        x={this.verticalLabelsX}
                        onMouseEnter={this.onVerticalLabelMouseEnter}
                        onMouseLeave={this.onVerticalLabelMouseLeave}
                        interactive={!this.isStatic}
                    />
                )}
                <Lines
                    dualAxis={this.dualAxis}
                    series={this.renderSeries}
                    multiColor={this.hasColorScale}
                    hidePoints={this.hidePoints}
                    lineStrokeWidth={this.lineStrokeWidth}
                    lineOutlineWidth={this.lineOutlineWidth}
                    backgroundColor={this.manager.backgroundColor}
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
                {/* The tiny bit of extra space in the clippath is to ensure circles
                    centered on the very edge are still fully visible */}
                {this.clipPath.element}
                <rect {...this.bounds.toProps()} fillOpacity="0">
                    {/* This <rect> ensures that the parent <g> is big enough such that
                        we get mouse hover events for the whole charting area, including
                        the axis, the entity labels, and the whitespace next to them.
                        We need these to be able to show the tooltip for the first/last
                        year even if the mouse is outside the charting area. */}
                </rect>
                {this.renderColorLegend()}
                {this.renderDualAxis()}
                <g clipPath={this.clipPath.id}>{this.renderChartElements()}</g>

                {(this.isTooltipActive || this.hasTimeHighlights) &&
                    this.activeXVerticalLines}
                {this.tooltip}
            </g>
        )
    }

    override render(): React.ReactElement {
        const { manager, dualAxis } = this

        if (this.chartState.errorInfo.reason)
            return (
                <g>
                    {this.renderDualAxis()}
                    <NoDataModal
                        manager={manager}
                        bounds={dualAxis.innerBounds}
                        message={this.chartState.errorInfo.reason}
                    />
                </g>
            )

        return manager.isStatic ? this.renderStatic() : this.renderInteractive()
    }

    @computed protected get yColumnSlugs(): string[] {
        return this.chartState.yColumnSlugs
    }

    @computed private get colorColumn(): CoreColumn {
        return this.chartState.colorColumn
    }

    @computed private get formatColumn(): CoreColumn {
        return this.chartState.formatColumn
    }

    @computed private get hasColorScale(): boolean {
        return this.chartState.hasColorScale
    }

    @computed private get hasColorLegend(): boolean {
        return (
            this.hasColorScale &&
            !!this.manager.showLegend &&
            !this.manager.isDisplayedAlongsideComplementaryTable
        )
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

    @computed private get colorScale(): ColorScale {
        return this.chartState.colorScale
    }

    // TODO just pass colorScale to legend and let it figure it out?
    @computed get numericLegendData(): ColorScaleBin[] {
        // Move CategoricalBins to end
        return _.sortBy(
            this.colorScale.legendBins,
            (bin) => bin instanceof CategoricalBin
        )
    }

    numericBinSize = 6
    legendTickSize = 1

    // Used when faceted
    categoricalLegendStyleConfig: LegendStyleConfig = CATEGORICAL_LEGEND_STYLE

    // Used when the lines are colored by a numeric scale
    numericLegendStyleConfig = NUMERIC_LEGEND_STYLE

    @computed private get numericLegend():
        | HorizontalNumericColorLegend
        | undefined {
        return this.hasColorScale && this.manager.showLegend
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    @computed get numericLegendY(): number {
        return this.bounds.top
    }

    @computed get legendTitle(): string | undefined {
        return this.hasColorScale
            ? this.colorScale.legendDescription
            : undefined
    }

    @computed get legendHeight(): number {
        return this.numericLegend?.height ?? 0
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

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed private get verticalLabelsSeries(): LabelSeries[] {
        // If there are any projections, ignore non-projection legends (bit of a hack)
        let series = this.series
        if (series.some((series) => !!series.isProjection))
            series = series.filter((series) => series.isProjection)

        // Deduplicate series by seriesName to avoid showing the same label multiple times
        const deduplicatedSeries: LineChartSeries[] = []
        const seriesGroupedByName = _.groupBy(series, "seriesName")
        for (const duplicates of Object.values(seriesGroupedByName)) {
            // keep only the label for the series with the most recent data
            // (series are sorted by time, so we can just take the last one)
            deduplicatedSeries.push(R.last(duplicates)!)
        }

        return deduplicatedSeries.map((series) => {
            const { seriesName, displayName, color } = series
            const lastValue = R.last(series.points)!.y
            return {
                color,
                seriesName,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: !this.manager.showLegend ? "" : displayName,
                annotation: getAnnotationsForSeries(
                    this.annotationsMap,
                    seriesName
                ),
                yValue: lastValue,
                focus: series.focus,
                hover: this.hoverStateForSeries(series),
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
                    this.manager.showLegend ? this.verticalLabelsWidth : 1
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

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (!this.manager.showLegend) {
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
                legendTitle: this.legendTitle,
                legendTickSize: this.legendTickSize,
                numericBinSize: this.numericBinSize,
                numericLegendData,
                categoricalLegendData,
                categoricalLegendStyleConfig: this.categoricalLegendStyleConfig,
                numericLegendStyleConfig: this.numericLegendStyleConfig,
            }
        }
        return undefined
    }
}
