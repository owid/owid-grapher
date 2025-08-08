import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import * as _ from "lodash-es"
import { ChartInterface } from "../chart/ChartInterface"
import { LineChartState } from "./LineChartState"
import { LineChartProps } from "./LineChart.js"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import {
    LineChartManager,
    LineChartSeries,
    PlacedLineChartSeries,
    RenderLineChartSeries,
} from "./LineChartConstants"
import { Bounds, SeriesName } from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { Lines } from "./Lines"
import {
    getYAxisConfigDefaults,
    toHorizontalAxis,
    toPlacedSeries,
    toVerticalAxis,
} from "./LineChartHelpers"
import {
    HorizontalAxisComponent,
    HorizontalAxisDomainLine,
} from "../axis/AxisViews"
import { byHoverThenFocusState } from "../chart/ChartUtils"
import {
    InitialVerticalAxisLabelsSeries,
    VerticalAxisLabelsState,
} from "../verticalAxisLabels/VerticalAxisLabelsState"
import { VerticalAxisLabels } from "../verticalAxisLabels/VerticalAxisLabels"

const DOT_RADIUS = 4
const SPACE_BETWEEN_DOT_AND_LABEL = 4

const LEGEND_PADDING = DOT_RADIUS + SPACE_BETWEEN_DOT_AND_LABEL

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
            .padRight(
                this.rightAxisLabelsWidth
                    ? this.rightAxisLabelsWidth + LEGEND_PADDING
                    : 0
            )
            .padLeft(
                this.leftAxisLabelsWidth
                    ? this.leftAxisLabelsWidth + LEGEND_PADDING
                    : 0
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

        // Trick to display the axis label at the same height as the ticks
        const tickFontSize = Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
        const custom = { labelPadding: -tickFontSize + 1 }

        return new AxisConfig({ ...custom, ...xAxisConfig }, this)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return toHorizontalAxis(this.xAxisConfig, this.chartState)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return toVerticalAxis(this.yAxisConfig, this.chartState)
    }

    @computed get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })
    }

    @computed get placedSeries(): PlacedLineChartSeries[] {
        return toPlacedSeries(this.chartState.series, this)
    }

    // TODO: add toRenderSeries?
    @computed private get renderSeries(): RenderLineChartSeries[] {
        let series = this.placedSeries.map((series) => {
            return {
                ...series,
                hover: { active: false, background: false },
                focus: series.focus,
            }
        })

        // draw lines on top of markers-only series
        series = _.sortBy(series, (series) => !series.plotMarkersOnly)

        // sort by interaction state so that foreground series
        // are drawn on top of background series
        if (this.chartState.isFocusModeActive) {
            series = _.sortBy(series, byHoverThenFocusState)
        }

        return series
    }

    // Same as dualAxis.verticalAxis, but doesn't depend on innerBounds
    @computed get yAxis(): VerticalAxis {
        const yAxis = this.verticalAxisPart.clone()
        yAxis.range = this.bounds.yRange()
        return yAxis
    }

    @computed private get legendLabelFontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
    }

    private constructLabelSeries(
        series: LineChartSeries,
        value: number
    ): InitialVerticalAxisLabelsSeries {
        const { seriesName, color } = series

        const position = this.yAxis.place(value)
        const label =
            this.chartState.formatColumn.formatValueShortWithAbbreviations(
                value
            )

        return { seriesName, value, label, position, color }
    }

    @computed private get hasProjectedSeries(): boolean {
        return this.chartState.series.some((series) => !!series.isProjection)
    }

    @computed private get rightAxisLabelsState():
        | VerticalAxisLabelsState
        | undefined {
        if (!this.manager.showLegend) return undefined

        let activeSeries = this.chartState.series
        if (this.hasProjectedSeries)
            activeSeries = activeSeries.filter((series) => series.isProjection)

        activeSeries = this.chartState.isFocusModeActive
            ? activeSeries.filter((series) => series.focus.active)
            : activeSeries

        const lastPointBySeriesName = new Map(
            activeSeries.map((series) => [
                series.seriesName,
                _.maxBy(series.points, (point) => point.x),
            ])
        )

        const series = activeSeries.map((series) => {
            const lastPoint = lastPointBySeriesName.get(series.seriesName)
            const value = lastPoint?.y ?? 0
            const labelSeries = this.constructLabelSeries(series, value)
            return { ...labelSeries, point: lastPoint }
        })

        return new VerticalAxisLabelsState(series, {
            fontSize: this.legendLabelFontSize,
            resolveCollision: (
                s1: InitialVerticalAxisLabelsSeries,
                s2: InitialVerticalAxisLabelsSeries
            ): InitialVerticalAxisLabelsSeries => {
                const lastPoint1 = lastPointBySeriesName.get(s1.seriesName)
                const lastPoint2 = lastPointBySeriesName.get(s2.seriesName)

                const x1 = lastPoint1?.x ?? 0
                const x2 = lastPoint2?.x ?? 0

                if (x1 > x2) return s1
                if (x2 > x1) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get leftAxisLabelsState():
        | VerticalAxisLabelsState
        | undefined {
        if (!this.manager.showLegend) return undefined

        let activeSeries = this.chartState.series
        if (this.hasProjectedSeries)
            activeSeries = activeSeries.filter((series) => !series.isProjection)

        activeSeries = this.chartState.isFocusModeActive
            ? activeSeries.filter((series) => series.focus.active)
            : activeSeries

        const firstPointBySeriesName = new Map(
            activeSeries.map((series) => [
                series.seriesName,
                _.minBy(series.points, (point) => point.x),
            ])
        )

        const series = activeSeries
            .map((series) => {
                if (series.points.length < 2) return undefined
                const firstPoint = firstPointBySeriesName.get(series.seriesName)
                const value = firstPoint?.y ?? 0
                const labelSeries = this.constructLabelSeries(series, value)
                return { ...labelSeries, point: firstPoint }
            })
            .filter((series) => series !== undefined)

        return new VerticalAxisLabelsState(series, {
            fontSize: this.legendLabelFontSize,
            resolveCollision: (
                s1: InitialVerticalAxisLabelsSeries,
                s2: InitialVerticalAxisLabelsSeries
            ): InitialVerticalAxisLabelsSeries => {
                if (this.visibleRightLabels.has(s1.seriesName)) return s1
                if (this.visibleRightLabels.has(s2.seriesName)) return s2

                const firstPoint1 = firstPointBySeriesName.get(s1.seriesName)
                const firstPoint2 = firstPointBySeriesName.get(s2.seriesName)

                const x1 = firstPoint1?.x ?? 0
                const x2 = firstPoint2?.x ?? 0

                if (x1 > x2) return s1
                if (x2 > x1) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get rightAxisLabelsWidth(): number {
        return this.rightAxisLabelsState?.width ?? 0
    }

    @computed private get leftAxisLabelsWidth(): number {
        return this.leftAxisLabelsState?.width ?? 0
    }

    @computed private get visibleLeftLabels(): Set<SeriesName> {
        return new Set(
            this.leftAxisLabelsState?.series.map((series) => series.seriesName)
        )
    }

    @computed private get visibleRightLabels(): Set<SeriesName> {
        return new Set(
            this.rightAxisLabelsState?.series.map((series) => series.seriesName)
        )
    }

    override render(): React.ReactElement | null {
        if (this.chartState.errorInfo.reason) return null

        return (
            <>
                <HorizontalAxisDomainLine
                    horizontalAxis={this.dualAxis.horizontalAxis}
                    bounds={this.dualAxis.innerBounds}
                />
                <HorizontalAxisComponent
                    axis={this.dualAxis.horizontalAxis}
                    bounds={this.dualAxis.bounds}
                    onlyShowMinMaxLabels
                />
                <Lines
                    series={this.renderSeries}
                    dualAxis={this.dualAxis}
                    multiColor={this.chartState.hasColorScale}
                    hidePoints
                    lineStrokeWidth={1.5}
                    lineOutlineWidth={0}
                    isStatic={this.manager.isStatic}
                    unfocusedStyle="faded"
                />
                {this.renderSeries
                    .filter(
                        (series) =>
                            this.visibleLeftLabels.has(series.seriesName) &&
                            (!this.hasProjectedSeries || !series.isProjection)
                    )
                    .map((series) => (
                        <StartPointDot
                            key={`start-dot-${series.seriesName}`}
                            series={series}
                        />
                    ))}
                {this.renderSeries
                    .filter(
                        (series) =>
                            this.visibleRightLabels.has(series.seriesName) &&
                            (!this.hasProjectedSeries || series.isProjection)
                    )
                    .map((series) => (
                        <EndPointDot
                            key={`end-dot-${series.seriesName}`}
                            series={series}
                        />
                    ))}
                {this.leftAxisLabelsState && (
                    <VerticalAxisLabels
                        state={this.leftAxisLabelsState}
                        yAxis={this.dualAxis.verticalAxis}
                        x={this.innerBounds.left - LEGEND_PADDING}
                        xAnchor="end"
                    />
                )}
                {this.rightAxisLabelsState && (
                    <VerticalAxisLabels
                        state={this.rightAxisLabelsState}
                        yAxis={this.dualAxis.verticalAxis}
                        x={this.innerBounds.right + LEGEND_PADDING}
                    />
                )}
            </>
        )
    }
}

function StartPointDot({
    series,
}: {
    series: RenderLineChartSeries
}): React.ReactElement | null {
    const startPoint = _.minBy(series.placedPoints, (point) => point.x)
    if (!startPoint) return null
    return (
        <circle
            cx={startPoint.x}
            cy={startPoint.y}
            r={DOT_RADIUS}
            fill={startPoint.color ?? series.color}
        />
    )
}

function EndPointDot({
    series,
}: {
    series: RenderLineChartSeries
}): React.ReactElement | null {
    const endPoint = _.maxBy(series.placedPoints, (point) => point.x)
    if (!endPoint) return null
    return (
        <circle
            cx={endPoint.x}
            cy={endPoint.y}
            r={DOT_RADIUS}
            fill={endPoint.color ?? series.color}
        />
    )
}
