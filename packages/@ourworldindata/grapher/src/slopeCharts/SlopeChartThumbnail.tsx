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
    SlopeChartSeries,
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
    GRAPHER_FONT_SCALE_12,
    FontSettings,
} from "../core/GrapherConstants"
import { Bounds, SeriesName } from "@ourworldindata/utils"
import { HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { Slope } from "./Slope"
import { SlopeChartXAxis } from "./SlopeChartXAxis"
import { InitialAnchoredLabelSeries } from "../anchoredLabels/AnchoredLabelsTypes.js"
import { AnchoredLabelsState } from "../anchoredLabels/AnchoredLabelsState"
import { AnchoredLabels } from "../anchoredLabels/AnchoredLabels"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"

const DOT_RADIUS = 3.5
const SPACE_BETWEEN_DOT_AND_LABEL = 4

const LABEL_PADDING = DOT_RADIUS + SPACE_BETWEEN_DOT_AND_LABEL

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
        return Bounds.forText(this.formattedStartTime, {
            fontSize: this.xMarkFontSize,
        }).width
    }

    @computed private get xEndMarkWidth(): number {
        return Bounds.forText(this.formattedEndTime, {
            fontSize: this.xMarkFontSize,
        }).width
    }

    @computed private get xMarksHeight(): number {
        if (this.xAxisConfig.hideTickLabels) return 0
        return this.xMarkFontSize
    }

    @computed get innerBounds(): Bounds {
        const { left, right } = this.effectiveLabelWidths
        const rightPadding = Math.max(
            right > 0 ? right + LABEL_PADDING : 0, // end labels plus padding
            0.5 * this.xEndMarkWidth // half the width of the end time label (since it's centered)
        )
        const leftPadding = Math.max(
            left > 0 ? left + LABEL_PADDING : 0, // start labels plus padding
            0.5 * this.xStartMarkWidth // half the width of the start time label (since it's centered)
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
        return new AxisConfig({ ...xAxisConfig, ...overrides }, this)
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
            fontSize: Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize),
            fontWeight: 500,
            lineHeight: 1,
        }
    }

    private formatLabel(value: number): string {
        return this.chartState.formatColumn.formatValueShortWithAbbreviations(
            value
        )
    }

    @computed private get labelCandidateSeries(): SlopeChartSeries[] {
        // If any series is focused, only show the labels for those
        return this.chartState.isFocusModeActive
            ? this.chartState.series.filter((series) => series.focus?.active)
            : this.chartState.series
    }

    @computed private get labelsRange(): [number, number] {
        const {
            xMarksHeight,
            manager: { chartAreaPadding = 0 },
        } = this

        return this.bounds
            .expand({
                top: chartAreaPadding,
                bottom: chartAreaPadding + xMarksHeight,
            })
            .yRange()
    }

    @computed private get endLabelsSeries(): Omit<
        InitialAnchoredLabelSeries,
        "position"
    >[] {
        if (!this.manager.showSeriesLabels) return []

        return this.labelCandidateSeries.map((series) => {
            const { seriesName, color } = series

            const lastPoint = series.end
            const value = lastPoint?.value ?? 0

            const label = this.formatLabel(value)

            return { seriesName, value, label, color }
        })
    }

    private makeEndLabelsState({
        yAxis,
        endX,
    }: {
        yAxis: VerticalAxis
        endX: number
    }): AnchoredLabelsState | undefined {
        if (!this.manager.showSeriesLabels) return undefined

        const series = this.endLabelsSeries.map((series) => {
            const position = {
                x: endX,
                y: yAxis.place(series.value),
            }

            return { ...series, position }
        })

        return new AnchoredLabelsState(series, {
            ...this.labelFontSettings,
            labelPadding: LABEL_PADDING,
            yRange: this.labelsRange,
        })
    }

    @computed private get endLabelsState(): AnchoredLabelsState | undefined {
        return this.makeEndLabelsState({ yAxis: this.yAxis, endX: this.endX })
    }

    @computed private get shouldShowValueLabelsOnly(): boolean {
        return !!this.manager.useMinimalLabeling
    }

    @computed private get startLabelsMaxWidth(): number | undefined {
        return this.shouldShowValueLabelsOnly
            ? undefined
            : 0.25 * this.bounds.width
    }

    @computed private get startLabelsSeries(): Omit<
        InitialAnchoredLabelSeries,
        "position"
    >[] {
        if (!this.manager.showSeriesLabels) return []

        return this.labelCandidateSeries.map((series) => {
            const { seriesName, color } = series
            const firstPoint = series.start
            const value = firstPoint?.value ?? 0
            const label = this.shouldShowValueLabelsOnly
                ? this.formatLabel(value)
                : seriesName

            return { seriesName, value, label, color }
        })
    }

    private makeStartLabelsState({
        yAxis,
        startX,
        visibleEndLabels,
    }: {
        yAxis: VerticalAxis
        startX: number
        visibleEndLabels: Set<SeriesName>
    }): AnchoredLabelsState | undefined {
        if (!this.manager.showSeriesLabels) return undefined

        const series = this.startLabelsSeries.map((series) => {
            const position = {
                x: startX,
                y: yAxis.place(series.value),
            }

            return { ...series, position }
        })

        return new AnchoredLabelsState(series, {
            ...this.labelFontSettings,
            textAnchor: "end",
            maxWidth: this.startLabelsMaxWidth,
            labelPadding: LABEL_PADDING,
            yRange: this.labelsRange,
            resolveCollision: (
                s1: InitialAnchoredLabelSeries,
                s2: InitialAnchoredLabelSeries
            ): InitialAnchoredLabelSeries => {
                // Prefer to label series that have an end label
                if (visibleEndLabels.has(s1.seriesName)) return s1
                if (visibleEndLabels.has(s2.seriesName)) return s2

                return s1 // No preference
            },
        })
    }

    @computed private get startLabelsState(): AnchoredLabelsState | undefined {
        return this.makeStartLabelsState({
            yAxis: this.yAxis,
            startX: this.startX,
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
            .padRight(0.5 * this.xEndMarkWidth)
            .padLeft(0.5 * this.xStartMarkWidth)

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
        const preliminaryStartX = preliminaryXScale(this.chartState.startTime)
        const preliminaryEndX = preliminaryXScale(this.chartState.endTime)

        const endLabelsState = this.makeEndLabelsState({
            yAxis: preliminaryYAxis,
            endX: preliminaryEndX,
        })

        const visibleEndLabels = new Set(
            endLabelsState?.series.map((series) => series.seriesName)
        )

        const startLabelsState = this.makeStartLabelsState({
            yAxis: preliminaryYAxis,
            startX: preliminaryStartX,
            visibleEndLabels,
        })

        return {
            left: startLabelsState?.width ?? 0,
            right: endLabelsState?.width ?? 0,
        }
    }

    // Consumed by FacetChart to align gridlines across facets
    @computed get verticalLabelWidths(): SideWidths {
        return this.estimatedLabelWidth
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
