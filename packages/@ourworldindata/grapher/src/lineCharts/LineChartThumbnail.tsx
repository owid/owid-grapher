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
    LinePoint,
    PlacedLineChartSeries,
    PlacedPoint,
    RenderLineChartSeries,
} from "./LineChartConstants"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    FontSettings,
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
import { InitialSimpleLabelSeries } from "../verticalLabels/SimpleVerticalLabelsTypes"
import { SimpleVerticalLabelsState } from "../verticalLabels/SimpleVerticalLabelsState"
import { SimpleVerticalLabels } from "../verticalLabels/SimpleVerticalLabels"
import { darkenColorForLine } from "../color/ColorUtils.js"
import { NoDataModal } from "../noDataModal/NoDataModal"

const DOT_RADIUS = 4
const SPACE_BETWEEN_DOT_AND_LABEL = 4
const LABEL_PADDING = DOT_RADIUS + SPACE_BETWEEN_DOT_AND_LABEL
const ZERO_LINE_STROKE_WIDTH = 1

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
            .padRight(this.estimatedLabelWidth.right)
            .padLeft(this.estimatedLabelWidth.left)
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
            .map((series) =>
                _.minBy(series.placedPoints, (point) => point.time)
            )
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
            .map((series) =>
                _.maxBy(series.placedPoints, (point) => point.time)
            )
            .filter((point) => point !== undefined)
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

    @computed private get hasProjectedSeries(): boolean {
        return this.chartState.series.some((series) => !!series.isProjection)
    }

    @computed private get labelsRange(): [number, number] {
        const {
            horizontalAxisPart,
            manager: { chartAreaPadding = 0 },
        } = this

        return this.bounds
            .expand({
                top: chartAreaPadding,
                bottom: chartAreaPadding + horizontalAxisPart.height,
            })
            .yRange()
    }

    private makeZeroLineBounds({ dualAxis }: { dualAxis: DualAxis }): Bounds {
        const { innerBounds, verticalAxis } = dualAxis
        const zeroLineY = verticalAxis.place(0)
        const strokeWidth = ZERO_LINE_STROKE_WIDTH
        return new Bounds(
            innerBounds.left,
            zeroLineY - strokeWidth / 2,
            innerBounds.width,
            strokeWidth
        )
    }

    @computed private get zeroLineBounds(): Bounds {
        return this.makeZeroLineBounds({ dualAxis: this.dualAxis })
    }

    @computed private get endLabelCandidateSeriesNames(): SeriesName[] {
        if (!this.manager.showSeriesLabels) return []

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

        return labelCandidateSeries.map((series) => series.seriesName)
    }

    @computed private get endPointBySeriesName(): Map<
        SeriesName,
        LinePoint | undefined
    > {
        return new Map(
            this.chartState.series
                // Scoped to end label candidates so that when historical and
                // projected segments share a series name, we pick the correct point
                .filter((series) =>
                    this.endLabelCandidateSeriesNames.includes(
                        series.seriesName
                    )
                )
                .map((series) => [
                    series.seriesName,
                    _.maxBy(series.points, (point) => point.x),
                ])
        )
    }

    @computed private get endLabelsSeries(): Omit<
        InitialSimpleLabelSeries,
        "position"
    >[] {
        return this.endLabelCandidateSeriesNames
            .map((seriesName) => {
                const series = this.chartState.seriesByName.get(seriesName)
                if (!series) return undefined

                const endPoint = this.endPointBySeriesName.get(
                    series.seriesName
                )
                if (!endPoint) return undefined

                const value = endPoint.y
                const label = this.formatLabel(value)

                const color = this.chartState.hasColorScale
                    ? darkenColorForLine(
                          this.chartState.getColorScaleColor(
                              endPoint.colorValue
                          )
                      )
                    : series.color

                return { seriesName, value, label, color }
            })
            .filter((series) => series !== undefined)
    }

    private makeEndLabelsState({
        dualAxis,
        avoidBounds,
    }: {
        dualAxis: DualAxis
        avoidBounds: Bounds[]
    }): SimpleVerticalLabelsState | undefined {
        if (!this.manager.showSeriesLabels) return undefined

        const series = this.endLabelsSeries.map((series) => {
            const endPoint = this.endPointBySeriesName.get(series.seriesName)

            const position = {
                x: dualAxis.horizontalAxis.place(endPoint?.x ?? 0),
                y: dualAxis.verticalAxis.place(endPoint?.y ?? 0),
            }

            return { ...series, position }
        })

        return new SimpleVerticalLabelsState(series, {
            ...this.labelFontSettings,
            textAnchor: "start",
            yRange: this.labelsRange,
            labelOffset: SPACE_BETWEEN_DOT_AND_LABEL,
            markerRadius: DOT_RADIUS,
            avoidBounds,
            resolveCollision: (
                s1: InitialSimpleLabelSeries,
                s2: InitialSimpleLabelSeries
            ): InitialSimpleLabelSeries => {
                const endPoint1 = this.endPointBySeriesName.get(s1.seriesName)
                const endPoint2 = this.endPointBySeriesName.get(s2.seriesName)

                const x1 = endPoint1?.x ?? 0
                const x2 = endPoint2?.x ?? 0

                // Prefer the series with the larger x value
                if (x1 > x2) return s1
                if (x2 > x1) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get endLabelsState():
        | SimpleVerticalLabelsState
        | undefined {
        return this.makeEndLabelsState({
            dualAxis: this.dualAxis,
            avoidBounds: [this.zeroLineBounds],
        })
    }

    @computed private get startLabelCandidateSeriesNames(): SeriesName[] {
        if (!this.manager.showSeriesLabels) return []

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

        return labelCandidateSeries.map((series) => series.seriesName)
    }

    @computed private get startPointBySeriesName(): Map<
        SeriesName,
        LinePoint | undefined
    > {
        return new Map(
            this.chartState.series
                // Scoped to start label candidates so that when historical and
                // projected segments share a series name, we pick the correct point
                .filter((series) =>
                    this.startLabelCandidateSeriesNames.includes(
                        series.seriesName
                    )
                )
                .map((series) => [
                    series.seriesName,
                    _.minBy(series.points, (point) => point.x),
                ])
        )
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
        return this.startLabelCandidateSeriesNames
            .map((seriesName) => {
                const series = this.chartState.seriesByName.get(seriesName)
                if (!series) return undefined

                // Don't show start label if there is only a single point
                if (series.points.length < 2) return undefined

                const startPoint = this.startPointBySeriesName.get(
                    series.seriesName
                )
                if (!startPoint) return undefined

                const value = startPoint.y
                const label = this.shouldShowValueLabelsOnly
                    ? this.formatLabel(value)
                    : seriesName

                const color = this.chartState.hasColorScale
                    ? darkenColorForLine(
                          this.chartState.getColorScaleColor(
                              startPoint.colorValue
                          )
                      )
                    : series.color

                return { seriesName, value, label, color }
            })
            .filter((series) => series !== undefined)
    }

    private makeStartLabelsState({
        dualAxis,
        avoidBounds,
        visibleEndLabels,
    }: {
        dualAxis: DualAxis
        avoidBounds: Bounds[]
        visibleEndLabels: Set<SeriesName>
    }): SimpleVerticalLabelsState | undefined {
        if (!this.manager.showSeriesLabels) return undefined

        const series = this.startLabelsSeries.map((series) => {
            const startPoint = this.startPointBySeriesName.get(
                series.seriesName
            )

            const position = {
                x: startPoint
                    ? dualAxis.horizontalAxis.place(startPoint.x)
                    : dualAxis.bounds.left,
                y: dualAxis.verticalAxis.place(series.value),
            }

            return { ...series, position }
        })

        return new SimpleVerticalLabelsState(series, {
            ...this.labelFontSettings,
            maxWidth: this.startLabelsMaxWidth,
            textAnchor: "end",
            labelOffset: SPACE_BETWEEN_DOT_AND_LABEL,
            markerRadius: DOT_RADIUS,
            yRange: this.labelsRange,
            avoidBounds,
            resolveCollision: (
                s1: InitialSimpleLabelSeries,
                s2: InitialSimpleLabelSeries
            ): InitialSimpleLabelSeries => {
                // Prefer to label series that have an end label
                if (visibleEndLabels.has(s1.seriesName)) return s1
                if (visibleEndLabels.has(s2.seriesName)) return s2

                const startPoint1 = this.startPointBySeriesName.get(
                    s1.seriesName
                )
                const startPoint2 = this.startPointBySeriesName.get(
                    s2.seriesName
                )

                const x1 = startPoint1?.x ?? 0
                const x2 = startPoint2?.x ?? 0

                // Prefer the series with the larger x value
                if (x1 > x2) return s1
                if (x2 > x1) return s2

                return s1 // No preference
            },
        })
    }

    @computed private get startLabelsState():
        | SimpleVerticalLabelsState
        | undefined {
        return this.makeStartLabelsState({
            dualAxis: this.dualAxis,
            avoidBounds: [this.zeroLineBounds],
            visibleEndLabels: this.visibleEndLabels,
        })
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
        const approximateDualAxis = new DualAxis({
            bounds: this.bounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })

        const zeroLineBounds = this.makeZeroLineBounds({
            dualAxis: approximateDualAxis,
        })

        const endLabelsState = this.makeEndLabelsState({
            dualAxis: approximateDualAxis,
            avoidBounds: [zeroLineBounds],
        })

        const visibleEndLabels = new Set(
            endLabelsState?.series.map((series) => series.seriesName)
        )

        const startLabelsState = this.makeStartLabelsState({
            dualAxis: approximateDualAxis,
            avoidBounds: [zeroLineBounds],
            visibleEndLabels,
        })

        const rightWidth = endLabelsState?.width ?? 0
        const leftWidth = startLabelsState?.width ?? 0

        return {
            right: rightWidth > 0 ? rightWidth + LABEL_PADDING : 0,
            left: leftWidth > 0 ? leftWidth + LABEL_PADDING : 0,
        }
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
                <VerticalAxisZeroLine
                    verticalAxis={this.dualAxis.verticalAxis}
                    bounds={this.dualAxis.innerBounds}
                    strokeWidth={ZERO_LINE_STROKE_WIDTH}
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
                    <SimpleVerticalLabels state={this.startLabelsState} />
                )}
                {this.endLabelsState && (
                    <SimpleVerticalLabels state={this.endLabelsState} />
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
