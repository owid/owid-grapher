import * as _ from "lodash-es"
import * as React from "react"
import * as R from "remeda"
import {
    getRelativeMouse,
    excludeUndefined,
    isMobile,
    Bounds,
    guid,
    exposeInstanceOnWindow,
} from "@ourworldindata/utils"
import { computed, action, observable, makeObservable } from "mobx"
import { InteractionState, SeriesName } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import { observer } from "mobx-react"
import { DualAxisComponent } from "../axis/AxisViews"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { LineLegend } from "../lineLegend/LineLegend"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
} from "../tooltip/Tooltip"
import { StackedAreaChartState } from "./StackedAreaChartState.js"
import { AREA_OPACITY, StackedSeries } from "./StackedConstants"
import {
    makeClipPath,
    isTargetOutsideElement,
    getHoverStateForSeries,
} from "../chart/ChartUtils"
import { AxisConfig, AxisManager } from "../axis/AxisConfig.js"
import { LineLabelSeries } from "../lineLegend/LineLegendTypes"
import { easeLinear } from "d3-ease"
import { select } from "d3-selection"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { StackedAreas } from "./StackedAreas"
import { HorizontalColorLegendManager } from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin } from "../color/ColorScaleBin"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"

const STACKED_AREA_CHART_CLASS_NAME = "StackedArea"

export type StackedAreaChartProps = ChartComponentProps<StackedAreaChartState>

