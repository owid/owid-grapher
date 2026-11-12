import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { scaleLinear } from "d3-scale"
import { ChartInterface } from "../chart/ChartInterface"
import { SideWidths } from "@ourworldindata/types"
import { SlopeChartState } from "./SlopeChartState.js"
import { type SlopeChartProps } from "./SlopeChart.js"
import {
    PlacedSlopeChartSeries,
    RenderSlopeChartSeries,
    SlopeChartManager,
} from "./SlopeChartConstants"
import {
    getXAxisConfigSettings,
    getYAxisConfigDefaults,
    toPlacedSlopeChartSeries,
    toRenderSlopeChartSeries,
} from "./SlopeChartHelpers"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    FontSettings,
} from "../core/GrapherConstants"
import { getVisibleLabels, scaleFontSize } from "../chart/ChartUtils"
import { Bounds, SeriesName } from "@ourworldindata/utils"
import { HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { Slope } from "./Slope"
import { SlopeChartXAxis } from "./SlopeChartXAxis"
import { InitialAnchoredLabelSeries } from "../anchoredLabels/AnchoredLabelsTypes.js"
import { AnchoredLabelsState } from "../anchoredLabels/AnchoredLabelsState"
import { AnchoredLabels } from "../anchoredLabels/AnchoredLabels"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import { resolveEmphasis } from "../interaction/Emphasis.js"
import { THUMBNAIL_LINE_STYLE } from "../lineCharts/LineChartConstants.js"

const DOT_RADIUS = 3.5
const SPACE_BETWEEN_DOT_AND_LABEL = 4

const LABEL_PADDING = DOT_RADIUS + SPACE_BETWEEN_DOT_AND_LABEL

type SeriesLabelText = "name" | "value"

@observer
export class SlopeChartThumbnail
    extends React.Component<SlopeChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: SlopeChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): SlopeChartState {
        return this.props.chartState
    }

    @computed get manager(): SlopeChartManager {
        return this.chartState.manager
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get formattedStartTime(): string {
        return this.chartState.formatColumn.formatTime(
            this.chartState.xDomain[0]
        )
    }

    @computed private get formattedEndTime(): string {
        return this.chartState.formatColumn.formatTime(
            this.chartState.xDomain[1]
        )
    }

    @computed private get xMarkFontSize(): number {
        return this.outerBoundsVerticalAxis.tickFontSize
    }

    @computed private get xStartMarkWidth(): number {
        if (this.xAxisConfig.hideTickLabels) return 0
        return Bounds.forText(this.formattedStartTime, {
            fontSize: this.xMarkFontSize,
        }).width
    }

    @computed private get xEndMarkWidth(): number {
        if (this.xAxisConfig.hideTickLabels) return 0
        return Bounds.forText(this.formattedEndTime, {
            fontSize: this.xMarkFontSize,
        }).width
    }

    @computed private get xMarksHeight(): number {
        if (this.xAxisConfig.hideTickLabels) return 0
        return this.xMarkFontSize
    }

    @computed private get xStartPadding(): number {
        return Math.max(0.5 * this.xStartMarkWidth, DOT_RADIUS)
    }

    @computed private get xEndPadding(): number {
        return Math.max(0.5 * this.xEndMarkWidth, DOT_RADIUS)
    }

    @computed get innerBounds(): Bounds {
        const { left, right } = this.effectiveLabelWidths
        const rightPadding = Math.max(
            right > 0 ? right + LABEL_PADDING : 0, // end labels plus padding
            this.xEndPadding
        )
        const leftPadding = Math.max(
            left > 0 ? left + LABEL_PADDING : 0, // start labels plus padding
            this.xStartPadding
        )

        return this.bounds
            .padBottom(this.xMarksHeight)
            .padRight(rightPadding)
            .padLeft(leftPadding)
    }

    /**
     * Bounds whose horizontal extent is exactly [startX, endX],
     * the start and end of the slope lines
     */
    @computed private get slopeAreaBounds(): Bounds {
        return new Bounds(
            this.startX,
            this.innerBounds.top,
            this.endX - this.startX,
            this.innerBounds.height
        )
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const defaults = getYAxisConfigDefaults(yAxisConfig)
        const custom = { hideAxis: true }
        return new AxisConfig({ ...defaults, ...custom, ...yAxisConfig }, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const overrides = getXAxisConfigSettings(xAxisConfig, {
            startTime: this.chartState.startTime,
            endTime: this.chartState.endTime,
        })
        const { axisText } = getVisibleLabels(this.manager.labelMode)
        const labelModeOverrides = axisText ? {} : { hideTickLabels: true }
        return new AxisConfig(
            { ...xAxisConfig, ...overrides, ...labelModeOverrides },
            this
        )
    }

    @computed get yDomain(): [number, number] {
        const domain = this.yAxisConfig.domain || [Infinity, -Infinity]
        const domainDefault = this.chartState.yDomainDefault
        return [
            Math.min(domain[0], domainDefault[0]),
            Math.max(domain[1], domainDefault[1]),
        ]
    }

    @computed private get yRange(): [number, number] {
        // Add vertical padding to prevent dots from being rendered at the edges
        // and to ensure labels don't overlap with the x-axis time marks below
        return this.innerBounds.padHeight(6).yRange()
    }

    @computed get xAxis(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig, {
            xRange: this.xRange,
        })
    }

    @computed private get xRange(): [number, number] {
        return this.innerBounds.xRange()
    }

    @computed private get startX(): number {
        return this.xAxis.place(this.chartState.startTime)
    }

    @computed private get endX(): number {
        return this.xAxis.place(this.chartState.endTime)
    }

    @computed get yAxis(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig, {
            yDomain: this.yDomain,
            yRange: this.yRange,
        })
    }

    @computed private get outerBoundsVerticalAxis(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig, {
            yDomain: this.yDomain,
            yRange: this.bounds.yRange(),
        })
    }

    @computed private get placedSeries(): PlacedSlopeChartSeries[] {
        return toPlacedSlopeChartSeries(this.chartState.series, {
            yAxis: this.yAxis,
            startX: this.startX,
            endX: this.endX,
        })
    }

    @computed private get renderSeries(): RenderSlopeChartSeries[] {
        return toRenderSlopeChartSeries(this.placedSeries, {
            isFocusModeActive: this.chartState.isFocusModeActive,
        })
    }

    @computed private get labelFontSettings(): FontSettings {
        return {
            fontSize: scaleFontSize(12, this.fontSize),
            fontWeight: 500,
            lineHeight: 1,
        }
    }

    private formatLabel(value: number): string {
        return this.chartState.formatColumn.formatValueShortWithAbbreviations(
            value
        )
    }

    @computed private get labelsRange(): [number, number] {
        const {
            xMarksHeight,
            manager: { chartAreaPadding = 0 },
        } = this

        return [
            this.bounds.bottom - xMarksHeight,
            this.bounds.top - chartAreaPadding,
        ]
    }

    @computed private get endLabelsSeries(): Omit<
        InitialAnchoredLabelSeries,
        "position"
    >[] {
        const { end } = this.seriesLabelText
        if (!this.manager.showSeriesLabels || !end) return []

        return this.chartState.series.map((series) => {
            const { seriesName, displayName, color, focus } = series

            const lastPoint = series.end
            const value = lastPoint?.value ?? 0

            const label = end === "name" ? displayName : this.formatLabel(value)

            const emphasis = resolveEmphasis({ focus })
            return { seriesName, value, label, color, emphasis }
        })
    }

    private makeEndLabelsState({
        yAxis,
        xRange,
    }: {
        yAxis: VerticalAxis
        xRange: [number, number]
    }): AnchoredLabelsState | undefined {
        if (!this.manager.showSeriesLabels || !this.seriesLabelText.end)
            return undefined

        const series = this.endLabelsSeries.map((series) => {
            const position = {
                x: xRange[1],
                y: yAxis.place(series.value),
            }

            return { ...series, position }
        })

        return new AnchoredLabelsState(series, {
            ...this.labelFontSettings,
            maxWidth: this.labelsMaxWidth(this.seriesLabelText.end),
            xRange,
            labelPadding: LABEL_PADDING,
            yRanges: { edge: this.labelsRange },
        })
    }

    @computed private get endLabelsState(): AnchoredLabelsState | undefined {
        return this.makeEndLabelsState({
            yAxis: this.yAxis,
            xRange: [this.startX, this.endX],
        })
    }

    @computed private get seriesLabelText(): {
        start?: SeriesLabelText
        end?: SeriesLabelText
    } {
        const { endLabelNames, values } = getVisibleLabels(
            this.manager.labelMode
        )
        return {
            start: values ? (endLabelNames ? "name" : "value") : undefined,
            end: values ? "value" : endLabelNames ? "name" : undefined,
        }
    }

    private labelsMaxWidth(text?: SeriesLabelText): number {
        return text === "name" ? 0.25 * this.bounds.width : Infinity
    }

    @computed private get startLabelsSeries(): Omit<
        InitialAnchoredLabelSeries,
        "position"
    >[] {
        const { start } = this.seriesLabelText
        if (!this.manager.showSeriesLabels || !start) return []

        return this.chartState.series.map((series) => {
            const { seriesName, displayName, color, focus } = series
            const firstPoint = series.start
            const value = firstPoint?.value ?? 0
            const label =
                start === "name" ? displayName : this.formatLabel(value)

            const emphasis = resolveEmphasis({ focus })
            return { seriesName, value, label, color, emphasis }
        })
    }

    private makeStartLabelsState({
        yAxis,
        xRange,
        visibleEndLabels,
    }: {
        yAxis: VerticalAxis
        xRange: [number, number]
        visibleEndLabels: Set<SeriesName>
    }): AnchoredLabelsState | undefined {
        if (!this.manager.showSeriesLabels || !this.seriesLabelText.start)
            return undefined

        const series = this.startLabelsSeries.map((series) => {
            const position = {
                x: xRange[0],
                y: yAxis.place(series.value),
            }

            return { ...series, position }
        })

        return new AnchoredLabelsState(series, {
            ...this.labelFontSettings,
            textAnchor: "end",
            maxWidth: this.labelsMaxWidth(this.seriesLabelText.start),
            xRange,
            labelPadding: LABEL_PADDING,
            yRanges: { edge: this.labelsRange },
            compare: (
                a: InitialAnchoredLabelSeries,
                b: InitialAnchoredLabelSeries
            ): number => {
                // Prefer to label series that have an end label
                const hasEndLabelA = visibleEndLabels.has(a.seriesName)
                const hasEndLabelB = visibleEndLabels.has(b.seriesName)
                if (hasEndLabelA === hasEndLabelB) return 0
                return hasEndLabelA ? -1 : 1
            },
        })
    }

    @computed private get startLabelsState(): AnchoredLabelsState | undefined {
        return this.makeStartLabelsState({
            yAxis: this.yAxis,
            xRange: [this.startX, this.endX],
            visibleEndLabels: this.visibleEndLabels,
        })
    }

    @computed private get visibleEndLabels(): Set<SeriesName> {
        return new Set(
            this.endLabelsState?.series.map((series) => series.seriesName)
        )
    }

    /**
     * Estimated width of the start and end labels, used by innerBounds
     * to reserve space on the left and right of the chart area.
     *
     * Ideally, we'd derive this from the final label states, which know
     * exactly which labels are visible after collision detection. But that
     * would introduce a cyclic dependency: the label states need the axis
     * for pixel positions, the axis needs innerBounds, and innerBounds needs
     * these widths. To break the cycle, we run a preliminary layout pass
     * using the full bounds (without label padding).
     */
    @computed get estimatedLabelWidth(): SideWidths {
        // Preliminary bounds: account for the minimum padding from x-axis
        // time marks, but not for labels (which is what we're estimating)
        const preliminaryBounds = this.bounds
            .padBottom(this.xMarksHeight)
            .padRight(this.xEndPadding)
            .padLeft(this.xStartPadding)

        const preliminaryYAxis = this.chartState.toVerticalAxis(
            this.yAxisConfig,
            {
                yDomain: this.yDomain,
                yRange: preliminaryBounds.padHeight(6).yRange(),
            }
        )

        const preliminaryXScale = scaleLinear()
            .domain(this.chartState.xDomain)
            .range(preliminaryBounds.xRange())
        const preliminaryXRange: [number, number] = [
            preliminaryXScale(this.chartState.startTime),
            preliminaryXScale(this.chartState.endTime),
        ]

        const endLabelsState = this.makeEndLabelsState({
            yAxis: preliminaryYAxis,
            xRange: preliminaryXRange,
        })

        const visibleEndLabels = new Set(
            endLabelsState?.series.map((series) => series.seriesName)
        )

        const startLabelsState = this.makeStartLabelsState({
            yAxis: preliminaryYAxis,
            xRange: preliminaryXRange,
            visibleEndLabels,
        })

        return {
            left: startLabelsState?.width ?? 0,
            right: endLabelsState?.width ?? 0,
        }
    }

    // Consumed by FacetChart to align chart content across facets
    @computed get verticalLabelWidths(): SideWidths {
        return this.estimatedLabelWidth
    }

    // Consumed by FacetChart to align the facet label with the plot content
    // (here: the slope chart's start-time label)
    @computed get contentInset(): SideWidths | undefined {
        if (this.chartState.errorInfo.reason) return undefined
        const { bounds } = this
        return {
            left: this.startX - 0.5 * this.xStartMarkWidth - bounds.left,
            right: bounds.right - (this.endX + 0.5 * this.xEndMarkWidth),
        }
    }

    @computed private get effectiveLabelWidths(): SideWidths {
        const shared = this.manager.sharedVerticalLabelWidths
        return {
            left: Math.max(shared?.left ?? 0, this.verticalLabelWidths.left),
            right: Math.max(shared?.right ?? 0, this.verticalLabelWidths.right),
        }
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataMessage
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return (
            <>
                <SlopeChartXAxis
                    axis={this.xAxis}
                    bounds={this.slopeAreaBounds}
                    padding={2}
                />
                <g>
                    {this.renderSeries.map((series) => (
                        <Slope
                            key={series.seriesName}
                            series={series}
                            dotRadius={DOT_RADIUS}
                            strokeWidth={1.5}
                            outlineWidth={0}
                            styleByEmphasis={THUMBNAIL_LINE_STYLE}
                        />
                    ))}
                </g>
                {this.startLabelsState && (
                    <AnchoredLabels state={this.startLabelsState} />
                )}
                {this.endLabelsState && (
                    <AnchoredLabels state={this.endLabelsState} />
                )}
            </>
        )
    }
}
