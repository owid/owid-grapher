import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import * as _ from "lodash-es"
import { Bounds, SeriesName } from "@ourworldindata/utils"
import { ChartInterface } from "../chart/ChartInterface"
import { LineChartState } from "./LineChartState"
import { LineChartProps } from "./LineChart.js"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import {
    LineChartManager,
    PlacedLineChartSeries,
    PlacedPoint,
    RenderLineChartSeries,
} from "./LineChartConstants"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { Lines } from "./Lines"
import {
    getYAxisConfigDefaults,
    toPlacedLineChartSeries,
    toRenderLineChartSeries,
} from "./LineChartHelpers"
import {
    HorizontalAxisComponent,
    VerticalAxisZeroLine,
} from "../axis/AxisViews"
import {
    InitialVerticalLabelsSeries,
    VerticalLabelsState,
} from "../verticalLabels/VerticalLabelsState"
import { VerticalLabels } from "../verticalLabels/VerticalLabels"
import { darkenColorForLine } from "../color/ColorUtils.js"

const DOT_RADIUS = 4
const SPACE_BETWEEN_DOT_AND_LABEL = 4

const LABEL_PADDING = DOT_RADIUS + SPACE_BETWEEN_DOT_AND_LABEL

@observer
export class LineChartThumbnail
    extends React.Component<LineChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: LineChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): LineChartState {
        return this.props.chartState
    }

    @computed private get manager(): LineChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padRight(this.paddedEndLabelsWidth)
            .padLeft(this.paddedStartLabelsWidth)
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
        const custom = { labelPadding: 0 }
        return new AxisConfig({ ...custom, ...xAxisConfig }, this)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get placedSeries(): PlacedLineChartSeries[] {
        return toPlacedLineChartSeries(this.chartState.series, {
            chartState: this.chartState,
            dualAxis: this.dualAxis,
        })
    }

    @computed private get renderSeries(): RenderLineChartSeries[] {
        return toRenderLineChartSeries(this.placedSeries, {
            isFocusModeActive: this.chartState.isFocusModeActive,
        })
    }

    /** Start points displayed as dots */
    @computed private get visibleStartPoints(): PlacedPoint[] {
        return this.renderSeries
            .filter(
                (series) =>
                    this.visibleStartLabels.has(series.seriesName) &&
                    // Only show start points for historical series, not projected ones
                    !series.isProjection
            )
            .map((series) => _.minBy(series.placedPoints, (point) => point.x))
            .filter((point) => point !== undefined)
    }

    /** End points displayed as dots */
    @computed private get visibleEndPoints(): PlacedPoint[] {
        return this.renderSeries
            .filter(
                (series) =>
                    this.visibleEndLabels.has(series.seriesName) &&
                    // When projected series exist in the chart, only show end dots
                    // for the projected series. Otherwise, show end dots for all series
                    (!this.hasProjectedSeries || series.isProjection)
            )
            .map((series) => _.maxBy(series.placedPoints, (point) => point.x))
            .filter((point) => point !== undefined)
    }

    // Same as dualAxis.verticalAxis, but doesn't depend on innerBounds
    @computed get outerBoundsVerticalAxis(): VerticalAxis {
        const yAxis = this.verticalAxisPart.clone()
        yAxis.range = this.bounds.yRange()
        return yAxis
    }

    @computed private get labelFontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
    }

    private formatLabel(value: number): string {
        return this.chartState.formatColumn.formatValueShortWithAbbreviations(
            value
        )
    }

    @computed private get hasProjectedSeries(): boolean {
        return this.chartState.series.some((series) => !!series.isProjection)
    }

    @computed private get endLabelsState(): VerticalLabelsState | undefined {
        if (!this.manager.showLegend) return undefined

        let labelCandidateSeries = this.chartState.series

        // If there is a projected series, only show the labels for the projected ones
        if (this.hasProjectedSeries)
            labelCandidateSeries = labelCandidateSeries.filter(
                (series) => series.isProjection
            )

        // If any series is focused, only show the labels for the focused ones
        if (this.chartState.isFocusModeActive)
            labelCandidateSeries = labelCandidateSeries.filter(
                (series) => series.focus.active
            )

        const endPointBySeriesName = new Map(
            labelCandidateSeries.map((series) => [
                series.seriesName,
                _.maxBy(series.points, (point) => point.x),
            ])
        )

        const series = labelCandidateSeries.map((series) => {
            const { seriesName } = series

            const endPoint = endPointBySeriesName.get(series.seriesName)
            const value = endPoint?.y ?? 0

            const yPosition = this.outerBoundsVerticalAxis.place(value)
            const label = this.formatLabel(value)

            const color = this.chartState.hasColorScale
                ? darkenColorForLine(
                      this.chartState.getColorScaleColor(endPoint?.colorValue)
                  )
                : series.color

            const labelSeries = { seriesName, value, label, yPosition, color }

            return { ...labelSeries, point: endPoint }
        })

        return new VerticalLabelsState(series, {
            fontSize: this.labelFontSize,
            yRange: this.bounds
                .expand(this.manager.chartAreaPadding ?? 0)
                .yRange(),
            resolveCollision: (
                s1: InitialVerticalLabelsSeries,
                s2: InitialVerticalLabelsSeries
            ): InitialVerticalLabelsSeries => {
                const endPoint1 = endPointBySeriesName.get(s1.seriesName)
                const endPoint2 = endPointBySeriesName.get(s2.seriesName)

                const x1 = endPoint1?.x ?? 0
                const x2 = endPoint2?.x ?? 0

                // Prefer the series with the larger x value
                if (x1 > x2) return s1
                if (x2 > x1) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get startLabelsState(): VerticalLabelsState | undefined {
        if (!this.manager.showLegend) return undefined

        const showEntityNames =
            !this.manager.isDisplayedAlongsideComplementaryTable

        let labelCandidateSeries = this.chartState.series

        // If there is a projected series, only show the labels for the historical ones
        if (this.hasProjectedSeries)
            labelCandidateSeries = labelCandidateSeries.filter(
                (series) => !series.isProjection
            )

        // If any series is focused, only show the labels for the focused ones
        if (this.chartState.isFocusModeActive)
            labelCandidateSeries = labelCandidateSeries.filter(
                (series) => series.focus.active
            )

        const startPointBySeriesName = new Map(
            labelCandidateSeries.map((series) => [
                series.seriesName,
                _.minBy(series.points, (point) => point.x),
            ])
        )

        const series = labelCandidateSeries
            .map((series) => {
                const { seriesName } = series

                // Don't show start label if there is only a single point
                if (series.points.length < 2) return undefined

                const startPoint = startPointBySeriesName.get(series.seriesName)
                const value = startPoint?.y ?? 0

                const yPosition = this.outerBoundsVerticalAxis.place(value)
                const label = showEntityNames
                    ? seriesName
                    : this.formatLabel(value)

                const color = this.chartState.hasColorScale
                    ? darkenColorForLine(
                          this.chartState.getColorScaleColor(
                              startPoint?.colorValue
                          )
                      )
                    : series.color

                const labelSeries = {
                    seriesName,
                    value,
                    label,
                    yPosition,
                    color,
                }
                return { ...labelSeries, point: startPoint }
            })
            .filter((series) => series !== undefined)

        return new VerticalLabelsState(series, {
            fontSize: this.labelFontSize,
            maxWidth: showEntityNames ? 0.25 * this.bounds.width : undefined,
            yRange: this.bounds
                .expand(this.manager.chartAreaPadding ?? 0)
                .yRange(),
            resolveCollision: (
                s1: InitialVerticalLabelsSeries,
                s2: InitialVerticalLabelsSeries
            ): InitialVerticalLabelsSeries => {
                // Prefer to label series that have an end label
                if (this.visibleEndLabels.has(s1.seriesName)) return s1
                if (this.visibleEndLabels.has(s2.seriesName)) return s2

                const startPoint1 = startPointBySeriesName.get(s1.seriesName)
                const startPoint2 = startPointBySeriesName.get(s2.seriesName)

                const x1 = startPoint1?.x ?? 0
                const x2 = startPoint2?.x ?? 0

                // Prefer the series with the larger x value
                if (x1 > x2) return s1
                if (x2 > x1) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get endLabelsWidth(): number {
        return this.endLabelsState?.width ?? 0
    }

    @computed private get startLabelsWidth(): number {
        return this.startLabelsState?.width ?? 0
    }

    @computed private get paddedEndLabelsWidth(): number {
        return this.endLabelsWidth > 0 ? this.endLabelsWidth + LABEL_PADDING : 0
    }

    @computed private get paddedStartLabelsWidth(): number {
        return this.startLabelsWidth > 0
            ? this.startLabelsWidth + LABEL_PADDING
            : 0
    }

    @computed private get visibleStartLabels(): Set<SeriesName> {
        return new Set(
            this.startLabelsState?.series.map((series) => series.seriesName)
        )
    }

    @computed private get visibleEndLabels(): Set<SeriesName> {
        return new Set(
            this.endLabelsState?.series.map((series) => series.seriesName)
        )
    }

    override render(): React.ReactElement | null {
        if (this.chartState.errorInfo.reason) return null

        return (
            <>
                <VerticalAxisZeroLine
                    verticalAxis={this.dualAxis.verticalAxis}
                    bounds={this.dualAxis.innerBounds}
                />
                <HorizontalAxisComponent
                    axis={this.dualAxis.horizontalAxis}
                    bounds={this.dualAxis.bounds}
                    showEndpointsOnly
                />
                <Lines
                    series={this.renderSeries}
                    dualAxis={this.dualAxis}
                    multiColor={this.chartState.hasColorScale}
                    hidePoints
                    lineStrokeWidth={1.5}
                    lineOutlineWidth={0}
                    isStatic={this.manager.isStatic}
                />
                {this.visibleStartPoints.map((point, index) => (
                    <Dot key={index} point={point} />
                ))}
                {this.visibleEndPoints.map((point, index) => (
                    <Dot key={index} point={point} />
                ))}
                {this.startLabelsState && (
                    <VerticalLabels
                        state={this.startLabelsState}
                        yAxis={this.dualAxis.verticalAxis}
                        x={this.innerBounds.left - LABEL_PADDING}
                        xAnchor="end"
                    />
                )}
                {this.endLabelsState && (
                    <VerticalLabels
                        state={this.endLabelsState}
                        yAxis={this.dualAxis.verticalAxis}
                        x={this.innerBounds.right + LABEL_PADDING}
                    />
                )}
            </>
        )
    }
}

function Dot({ point }: { point: PlacedPoint }): React.ReactElement | null {
    return (
        <circle cx={point.x} cy={point.y} r={DOT_RADIUS} fill={point.color} />
    )
}
