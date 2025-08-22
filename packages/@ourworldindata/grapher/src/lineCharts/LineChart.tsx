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
    Color,
    HorizontalAlign,
    isTouchDevice,
} from "@ourworldindata/utils"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { select, type Selection, type BaseType } from "d3-selection"
import { easeLinear } from "d3-ease"
import { DualAxisComponent } from "../axis/AxisViews"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { LineLegend } from "../lineLegend/LineLegend"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
} from "../tooltip/Tooltip"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { extent } from "d3-array"
import {
    SeriesName,
    VerticalAlign,
    InteractionState,
    AxisAlign,
    ScaleType,
} from "@ourworldindata/types"
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
    PlacedPoint,
    RenderLineChartSeries,
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
    byHoverThenFocusState,
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
} from "../horizontalColorLegend/HorizontalColorLegends"
import {
    AnnotationsMap,
    getAnnotationsForSeries,
    getAnnotationsMap,
} from "./LineChartHelpers"
import { LineLabelSeries } from "../lineLegend/LineLegendTypes"
import { Lines } from "./Lines"
import { LineChartState } from "./LineChartState.js"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"

export type LineChartProps = ChartComponentProps<LineChartState>

@observer
export class LineChart
    extends React.Component<LineChartProps>
    implements ChartInterface, HorizontalColorLegendManager, AxisManager
{
    private base = React.createRef<SVGGElement>()

    constructor(props: LineChartProps) {
        super(props)

        makeObservable<
            LineChart,
            "tooltipState" | "lineLegendHoveredSeriesName" | "hoverTimer"
        >(this, {
            tooltipState: observable,
            lineLegendHoveredSeriesName: observable,
            hoverTimer: observable,
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
        this.clearHighlightedSeries()
    }

    @computed private get allValues(): LinePoint[] {
        return this.placedSeries.flatMap((series) => series.points)
    }

    private tooltipState = new TooltipState<{
        x: number
    }>({ fade: "immediate" })

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

        let hoverX
        if (boundedBox.contains(mouse)) {
            const invertedX = this.dualAxis.horizontalAxis.invert(mouse.x)

            const closestValue = _.minBy(this.allValues, (point) =>
                Math.abs(invertedX - point.x)
            )
            hoverX = closestValue?.x
        }

        // be sure all lines are un-dimmed if the cursor is above the graph itself
        if (this.dualAxis.innerBounds.contains(mouse)) {
            this.lineLegendHoveredSeriesName = undefined
        }

        this.tooltipState.target = hoverX === undefined ? null : { x: hoverX }
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

    @computed private get maxLineLegendWidth(): number {
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

    @computed private get activeX(): number | undefined {
        return (
            this.tooltipState.target?.x ??
            this.manager.entityYearHighlight?.year
        )
    }

    @computed private get activeXVerticalLine():
        | React.ReactElement
        | undefined {
        const { activeX, dualAxis } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        if (activeX === undefined) return undefined

        return (
            <g className="hoverIndicator">
                <line
                    x1={horizontalAxis.place(activeX)}
                    y1={verticalAxis.range[0]}
                    x2={horizontalAxis.place(activeX)}
                    y2={verticalAxis.range[1]}
                    stroke="rgba(180,180,180,.4)"
                />
                {this.renderSeries.map((series, index) => {
                    const point = series.points.find(
                        (point) => point.x === activeX
                    )
                    if (!point || series.hover.background) return null

                    const color = this.hasColorScale
                        ? darkenColorForLine(
                              this.chartState.getColorScaleColor(
                                  point.colorValue
                              )
                          )
                        : series.color
                    const opacity = series.focus?.background
                        ? GRAPHER_OPACITY_MUTE
                        : 1

                    return (
                        <circle
                            key={getSeriesKey(series, index)}
                            cx={horizontalAxis.place(point.x)}
                            cy={verticalAxis.place(point.y)}
                            r={this.lineStrokeWidth / 2 + 3.5}
                            fill={color}
                            stroke={
                                this.manager.backgroundColor ??
                                GRAPHER_BACKGROUND_DEFAULT
                            }
                            strokeWidth={0.5}
                            opacity={opacity}
                        />
                    )
                })}
            </g>
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
                    series.points.find((point) => point.x === target.x)
                ) ??
                segments.find((series): boolean | void => {
                    // Otherwise pick the series whose start & end contains the target time
                    // and display a "No data" notice.
                    const [startX, endX] = extent(series.points, ({ x }) => x)
                    return (
                        _.isNumber(startX) &&
                        _.isNumber(endX) &&
                        startX < target.x &&
                        target.x < endX
                    )
                }) ??
                null // If neither series matches, exclude the entity from the tooltip altogether
        )

        const sortedData = _.sortBy(
            excludeNullish(R.values(seriesSegments)),
            (series) => {
                const value = series.points.find(
                    (point) => point.x === target.x
                )
                return value !== undefined ? -value.y : Infinity
            }
        )

        const formattedTime = formatColumn.formatTime(target.x),
            { unit, shortUnit } = formatColumn,
            { isRelativeMode, startTime } = this.manager

        const title = formattedTime
        const titleAnnotation = this.xAxis.label ? `(${this.xAxis.label})` : ""

        const columns = [formatColumn]
        if (hasColorScale) columns.push(colorColumn)

        const unitLabel = unit !== shortUnit ? unit : undefined
        const subtitle =
            isRelativeMode && startTime
                ? `% change since ${formatColumn.formatTime(startTime)}`
                : unitLabel
        const subtitleFormat = subtitle === unitLabel ? "unit" : undefined

        const projectionNotice = sortedData.some(
            (series) => series.isProjection
        )
            ? { icon: TooltipFooterIcon.stripes, text: "Projected data" }
            : undefined
        const roundingNotice = formatColumn.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.none,
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
                    columns={columns}
                    rows={sortedData.map((series) => {
                        const { seriesName: name, isProjection: striped } =
                            series
                        const annotation = getAnnotationsForSeries(
                            this.annotationsMap,
                            name
                        )

                        const point = series.points.find(
                            (point) => point.x === target.x
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
                            name,
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

    private defaultRightPadding = 1

    private lineLegendHoveredSeriesName: SeriesName | undefined = undefined
    private hoverTimer: number | undefined = undefined

    @action.bound private onLineLegendMouseOver(seriesName: SeriesName): void {
        clearTimeout(this.hoverTimer)
        this.lineLegendHoveredSeriesName = seriesName
    }

    @action.bound private clearHighlightedSeries(): void {
        clearTimeout(this.hoverTimer)
        this.hoverTimer = window.setTimeout(() => {
            // wait before clearing selection in case the mouse is moving quickly over neighboring labels
            this.lineLegendHoveredSeriesName = undefined
        }, 200)
    }

    @action.bound private onLineLegendMouseLeave(): void {
        this.clearHighlightedSeries()
    }

    @action.bound private onLineLegendClick(seriesName: SeriesName): void {
        this.chartState.focusArray.toggle(seriesName)
    }

    @computed private get hoveredSeriesNames(): string[] {
        const { externalLegendHoverBin } = this.manager
        const hoveredSeriesNames = excludeUndefined([
            this.manager.entityYearHighlight?.entityName,
            this.lineLegendHoveredSeriesName,
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

    @computed private get isFocusModeActive(): boolean {
        return !this.chartState.focusArray.isEmpty
    }

    @computed private get canToggleFocusMode(): boolean {
        return !isTouchDevice() && this.series.length > 1
    }

    @computed private get hasEntityYearHighlight(): boolean {
        return this.manager.entityYearHighlight !== undefined
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

    @computed private get lineLegendX(): number {
        return this.bounds.right - this.lineLegendWidth
    }

    @computed private get lineLegendY(): [number, number] {
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

    @computed private get lineLegendWidth(): number {
        if (!this.manager.showLegend) return 0

        // only pass props that are required to calculate
        // the width to avoid circular dependencies
        return LineLegend.stableWidth({
            series: this.lineLegendSeries,
            maxWidth: this.maxLineLegendWidth,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            verticalAlign: VerticalAlign.top,
        })
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
                    <LineLegend
                        series={this.lineLegendSeries}
                        yAxis={this.yAxis}
                        x={this.lineLegendX}
                        yRange={this.lineLegendY}
                        maxWidth={this.maxLineLegendWidth}
                        verticalAlign={VerticalAlign.top}
                        fontSize={this.fontSize}
                        fontWeight={this.fontWeight}
                        isStatic={this.isStatic}
                        onMouseOver={this.onLineLegendMouseOver}
                        onMouseLeave={this.onLineLegendMouseLeave}
                        onClick={
                            this.canToggleFocusMode
                                ? this.onLineLegendClick
                                : undefined
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

                {(this.isTooltipActive || this.hasEntityYearHighlight) &&
                    this.activeXVerticalLine}
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
        return this.chartState.yColumns[0]
    }

    @computed private get hasColorScale(): boolean {
        return this.chartState.hasColorScale
    }

    @computed private get hasColorLegend(): boolean {
        return this.hasColorScale && !!this.manager.showLegend
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
    numericBinStrokeWidth = 1
    legendTextColor = "#555"
    legendTickSize = 1

    @computed get numericBinStroke(): Color {
        return this.manager.backgroundColor ?? GRAPHER_BACKGROUND_DEFAULT
    }

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
        const { dualAxis } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        return this.series.toReversed().map((series) => {
            return {
                ...series,
                placedPoints: series.points.map(
                    (point): PlacedPoint => ({
                        time: point.x,
                        x: _.round(horizontalAxis.place(point.x), 1),
                        y: _.round(verticalAxis.place(point.y), 1),
                        color: this.hasColorScale
                            ? darkenColorForLine(
                                  this.chartState.getColorScaleColor(
                                      point.colorValue
                                  )
                              )
                            : series.color,
                    })
                ),
            }
        })
    }

    private hoverStateForSeries(series: LineChartSeries): InteractionState {
        return getHoverStateForSeries(series, {
            isHoverModeActive: this.isHoverModeActive,
            hoveredSeriesNames: this.hoveredSeriesNames,
        })
    }

    @computed private get renderSeries(): RenderLineChartSeries[] {
        let series: RenderLineChartSeries[] = this.placedSeries.map(
            (series) => {
                return {
                    ...series,
                    hover: this.hoverStateForSeries(series),
                }
            }
        )

        // draw lines on top of markers-only series
        series = _.sortBy(series, (series) => !series.plotMarkersOnly)

        // sort by interaction state so that foreground series
        // are drawn on top of background series
        if (this.isHoverModeActive || this.isFocusModeActive) {
            series = _.sortBy(series, byHoverThenFocusState)
        }

        return series
    }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed private get lineLegendSeries(): LineLabelSeries[] {
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
            const { seriesName, color } = series
            const lastValue = R.last(series.points)!.y
            return {
                color,
                seriesName,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: !this.manager.showLegend ? "" : `${seriesName}`,
                annotation: getAnnotationsForSeries(
                    this.annotationsMap,
                    seriesName
                ),
                yValue: lastValue,
                focus: series.focus,
                hover: this.hoverStateForSeries(series),
            }
        })
    }

    @computed get yAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                nice: this.manager.yAxisConfig?.scaleType !== ScaleType.log,
                // if we only have a single y value (probably 0), we want the
                // horizontal axis to be at the bottom of the chart.
                // see https://github.com/owid/owid-grapher/pull/975#issuecomment-890798547
                singleValueAxisPointAlign: AxisAlign.start,
                // default to 0 if not set
                min: 0,
                ...this.manager.yAxisConfig,
            },
            this
        )
    }

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                hideGridlines: true,
                ...this.manager.xAxisConfig,
            },
            this
        )
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.chartState.transformedTable.timeDomainFor(this.yColumnSlugs)
        )
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.chartState.inputTable.timeColumn
        axis.hideFractionalTicks = true
        return axis
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const axisConfig = this.yAxisConfig
        const yDomain = this.chartState.transformedTable.domainFor(
            this.yColumnSlugs
        )
        const domain = axisConfig.domain
        const axis = axisConfig.toVerticalAxis()
        axis.updateDomainPreservingUserSettings([
            Math.min(domain[0], yDomain[0]),
            Math.max(domain[1], yDomain[1]),
        ])
        axis.hideFractionalTicks = this.chartState.yColumns.every(
            (yColumn) => yColumn.isAllIntegers
        ) // all y axis points are integral, don't show fractional ticks in that case
        axis.label = ""
        axis.formatColumn = this.formatColumn
        return axis
    }

    @computed get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.boundsWithoutColorLegend
                .padRight(
                    this.manager.showLegend
                        ? this.lineLegendWidth
                        : this.defaultRightPadding
                )
                // top padding leaves room for tick labels
                .padTop(6)
                // bottom padding avoids axis labels to be cut off at some resolutions
                .padBottom(2),
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
                              label: series.seriesName,
                              color: series.color,
                          })
                  )
            return {
                legendTitle: this.legendTitle,
                legendTextColor: this.legendTextColor,
                legendTickSize: this.legendTickSize,
                numericBinSize: this.numericBinSize,
                numericBinStroke: this.numericBinStroke,
                numericBinStrokeWidth: this.numericBinStrokeWidth,
                numericLegendData,
                categoricalLegendData,
            }
        }
        return undefined
    }
}