@observer
export class StackedAreaChart
    extends React.Component<StackedAreaChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: StackedAreaChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): StackedAreaChartState {
        return this.props.chartState
    }

    @computed private get manager(): ChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed private get renderUid(): number {
        return guid()
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get detailsOrderedByReference(): string[] {
        return this.manager.detailsOrderedByReference ?? []
    }

    @computed private get innerBounds(): Bounds {
        return (
            this.bounds
                .padRight(this.paddingForLegendRight)
                // top padding leaves room for tick labels
                .padTop(6)
                // bottom padding avoids axis labels to be cut off at some resolutions
                .padBottom(2)
        )
    }

    @computed private get dualAxis(): DualAxis {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.innerBounds,
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
            comparisonLines: this.manager.comparisonLines,
        })
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.chartState.transformedTable.timeDomainFor(
                this.chartState.yColumnSlugs
            )
        )
        axis.formatColumn = this.chartState.inputTable.timeColumn
        axis.hideFractionalTicks = true
        return axis
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                nice: true,
                ...this.manager.yAxisConfig,
            },
            this
        )
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const axis = this.yAxisConfig.toVerticalAxis()
        // Use user settings for axis, unless relative mode
        if (this.manager.isRelativeMode) axis.domain = [0, 100]
        else axis.updateDomainPreservingUserSettings(this.yAxisDomain)
        axis.formatColumn = this.chartState.yColumns[0]
        return axis
    }

    @computed private get yAxisDomain(): [number, number] {
        const yValues = this.chartState.allStackedPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [0, _.max(yValues) ?? 0]
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

    @computed private get midpoints(): number[] {
        let prevY = 0
        return this.stackedSeries.map((series) => {
            const lastValue = R.last(series.points)
            if (!lastValue) return 0

            const y = lastValue.value + lastValue.valueOffset
            const middleY = prevY + (y - prevY) / 2
            prevY = y
            return middleY
        })
    }

    private hoverStateForSeries(
        series: StackedSeries<number>
    ): InteractionState {
        return getHoverStateForSeries(series, {
            isHoverModeActive: this.isHoverModeActive,
            hoveredSeriesNames: this.hoveredSeriesNames,
        })
    }

    @computed private get lineLegendSeries(): LineLabelSeries[] {
        const { midpoints } = this
        return this.stackedSeries
            .map((series, index) => ({
                color: series.color,
                seriesName: series.seriesName,
                label: series.seriesName,
                yValue: midpoints[index],
                isAllZeros: series.isAllZeros,
                hover: this.hoverStateForSeries(series),
            }))
            .filter((series) => !series.isAllZeros)
            .toReversed()
    }

    @computed private get maxLineLegendWidth(): number {
        return Math.min(150, this.bounds.width / 3)
    }

    @computed private get lineLegendWidth(): number {
        if (!this.manager.showLegend) return 0

        // only pass props that are required to calculate
        // the width to avoid circular dependencies
        return LineLegend.stableWidth({
            series: this.lineLegendSeries,
            maxWidth: this.maxLineLegendWidth,
            fontSize: this.fontSize,
        })
    }

    @observable tooltipState = new TooltipState<{
        index: number // time-index into points array
        series?: SeriesName
    }>({ fade: "immediate" })

    @action.bound private onAreaMouseEnter(seriesName: SeriesName): void {
        if (this.tooltipState.target) {
            _.extend(this.tooltipState.target, { series: seriesName })
        } else {
            this.tooltipState.target = {
                index: 0, // might be incorrect but will be updated immediately by the move event handler
                series: seriesName,
            }
        }
    }

    @action.bound private onAreaMouseLeave(): void {
        _.extend(this.tooltipState.target, { series: undefined })
    }

    @observable lineLegendHoveredSeriesName?: SeriesName
    @observable private hoverTimer?: number

    @computed private get paddingForLegendRight(): number {
        return this.lineLegendWidth
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (!this.manager.showLegend) {
            const categoricalLegendData = this.chartState.unstackedSeries
                .map(
                    (series, index) =>
                        new CategoricalBin({
                            index,
                            value: series.seriesName,
                            label: series.seriesName,
                            color: series.color,
                        })
                )
                .toReversed()
            return { categoricalLegendData }
        }
        return undefined
    }

    @computed private get seriesSortedByImportance(): string[] {
        return this.stackedSeries
            .toSorted(
                (
                    s1: StackedSeries<number>,
                    s2: StackedSeries<number>
                ): number => {
                    const PREFER_S1 = -1
                    const PREFER_S2 = 1

                    if (!s1) return PREFER_S2
                    if (!s2) return PREFER_S1

                    // early return if one series is all zeroes
                    if (s1.isAllZeros && !s2.isAllZeros) return PREFER_S2
                    if (s2.isAllZeros && !s1.isAllZeros) return PREFER_S1

                    // prefer series with a higher maximum value
                    const yMax1 = _.maxBy(s1.points, (p) => p.value)?.value ?? 0
                    const yMax2 = _.maxBy(s2.points, (p) => p.value)?.value ?? 0
                    if (yMax1 > yMax2) return PREFER_S1
                    if (yMax2 > yMax1) return PREFER_S2

                    // prefer series with a higher last value
                    const yLast1 = R.last(s1.points)?.value ?? 0
                    const yLast2 = R.last(s2.points)?.value ?? 0
                    if (yLast1 > yLast2) return PREFER_S1
                    if (yLast2 > yLast1) return PREFER_S2

                    // prefer series with a higher total area
                    const area1 = _.sumBy(s1.points, (p) => p.value)
                    const area2 = _.sumBy(s2.points, (p) => p.value)
                    if (area1 > area2) return PREFER_S1
                    if (area2 > area1) return PREFER_S2

                    return 0
                }
            )
            .map((s) => s.seriesName)
    }

    @action.bound onLineLegendMouseOver(seriesName: SeriesName): void {
        clearTimeout(this.hoverTimer)
        this.lineLegendHoveredSeriesName = seriesName
    }

    @action.bound onLineLegendMouseLeave(): void {
        clearTimeout(this.hoverTimer)
        this.hoverTimer = window.setTimeout(() => {
            // wait before clearing selection in case the mouse is moving quickly over neighboring labels
            this.lineLegendHoveredSeriesName = undefined
        }, 200)
    }

    @computed private get facetLegendHoveredSeriesName():
        | SeriesName
        | undefined {
        const { externalLegendHoverBin } = this.manager
        if (!externalLegendHoverBin) return undefined
        // stacked area charts can't plot the same entity or column multiple times,
        // so we just find the first series that matches the hovered legend item
        const hoveredSeries = this.chartState.rawSeries.find((series) =>
            externalLegendHoverBin.contains(series.seriesName)
        )
        return hoveredSeries?.seriesName
    }

    @computed private get hoveredSeriesName(): SeriesName | undefined {
        return (
            // if the chart area is hovered
            this.tooltipState.target?.series ??
            // if the line legend is hovered
            this.lineLegendHoveredSeriesName ?? // if the facet legend is hovered
            this.facetLegendHoveredSeriesName
        )
    }

    @computed private get isHoverModeActive(): boolean {
        return (
            !!this.hoveredSeriesName ||
            // if the external legend is hovered, we want to mute
            // all non-hovered series even if the chart doesn't plot
            // the currently hovered series
            !!this.manager.externalLegendHoverBin
        )
    }

    @computed private get hoveredSeriesNames(): string[] {
        return this.hoveredSeriesName ? [this.hoveredSeriesName] : []
    }

    @action.bound private onCursorMove(
        ev: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGElement>
    ): void {
        const ref = this.base.current,
            parentRef = this.manager.base?.current

        // the tooltip's origin needs to be in the parent's coordinates
        if (parentRef) {
            this.tooltipState.position = getRelativeMouse(parentRef, ev)
        }

        if (!ref) return undefined

        const { stackedSeries: series } = this
        const mouse = getRelativeMouse(ref, ev.nativeEvent)
        const boxPadding = isMobile() ? 44 : 25

        // expand the box width, so it's easier to see the tooltip for the first & last timepoints
        const boundedBox = this.dualAxis.innerBounds.expand({
            left: boxPadding,
            right: boxPadding,
        })

        let hoveredIndex
        if (boundedBox.contains(mouse)) {
            const invertedX = this.dualAxis.horizontalAxis.invert(mouse.x)
            const closestPoint = _.minBy(series[0].points, (d) =>
                Math.abs(d.position - invertedX)
            )
            if (closestPoint) {
                const index = series[0].points.indexOf(closestPoint)
                hoveredIndex = index
            }
        }
        this.tooltipState.target =
            hoveredIndex === undefined
                ? null
                : {
                      index: hoveredIndex,
                      series: this.tooltipState.target?.series,
                  }
    }

    @action.bound private dismissTooltip(): void {
        this.tooltipState.target = null
    }

    @action.bound private onCursorLeave(): void {
        if (!this.manager.shouldPinTooltipToBottom) {
            this.dismissTooltip()
        }
        this.lineLegendHoveredSeriesName = undefined
    }

    @computed private get activeXVerticalLine():
        | React.ReactElement
        | undefined {
        const { dualAxis, stackedSeries: series } = this
        const { horizontalAxis, verticalAxis } = dualAxis
        const hoveredPointIndex = this.tooltipState.target?.index
        if (hoveredPointIndex === undefined) return undefined

        const xPoint = series[0].points[hoveredPointIndex]
        if (xPoint === undefined) return undefined

        return (
            // disable pointer events to avoid interfering with enter/leave tracking of areas
            <g className="hoverIndicator" style={{ pointerEvents: "none" }}>
                {series.map((series) => {
                    const point = series.points[hoveredPointIndex]
                    if (!point || point.fake || point.value === 0) return null
                    return (
                        <circle
                            key={series.seriesName}
                            cx={horizontalAxis.place(point.position)}
                            cy={verticalAxis.place(
                                point.value + point.valueOffset
                            )}
                            r={2}
                            fill={series.color}
                        />
                    )
                })}
                <line
                    x1={horizontalAxis.place(xPoint.position)}
                    y1={verticalAxis.range[0]}
                    x2={horizontalAxis.place(xPoint.position)}
                    y2={verticalAxis.range[1]}
                    stroke="rgba(180,180,180,.4)"
                />
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
        const { target, position, fading } = this.tooltipState
        if (!target) return undefined

        // Grab the first value to get the year from
        const { stackedSeries: series } = this
        const hoveredPointIndex = target.index
        const bottomSeriesPoint = series[0].points[hoveredPointIndex]
        if (!bottomSeriesPoint) return undefined

        const formatColumn = this.chartState.yColumns[0], // Assumes same type for all columns.
            formattedTime = formatColumn.formatTime(bottomSeriesPoint.position),
            { unit, shortUnit } = formatColumn

        const title = formattedTime
        const titleAnnotation = this.xAxis.label ? `(${this.xAxis.label})` : ""

        const lastStackedPoint = R.last(series)!.points[hoveredPointIndex]
        if (!lastStackedPoint) return undefined
        const totalValue = lastStackedPoint.value + lastStackedPoint.valueOffset

        const roundingNotice = formatColumn.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.none,
                  text: makeTooltipRoundingNotice([
                      formatColumn.numSignificantFigures,
                  ]),
              }
            : undefined
        const footer = excludeUndefined([roundingNotice])

        return (
            <Tooltip
                id={this.tooltipId}
                tooltipManager={this.manager}
                x={position.x}
                y={position.y}
                offsetY={-16}
                offsetX={20}
                offsetXDirection="left"
                style={{ maxWidth: "50%" }}
                title={title}
                titleAnnotation={titleAnnotation}
                subtitle={unit !== shortUnit ? unit : undefined}
                subtitleFormat="unit"
                footer={footer}
                dissolve={fading}
                dismiss={this.dismissTooltip}
            >
                <TooltipTable
                    columns={[formatColumn]}
                    totals={[totalValue]}
                    rows={series.toReversed().map((series) => {
                        const { seriesName: name, color, points } = series
                        const point = points[hoveredPointIndex]
                        const focused = name === target.series
                        const values = [point?.fake ? undefined : point?.value]
                        const opacity = focused
                            ? AREA_OPACITY.focus
                            : AREA_OPACITY.default
                        const swatch = { color, opacity }

                        return {
                            name,
                            swatch,
                            focused,
                            values,
                        }
                    })}
                />
            </Tooltip>
        )
    }

    @action.bound onDocumentClick(e: MouseEvent): void {
        // only dismiss the tooltip if the click is outside of the chart area
        // and outside of the chart areas of neighbouring facets
        const chartContainer = this.manager.base?.current
        if (!chartContainer) return
        const chartAreas: Element[] = Array.from(
            chartContainer.getElementsByClassName(STACKED_AREA_CHART_CLASS_NAME)
        )
        const isTargetOutsideChartAreas = chartAreas.every((chartArea) =>
            isTargetOutsideElement(e.target!, chartArea)
        )
        if (isTargetOutsideChartAreas) {
            this.dismissTooltip()
        }
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >

    base: React.RefObject<SVGGElement> = React.createRef()
    componentDidMount(): void {
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })

        if (!this.manager.disableIntroAnimation) {
            // Fancy intro animation
            this.animSelection = select(this.base.current)
                .selectAll("clipPath > rect")
                .attr("width", 0)

            this.animSelection
                .transition()
                .duration(800)
                .ease(easeLinear)
                .attr("width", this.bounds.width)
                .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
        }
        exposeInstanceOnWindow(this)
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onDocumentClick, {
            capture: true,
        })

        if (this.animSelection) this.animSelection.interrupt()
    }

    renderAxis(): React.ReactElement {
        const { manager } = this
        return (
            <DualAxisComponent
                dualAxis={this.dualAxis}
                showTickMarks={true}
                detailsMarker={manager.detailsMarkerInSvg}
                backgroundColor={this.manager.backgroundColor}
            />
        )
    }

    renderLegend(): React.ReactElement | void {
        if (!this.manager.showLegend) return
        return (
            <LineLegend
                series={this.lineLegendSeries}
                yAxis={this.yAxis}
                x={this.lineLegendX}
                yRange={this.lineLegendY}
                maxWidth={this.maxLineLegendWidth}
                fontSize={this.fontSize}
                seriesNamesSortedByImportance={this.seriesSortedByImportance}
                isStatic={this.isStatic}
                onMouseOver={this.onLineLegendMouseOver}
                onMouseLeave={this.onLineLegendMouseLeave}
            />
        )
    }

    renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderAxis()}
                {this.renderLegend()}
                <StackedAreas
                    dualAxis={this.dualAxis}
                    seriesArr={this.stackedSeries}
                    focusedSeriesName={this.hoveredSeriesName}
                />
            </>
        )
    }

    renderInteractive(): React.ReactElement {
        const { bounds, dualAxis, renderUid, stackedSeries: series } = this

        const clipPath = makeClipPath({
            renderUid,
            box: {
                ...bounds,
                height: bounds.height * 2,
                x: dualAxis.innerBounds.x,
            },
        })

        return (
            <g
                ref={this.base}
                className={STACKED_AREA_CHART_CLASS_NAME}
                onMouseLeave={this.onCursorLeave}
                onTouchEnd={this.onCursorLeave}
                onTouchCancel={this.onCursorLeave}
                onMouseMove={this.onCursorMove}
                onTouchStart={this.onCursorMove}
                onTouchMove={this.onCursorMove}
            >
                {clipPath.element}
                <rect {...this.bounds.toProps()} fillOpacity="0">
                    {/* This <rect> ensures that the parent <g> is big enough such that we get mouse hover events for the
                    whole charting area, including the axis, the entity labels, and the whitespace next to them.
                    We need these to be able to show the tooltip for the first/last year even if the mouse is outside the charting area. */}
                </rect>
                {this.renderAxis()}
                <g clipPath={clipPath.id}>
                    {this.renderLegend()}
                    <StackedAreas
                        dualAxis={dualAxis}
                        seriesArr={series}
                        focusedSeriesName={this.hoveredSeriesName}
                        onAreaMouseEnter={this.onAreaMouseEnter}
                        onAreaMouseLeave={this.onAreaMouseLeave}
                    />
                </g>
                {this.isTooltipActive && this.activeXVerticalLine}
                {this.tooltip}
            </g>
        )
    }

    render(): React.ReactElement {
        if (this.chartState.failMessage)
            return (
                <g>
                    {this.renderAxis()}
                    <NoDataModal
                        manager={this.manager}
                        bounds={this.dualAxis.bounds}
                        message={this.chartState.failMessage}
                    />
                </g>
            )

        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }

    @computed private get lineLegendX(): number {
        return this.manager.showLegend
            ? this.bounds.right - this.lineLegendWidth
            : 0
    }

    @computed private get lineLegendY(): [number, number] {
        return [this.bounds.top, this.bounds.bottom]
    }

    @computed private get stackedSeries(): readonly StackedSeries<number>[] {
        return this.chartState.series
    }
}
