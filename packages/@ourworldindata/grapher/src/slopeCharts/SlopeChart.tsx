import * as _ from "lodash-es"
import * as R from "remeda"
import React from "react"
import {
    Bounds,
    exposeInstanceOnWindow,
    PointVector,
    makeIdForHumanConsumption,
    guid,
    excludeUndefined,
    getRelativeMouse,
    dyFromAlign,
    isTouchDevice,
    domainExtent,
} from "@ourworldindata/utils"
import { observable, computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_TEXT_OUTLINE_FACTOR,
} from "../core/GrapherConstants"
import {
    SeriesName,
    MissingDataStrategy,
    Time,
    SeriesStrategy,
    VerticalAlign,
    HorizontalAlign,
} from "@ourworldindata/types"
import { ChartInterface } from "../chart/ChartInterface"
import { scaleLinear, ScaleLinear } from "d3-scale"
import { select, type BaseType, type Selection } from "d3-selection"
import {
    PlacedSlopeChartSeries,
    RawSlopeChartSeries,
    RenderSlopeChartSeries,
    SlopeChartSeries,
    SlopeChartManager,
} from "./SlopeChartConstants"
import { CoreColumn } from "@ourworldindata/core-table"
import { getHoverStateForSeries } from "../chart/ChartUtils"
import { VerticalAxis } from "../axis/Axis"
import { VerticalAxisComponent } from "../axis/AxisViews"
import { NoDataSection } from "../scatterCharts/NoDataSection"

import { LineLegend, LineLegendProps } from "../lineLegend/LineLegend"
import {
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
    Tooltip,
    TooltipState,
    TooltipValueRange,
} from "../tooltip/Tooltip"
import { TooltipFooterIcon } from "../tooltip/TooltipProps"

import { Halo } from "@ourworldindata/components"
import { HorizontalColorLegendManager } from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin } from "../color/ColorScaleBin"
import { GRAPHER_BACKGROUND_DEFAULT } from "../color/ColorConstants"
import { FocusArray } from "../focus/FocusArray"
import { LineLabelSeries } from "../lineLegend/LineLegendTypes"
import { SlopeChartState } from "./SlopeChartState"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { InteractionState } from "../interaction/InteractionState"
import {
    getYAxisConfigDefaults,
    toPlacedSlopeChartSeries,
    toRenderSlopeChartSeries,
} from "./SlopeChartHelpers"
import { Slope } from "./Slope"
import { MarkX } from "./MarkX"

type SVGMouseOrTouchEvent =
    | React.MouseEvent<SVGGElement>
    | React.TouchEvent<SVGGElement>

const TOP_PADDING = 6 // leave room for overflowing dots
const LINE_LEGEND_PADDING = 4

export type SlopeChartProps = ChartComponentProps<SlopeChartState>

