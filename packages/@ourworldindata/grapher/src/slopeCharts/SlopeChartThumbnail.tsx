import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { scaleLinear, ScaleLinear } from "d3-scale"
import { ChartInterface } from "../chart/ChartInterface"
import { SlopeChartState } from "./SlopeChartState.js"
import { type SlopeChartProps } from "./SlopeChart.js"
import {
    PlacedSlopeChartSeries,
    RenderSlopeChartSeries,
    SlopeChartManager,
    SlopeChartSeries,
} from "./SlopeChartConstants"
import {
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
import { VerticalAxis } from "../axis/Axis"
import { Slope } from "./Slope"
import { InitialSimpleLabelSeries } from "../verticalLabels/SimpleVerticalLabelsTypes.js"
import { SimpleVerticalLabelsState } from "../verticalLabels/SimpleVerticalLabelsState"
import { SimpleVerticalLabels } from "../verticalLabels/SimpleVerticalLabels"
import { MarkX } from "./MarkX"
import { NoDataModal } from "../noDataModal/NoDataModal"

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
        return this.xMarkFontSize
    }

    @computed get innerBounds(): Bounds {
        const rightPadding = Math.max(
            this.estimatedLabelWidth.right, // width of end labels plus padding
            0.5 * this.xEndMarkWidth // half the width of the end time label (since it's centered)
        )
        const leftPadding = Math.max(
            this.estimatedLabelWidth.left, // width of start labels plus padding
            0.5 * this.xStartMarkWidth // half the width of the start time label (since it's centered)
        )

        return this.bounds
            .padBottom(this.xMarksHeight)
            .padRight(rightPadding)
            .padLeft(leftPadding)
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

    @computed private get xRange(): [number, number] {
        return this.innerBounds.xRange()
    }

    @computed private get xScale(): ScaleLinear<number, number> {
        const { xRange } = this
        return scaleLinear().domain(this.chartState.xDomain).range(xRange)
    }

    @computed private get startX(): number {
        return this.xScale(this.chartState.startTime)
    }

    @computed private get endX(): number {
        return this.xScale(this.chartState.endTime)
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
        InitialSimpleLabelSeries,
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
    }): SimpleVerticalLabelsState | undefined {
        if (!this.manager.showSeriesLabels) return undefined

        const series = this.endLabelsSeries.map((series) => {
            const position = {
                x: endX,
                y: yAxis.place(series.value),
            }

            return { ...series, position }
        })

        return new SimpleVerticalLabelsState(series, {
            ...this.labelFontSettings,
            markerRadius: DOT_RADIUS,
            labelOffset: SPACE_BETWEEN_DOT_AND_LABEL,
            yRange: this.labelsRange,
        })
    }

    @computed private get endLabelsState():
        | SimpleVerticalLabelsState
        | undefined {
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
        InitialSimpleLabelSeries,
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
    }): SimpleVerticalLabelsState | undefined {
        if (!this.manager.showSeriesLabels) return undefined

        const series = this.startLabelsSeries.map((series) => {
            const position = {
                x: startX,
                y: yAxis.place(series.value),
            }

            return { ...series, position }
        })

        return new SimpleVerticalLabelsState(series, {
            ...this.labelFontSettings,
            textAnchor: "end",
            maxWidth: this.startLabelsMaxWidth,
            markerRadius: DOT_RADIUS,
            labelOffset: SPACE_BETWEEN_DOT_AND_LABEL,
            yRange: this.labelsRange,
            resolveCollision: (
                s1: InitialSimpleLabelSeries,
                s2: InitialSimpleLabelSeries
            ): InitialSimpleLabelSeries => {
                // Prefer to label series that have an end label
                if (visibleEndLabels.has(s1.seriesName)) return s1
                if (visibleEndLabels.has(s2.seriesName)) return s2

                return s1 // No preference
            },
        })
    }

    @computed private get startLabelsState():
        | SimpleVerticalLabelsState
        | undefined {
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
    @computed private get estimatedLabelWidth(): {
        right: number
        left: number
    } {
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

        const endWidth = endLabelsState?.width ?? 0
        const startWidth = startLabelsState?.width ?? 0

        return {
            right: endWidth > 0 ? endWidth + LABEL_PADDING : 0,
            left: startWidth > 0 ? startWidth + LABEL_PADDING : 0,
        }
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return (
            <>
                <MarkX
                    label={this.formattedStartTime}
                    x={this.startX}
                    top={this.innerBounds.top}
                    bottom={this.innerBounds.bottom}
                    labelPadding={4}
                    fontSize={this.yAxis.tickFontSize}
                />
                <MarkX
                    label={this.formattedEndTime}
                    x={this.endX}
                    top={this.innerBounds.top}
                    bottom={this.innerBounds.bottom}
                    labelPadding={4}
                    fontSize={this.yAxis.tickFontSize}
                />
                <g>
                    {this.renderSeries.map((series) => (
                        <Slope
                            key={series.seriesName}
                            series={series}
                            dotRadius={DOT_RADIUS}
                            strokeWidth={1.5}
                            outlineWidth={0}
                            outlineStroke={this.manager.backgroundColor}
                        />
                    ))}
                </g>
                {this.startLabelsState && (
                    <SimpleVerticalLabels state={this.startLabelsState} />
                )}
                {this.endLabelsState && (
                    <SimpleVerticalLabels state={this.endLabelsState} />
                )}
            </>
        )
    }
}