@observer
export class SlopeChart
    extends React.Component<SlopeChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: SlopeChartProps) {
        super(props)

        makeObservable<SlopeChart, "hoveredSeriesName" | "tooltipState">(this, {
            hoveredSeriesName: observable,
            tooltipState: observable,
        })
    }

    private slopeAreaRef = React.createRef<SVGGElement>()

    private sidebarMargin = 10

    private hoveredSeriesName: string | undefined = undefined
    private tooltipState = new TooltipState<{
        series: SlopeChartSeries
    }>({ fade: "immediate" })

    @computed get chartState(): SlopeChartState {
        return this.props.chartState
    }

    @computed private get manager(): SlopeChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padTop(TOP_PADDING)
            .padBottom(this.bottomPadding)
            .padRight(this.sidebarWidth + this.sidebarMargin)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get missingDataStrategy(): MissingDataStrategy {
        return this.chartState.missingDataStrategy
    }

    @computed private get focusArray(): FocusArray {
        return this.chartState.focusArray
    }

    @computed private get formatColumn(): CoreColumn {
        return this.chartState.formatColumn
    }

    @computed private get lineStrokeWidth(): number {
        return this.manager.isStaticAndSmall ? 3 : 1.5
    }

    @computed private get backgroundColor(): string {
        return this.manager.backgroundColor ?? GRAPHER_BACKGROUND_DEFAULT
    }

    @computed private get isHoverModeActive(): boolean {
        return (
            this.hoveredSeriesNames.length > 0 ||
            // if the external legend is hovered, we want to mute
            // all non-hovered series even if the chart doesn't plot
            // the currently hovered series
            !!this.manager.externalLegendHoverBin
        )
    }

    @computed private get canToggleFocusMode(): boolean {
        return !isTouchDevice() && this.series.length > 1
    }

    @computed private get startTime(): Time {
        return this.chartState.startTime
    }

    @computed private get endTime(): Time {
        return this.chartState.endTime
    }

    @computed private get startX(): number {
        return this.xScale(this.startTime)
    }

    @computed private get endX(): number {
        return this.xScale(this.endTime)
    }

    @computed private get seriesStrategy(): SeriesStrategy {
        return this.chartState.seriesStrategy
    }

    @computed get series(): SlopeChartSeries[] {
        return this.chartState.series
    }

    @computed private get placedSeries(): PlacedSlopeChartSeries[] {
        return toPlacedSlopeChartSeries(this.series, {
            yAxis: this.yAxis,
            startX: this.startX,
            endX: this.endX,
        })
    }

    private hoverStateForSeries(series: SlopeChartSeries): InteractionState {
        return getHoverStateForSeries(series, {
            isHoverModeActive: this.isHoverModeActive,
            hoveredSeriesNames: this.hoveredSeriesNames,
        })
    }

    @computed private get renderSeries(): RenderSlopeChartSeries[] {
        return toRenderSlopeChartSeries(this.placedSeries, {
            isFocusModeActive: this.chartState.isFocusModeActive,
            isHoverModeActive: this.isHoverModeActive,
            hoveredSeriesNames: this.hoveredSeriesNames,
        })
    }

    @computed get noDataSeries(): RawSlopeChartSeries[] {
        return this.chartState.rawSeries.filter(
            (series) => !this.chartState.isSeriesValid(series)
        )
    }

    @computed private get showNoDataSection(): boolean {
        if (this.manager.hideNoDataSection) return false

        // nothing to show if there are no series with missing data
        if (this.noDataSeries.length === 0) return false

        // the No Data section is HTML and won't show up in the SVG export
        if (this.manager.isStatic) return false

        // we usually don't show the no data section if columns are plotted
        // (since columns don't appear in the entity selector there is no need
        // to explain that a column is missing – it just adds noise). but if
        // the missing data strategy is set to hide, then we do want to give
        // feedback as to why a slope is currently not rendered
        return (
            this.seriesStrategy === SeriesStrategy.entity ||
            this.missingDataStrategy === MissingDataStrategy.hide
        )
    }

    @computed private get bottomPadding(): number {
        return 1.5 * GRAPHER_FONT_SCALE_12 * this.fontSize
    }

    @computed private get xLabelPadding(): number {
        return this.useCompactLayout ? 4 : 8
    }

    @computed get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const defaults = getYAxisConfigDefaults(yAxisConfig)
        return new AxisConfig({ ...defaults, ...yAxisConfig }, this)
    }

    @computed get yDomainDefault(): [number, number] {
        const defaultDomain: [number, number] = [Infinity, -Infinity]
        return (
            domainExtent(
                this.chartState.allYValues,
                this.chartState.yScaleType
            ) ?? defaultDomain
        )
    }

    @computed get yDomain(): [number, number] {
        const domain = this.yAxisConfig.domain || [Infinity, -Infinity]
        const domainDefault = this.yDomainDefault
        return [
            Math.min(domain[0], domainDefault[0]),
            Math.max(domain[1], domainDefault[1]),
        ]
    }

    @computed private get yRange(): [number, number] {
        return this.innerBounds.yRange()
    }

    @computed get yAxis(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig, {
            yDomain: this.yDomain,
            yRange: this.yRange,
        })
    }

    @computed private get yAxisWidth(): number {
        return this.yAxis.width
    }

    @computed private get xScale(): ScaleLinear<number, number> {
        const { xRange } = this
        return scaleLinear().domain(this.chartState.xDomain).range(xRange)
    }

    @computed private get sidebarWidth(): number {
        return this.showNoDataSection
            ? R.clamp(this.bounds.width * 0.125, { min: 60, max: 140 })
            : 0
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (!this.manager.showLegend) {
            const categoricalLegendData = this.series.map(
                (series, index) =>
                    new CategoricalBin({
                        index,
                        value: series.seriesName,
                        label: series.displayName,
                        color: series.color,
                    })
            )
            return { categoricalLegendData }
        }
        return undefined
    }

    @computed private get maxLineLegendWidth(): number {
        return 0.25 * this.innerBounds.width
    }

    @computed private get lineLegendFontSize(): number {
        return LineLegend.fontSize({ fontSize: this.fontSize })
    }

    @computed private get lineLegendYRange(): [number, number] {
        const top = this.bounds.top

        const bottom =
            this.bounds.bottom -
            // leave space for the x-axis labels
            this.bottomPadding +
            // but allow for a little extra space
            this.lineLegendFontSize / 2

        return [top, bottom]
    }

    @computed private get lineLegendPropsCommon(): Partial<LineLegendProps> {
        return {
            yAxis: this.yAxis,
            maxWidth: this.maxLineLegendWidth,
            fontSize: this.fontSize,
            isStatic: this.manager.isStatic,
            yRange: this.lineLegendYRange,
            verticalAlign: VerticalAlign.top,
            showTextOutlines: true,
            textOutlineColor: this.backgroundColor,
            onMouseOver: this.onLineLegendMouseOver,
            onMouseLeave: this.onLineLegendMouseLeave,
            onClick: this.canToggleFocusMode
                ? this.onLineLegendClick
                : undefined,
        }
    }

    @computed private get lineLegendPropsRight(): Partial<LineLegendProps> {
        return { xAnchor: "start" }
    }

    @computed private get lineLegendPropsLeft(): Partial<LineLegendProps> {
        return {
            xAnchor: "end",
            seriesNamesSortedByImportance:
                this.seriesSortedByImportanceForLineLegendLeft,
        }
    }

    private formatValue(value: number): string {
        return this.formatColumn.formatValueShortWithAbbreviations(value)
    }

    @computed private get lineLegendMaxLevelLeft(): number {
        if (!this.manager.showLegend) return 0

        // can't use `lineLegendSeriesLeft` due to a circular dependency
        const series = this.series.map((series) =>
            this.constructSingleLineLegendSeries(
                series,
                (series) => series.start.value,
                { showSeriesName: false }
            )
        )

        return LineLegend.maxLevel({
            series,
            ...this.lineLegendPropsCommon,
            seriesNamesSortedByImportance:
                this.seriesSortedByImportanceForLineLegendLeft,
            // not including `lineLegendPropsLeft` due to a circular dependency
        })
    }

    @computed private get lineLegendWidthLeft(): number {
        const props: LineLegendProps = {
            series: this.lineLegendSeriesLeft,
            ...this.lineLegendPropsCommon,
            ...this.lineLegendPropsLeft,
        }

        // We usually use the "stable" width of the line legend, which might be
        // a bit too wide because the connector line width is always added, even
        // it no connector lines are drawn. Using the stable width prevents
        // layout shifts when the connector lines are toggled on and off.
        // However, if the chart area is very narrow (like when it's faceted),
        // the stable width of the line legend takes too much space, so we use the
        // actual width instead.
        return this.isNarrow
            ? LineLegend.width(props)
            : LineLegend.stableWidth(props)
    }

    @computed private get lineLegendRight(): LineLegend {
        return new LineLegend({
            series: this.lineLegendSeriesRight,
            ...this.lineLegendPropsCommon,
            ...this.lineLegendPropsRight,
        })
    }

    @computed private get lineLegendWidthRight(): number {
        // We usually use the "stable" width of the line legend, which might be
        // a bit too wide because the connector line width is always added, even
        // it no connector lines are drawn. Using the stable width prevents
        // layout shifts when the connector lines are toggled on and off.
        // However, if the chart area is very narrow (like when it's faceted),
        // the stable width of the line legend takes too much space, so we use the
        // actual width instead.
        return this.isNarrow
            ? this.lineLegendRight.width
            : this.lineLegendRight.stableWidth
    }

    @computed private get visibleLineLegendLabelsRight(): Set<SeriesName> {
        return new Set(this.lineLegendRight?.visibleSeriesNames ?? [])
    }

    @computed
    private get seriesSortedByImportanceForLineLegendLeft(): SeriesName[] {
        return this.series
            .map((s) => s.seriesName)
            .sort((s1: SeriesName, s2: SeriesName): number => {
                const PREFER_S1 = -1
                const PREFER_S2 = 1

                const s1_isLabelled = this.visibleLineLegendLabelsRight.has(s1)
                const s2_isLabelled = this.visibleLineLegendLabelsRight.has(s2)

                // prefer to show value labels for series that are already labelled
                if (s1_isLabelled && !s2_isLabelled) return PREFER_S1
                if (s2_isLabelled && !s1_isLabelled) return PREFER_S2

                return 0
            })
    }

    @computed private get xRange(): [number, number] {
        const lineLegendWidthLeft =
            this.lineLegendWidthLeft + LINE_LEGEND_PADDING
        const lineLegendWidthRight =
            this.lineLegendWidthRight + LINE_LEGEND_PADDING
        const chartAreaWidth = this.innerBounds.width

        // start and end value when the slopes are as wide as possible
        const minStartX =
            this.innerBounds.x + this.yAxisWidth + lineLegendWidthLeft
        const maxEndX = this.innerBounds.right - lineLegendWidthRight

        // use all available space if the chart is narrow
        if (this.manager.isNarrow || this.isNarrow) {
            return [minStartX, maxEndX]
        }

        const offset = 0.25
        let startX = this.innerBounds.x + offset * chartAreaWidth
        let endX = this.innerBounds.right - offset * chartAreaWidth

        // make sure the start and end values are within the bounds
        startX = Math.max(startX, minStartX)
        endX = Math.min(endX, maxEndX)

        // pick a reasonable max width based on an ideal aspect ratio
        const idealAspectRatio = 0.9
        const availableWidth =
            chartAreaWidth -
            this.yAxisWidth -
            lineLegendWidthLeft -
            lineLegendWidthRight
        const idealWidth = idealAspectRatio * this.bounds.height
        const maxSlopeWidth = Math.min(idealWidth, availableWidth)

        const currentSlopeWidth = endX - startX
        if (currentSlopeWidth > maxSlopeWidth) {
            const padding = currentSlopeWidth - maxSlopeWidth
            startX += padding / 2
            endX -= padding / 2
        }

        return [startX, endX]
    }

    @computed private get isNarrow(): boolean {
        return this.bounds.width < 320
    }

    @computed private get useCompactLayout(): boolean {
        return !!this.manager.isSemiNarrow || this.isNarrow
    }

    @computed private get hoveredSeriesNames(): SeriesName[] {
        const hoveredSeriesNames: SeriesName[] = []

        // hovered series name (either by hovering over a slope or a line legend label)
        if (this.hoveredSeriesName)
            hoveredSeriesNames.push(this.hoveredSeriesName)

        // hovered legend item in the external facet legend
        if (this.manager.externalLegendHoverBin) {
            hoveredSeriesNames.push(
                ...this.series
                    .map((s) => s.seriesName)
                    .filter((name) =>
                        this.manager.externalLegendHoverBin?.contains(name)
                    )
            )
        }

        return hoveredSeriesNames
    }

    private constructSingleLineLegendSeries(
        series: SlopeChartSeries,
        getValue: (series: SlopeChartSeries) => number,
        {
            showSeriesName,
            showAnnotation,
        }: {
            showSeriesName?: boolean
            showAnnotation?: boolean
        }
    ): LineLabelSeries {
        const { seriesName, displayName, color, annotation } = series
        const value = getValue(series)
        const formattedValue = this.formatValue(value)
        return {
            color,
            seriesName,
            annotation: showAnnotation ? annotation : undefined,
            label: showSeriesName ? displayName : formattedValue,
            formattedValue: showSeriesName ? formattedValue : undefined,
            placeFormattedValueInNewLine: this.useCompactLayout,
            yValue: value,
            focus: series.focus,
            hover: this.hoverStateForSeries(series),
        }
    }

    @computed private get lineLegendSeriesLeft(): LineLabelSeries[] {
        const { showSeriesNamesInLineLegendLeft: showSeriesName } = this
        return this.series.map((series) =>
            this.constructSingleLineLegendSeries(
                series,
                (series) => series.start.value,
                { showSeriesName }
            )
        )
    }

    @computed private get lineLegendSeriesRight(): LineLabelSeries[] {
        return this.series.map((series) =>
            this.constructSingleLineLegendSeries(
                series,
                (series) => series.end.value,
                {
                    showSeriesName: this.manager.showLegend,
                    showAnnotation: !this.useCompactLayout,
                }
            )
        )
    }

    private animSelection?: Selection<
        BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    private playIntroAnimation() {
        // Nice little intro animation
        this.animSelection = select(this.slopeAreaRef.current)
            .selectAll(".slope")
            .attr("stroke-dasharray", "100%")
            .attr("stroke-dashoffset", "100%")

        this.animSelection
            .transition()
            .duration(600)
            .attr("stroke-dashoffset", "0%")
    }

    override componentDidMount() {
        exposeInstanceOnWindow(this)

        if (!this.manager.disableIntroAnimation) {
            this.playIntroAnimation()
        }
    }

    override componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed private get showSeriesNamesInLineLegendLeft(): boolean {
        return this.lineLegendMaxLevelLeft >= 4 && !!this.manager.showLegend
    }

    private updateTooltipPosition(event: SVGMouseOrTouchEvent): void {
        const ref = this.manager.base?.current
        if (ref) this.tooltipState.position = getRelativeMouse(ref, event)
    }

    private detectHoveredSlope(event: SVGMouseOrTouchEvent): void {
        const ref = this.slopeAreaRef.current
        if (!ref) return

        const mouse = getRelativeMouse(ref, event)
        this.mouseFrame = requestAnimationFrame(() => {
            if (this.placedSeries.length === 0) return

            const distanceMap = new Map<PlacedSlopeChartSeries, number>()
            for (const series of this.placedSeries) {
                distanceMap.set(
                    series,
                    PointVector.distanceFromPointToLineSegmentSq(
                        mouse,
                        series.startPoint,
                        series.endPoint
                    )
                )
            }

            const closestSlope = _.minBy(this.placedSeries, (s) =>
                distanceMap.get(s)
            )!
            const distanceSq = distanceMap.get(closestSlope)!
            const tolerance = 10
            const toleranceSq = tolerance * tolerance

            if (closestSlope && distanceSq < toleranceSq) {
                this.onSlopeMouseOver(closestSlope)
            } else {
                this.onSlopeMouseLeave()
            }
        })
    }

    private hoverTimer?: number
    @action.bound onLineLegendMouseOver(seriesName: SeriesName): void {
        clearTimeout(this.hoverTimer)
        this.hoveredSeriesName = seriesName
    }

    @action.bound onLineLegendMouseLeave(): void {
        clearTimeout(this.hoverTimer)
        this.hoverTimer = window.setTimeout(() => {
            // wait before clearing selection in case the mouse is moving quickly over neighboring labels
            this.hoveredSeriesName = undefined
        }, 200)
    }

    @action.bound onLineLegendClick(seriesName: SeriesName): void {
        this.focusArray.toggle(seriesName)
    }

    @action.bound onSlopeMouseOver(series: SlopeChartSeries): void {
        this.hoveredSeriesName = series.seriesName
        this.tooltipState.target = { series }
    }

    @action.bound onSlopeMouseLeave(): void {
        this.hoveredSeriesName = undefined
        this.tooltipState.target = null
    }

    mouseFrame?: number
    @action.bound onMouseMove(event: SVGMouseOrTouchEvent): void {
        this.updateTooltipPosition(event)
        this.detectHoveredSlope(event)
    }

    @action.bound onMouseLeave(): void {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        this.onSlopeMouseLeave()
    }

    @computed private get renderUid(): number {
        return guid()
    }

    @computed private get tooltip(): React.ReactElement | undefined {
        const {
            manager: { isRelativeMode },
            tooltipState: { target, position, fading },
            formatColumn,
            startTime,
            endTime,
        } = this

        const { series } = target || {}
        if (!series) return

        const formatTime = (time: Time) => formatColumn.formatTime(time)

        const title = series.displayName
        const titleAnnotation = series.annotation

        const actualStartTime = series.start.originalTime
        const actualEndTime = series.end.originalTime
        const timeRange = `${formatTime(actualStartTime)} to ${formatTime(actualEndTime)}`
        const timeLabel = isRelativeMode
            ? `% change between ${formatColumn.formatTime(actualStartTime)} and ${formatColumn.formatTime(actualEndTime)}`
            : timeRange

        const constructTargetYearForToleranceNotice = () => {
            const isStartValueOriginal = series.start.originalTime === startTime
            const isEndValueOriginal = series.end.originalTime === endTime

            if (!isStartValueOriginal && !isEndValueOriginal) {
                return `${formatTime(startTime)} and ${formatTime(endTime)}`
            } else if (!isStartValueOriginal) {
                return formatTime(startTime)
            } else if (!isEndValueOriginal) {
                return formatTime(endTime)
            } else {
                return undefined
            }
        }

        const targetYear = constructTargetYearForToleranceNotice()
        const toleranceNotice = targetYear
            ? {
                  icon: TooltipFooterIcon.notice,
                  text: makeTooltipToleranceNotice(targetYear),
              }
            : undefined
        const roundingNotice = series.column.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.none,
                  text: makeTooltipRoundingNotice(
                      [series.column.numSignificantFigures],
                      { plural: !isRelativeMode }
                  ),
              }
            : undefined
        const footer = excludeUndefined([toleranceNotice, roundingNotice])

        const values = isRelativeMode
            ? [series.end.value]
            : [series.start.value, series.end.value]

        return (
            <Tooltip
                id={this.renderUid}
                tooltipManager={this.props.chartState.manager}
                x={position.x}
                y={position.y}
                offsetX={20}
                offsetY={-16}
                style={{ maxWidth: "250px" }}
                title={title}
                titleAnnotation={titleAnnotation}
                subtitle={timeLabel}
                subtitleFormat={targetYear ? "notice" : undefined}
                dissolve={fading}
                footer={footer}
                dismiss={() => (this.tooltipState.target = null)}
            >
                <TooltipValueRange
                    column={series.column}
                    values={values}
                    labelVariant="unit-only"
                />
            </Tooltip>
        )
    }

    private makeMissingDataLabel(series: RawSlopeChartSeries): string {
        const { displayName, start, end } = series

        const startTime = this.formatColumn.formatTime(this.startTime)
        const endTime = this.formatColumn.formatTime(this.endTime)

        // mention the start or end value if they're missing
        if (start?.value === undefined && end?.value === undefined) {
            return `${displayName} (${startTime} & ${endTime})`
        } else if (start?.value === undefined) {
            return `${displayName} (${startTime})`
        } else if (end?.value === undefined) {
            return `${displayName} (${endTime})`
        }

        // if both values are given but the series shows up in the No Data
        // section, then tolerance has been applied to one of the values
        // in such a way that we decided not to render the slope after all
        // (e.g. when the original times are too close to each other)
        const isToleranceAppliedToStartValue =
            start.originalTime !== this.startTime
        const isToleranceAppliedToEndValue = end.originalTime !== this.endTime
        if (isToleranceAppliedToStartValue && isToleranceAppliedToEndValue) {
            return `${displayName} (${startTime} & ${endTime})`
        } else if (isToleranceAppliedToStartValue) {
            return `${displayName} (${startTime})`
        } else if (isToleranceAppliedToEndValue) {
            return `${displayName} (${endTime})`
        }

        return displayName
    }

    private renderNoDataSection(): React.ReactElement | undefined {
        if (!this.showNoDataSection) return

        const bounds = new Bounds(
            this.innerBounds.right + this.sidebarMargin,
            this.bounds.top,
            this.sidebarWidth,
            this.bounds.height
        )
        const seriesNames = this.noDataSeries.map((series) =>
            this.makeMissingDataLabel(series)
        )

        return (
            <NoDataSection
                seriesNames={seriesNames}
                bounds={bounds}
                align={HorizontalAlign.right}
                baseFontSize={this.fontSize}
            />
        )
    }

    private renderSlopes() {
        return (
            <g id={makeIdForHumanConsumption("slopes")}>
                {this.renderSeries.map((series) => (
                    <Slope
                        key={series.seriesName}
                        series={series}
                        strokeWidth={this.lineStrokeWidth}
                        outlineWidth={0.5}
                        outlineStroke={this.backgroundColor}
                    />
                ))}
            </g>
        )
    }

    private renderInteractiveSlopes(): React.ReactElement {
        return (
            <g
                ref={this.slopeAreaRef}
                onMouseMove={this.onMouseMove}
                onTouchMove={this.onMouseMove}
                onTouchStart={this.onMouseMove}
                onMouseLeave={this.onMouseLeave}
            >
                <rect
                    x={this.startX}
                    y={this.bounds.y}
                    width={this.endX - this.startX}
                    height={this.bounds.height}
                    fillOpacity={0}
                />
                {this.renderSlopes()}
            </g>
        )
    }

    private renderYAxis(): React.ReactElement {
        return (
            <>
                {!this.yAxis.hideGridlines && (
                    <GridLines bounds={this.innerBounds} yAxis={this.yAxis} />
                )}
                {!this.yAxis.hideAxis && (
                    <VerticalAxisComponent
                        bounds={this.bounds}
                        verticalAxis={this.yAxis}
                    />
                )}
            </>
        )
    }

    private renderXAxis() {
        const { startX, endX } = this
        const { xDomain } = this.chartState

        return (
            <g id={makeIdForHumanConsumption("horizontal-axis")}>
                <MarkX
                    label={this.formatColumn.formatTime(xDomain[0])}
                    x={startX}
                    top={this.innerBounds.top}
                    bottom={this.innerBounds.bottom}
                    labelPadding={this.xLabelPadding}
                    fontSize={this.yAxis.tickFontSize}
                />
                <MarkX
                    label={this.formatColumn.formatTime(xDomain[1])}
                    x={endX}
                    top={this.innerBounds.top}
                    bottom={this.innerBounds.bottom}
                    labelPadding={this.xLabelPadding}
                    fontSize={this.yAxis.tickFontSize}
                />
            </g>
        )
    }

    private renderLineLegendRight(): React.ReactElement {
        return (
            <LineLegend
                series={this.lineLegendSeriesRight}
                x={this.xRange[1] + LINE_LEGEND_PADDING}
                {...this.lineLegendPropsCommon}
                {...this.lineLegendPropsRight}
            />
        )
    }

    private renderLineLegendLeft(): React.ReactElement | null {
        // don't show labels for the start values in relative mode since they're all trivially zero
        if (this.manager.isRelativeMode) return null

        const uniqYValues = _.uniq(
            this.lineLegendSeriesLeft.map((series) => series.yValue)
        )
        const allSlopesStartFromZero =
            uniqYValues.length === 1 && uniqYValues[0] === 0

        // if all values have a start value of 0, show the 0-label only once
        if (allSlopesStartFromZero)
            return (
                <Halo
                    id="x-axis-zero-label"
                    outlineWidth={
                        GRAPHER_TEXT_OUTLINE_FACTOR * this.lineLegendFontSize
                    }
                    outlineColor={this.backgroundColor}
                >
                    <text
                        x={this.startX}
                        y={this.yAxis.place(0)}
                        textAnchor="end"
                        dx={-LINE_LEGEND_PADDING - 4}
                        dy={dyFromAlign(VerticalAlign.middle)}
                        fontSize={this.lineLegendFontSize}
                    >
                        {this.formatValue(0)}
                    </text>
                </Halo>
            )

        return (
            <LineLegend
                series={this.lineLegendSeriesLeft}
                x={this.xRange[0] - LINE_LEGEND_PADDING}
                {...this.lineLegendPropsCommon}
                {...this.lineLegendPropsLeft}
            />
        )
    }

    private renderLineLegends(): React.ReactElement | undefined {
        return (
            <>
                {this.renderLineLegendLeft()}
                {this.renderLineLegendRight()}
            </>
        )
    }

    private renderInteractive(): React.ReactElement {
        return (
            <>
                {this.renderYAxis()}
                {this.renderXAxis()}
                {this.renderInteractiveSlopes()}
                {this.renderLineLegends()}
                {this.renderNoDataSection()}
                {this.tooltip}
            </>
        )
    }

    private renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderYAxis()}
                {this.renderXAxis()}
                {this.renderSlopes()}
                {this.renderLineLegends()}
            </>
        )
    }

    override render() {
        if (this.chartState.errorInfo.reason)
            return (
                <>
                    {this.renderYAxis()}
                    <NoDataModal
                        manager={this.manager}
                        bounds={this.props.bounds}
                        message={this.chartState.errorInfo.reason}
                    />
                </>
            )

        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }
}

interface GridLinesProps {
    bounds: Bounds
    yAxis: VerticalAxis
}

function GridLines({ bounds, yAxis }: GridLinesProps) {
    return (
        <g id={makeIdForHumanConsumption("grid-lines")}>
            {yAxis.tickLabels.map((tick) => {
                const y = yAxis.place(tick.value)
                return (
                    <line
                        id={makeIdForHumanConsumption(tick.formattedValue)}
                        key={tick.formattedValue}
                        x1={bounds.left + yAxis.width}
                        y1={y}
                        x2={bounds.right}
                        y2={y}
                        stroke="#ddd"
                        strokeDasharray="3,2"
                    />
                )
            })}
        </g>
    )
}
