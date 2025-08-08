import React from "react"
import * as _ from "remeda"
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
} from "./SlopeChartConstants"
import {
    getYAxisConfigDefaults,
    toPlacedSeries,
    toVerticalAxis,
} from "./SlopeChartHelpers"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import {
    Bounds,
    domainExtent,
    GrapherRenderMode,
    makeIdForHumanConsumption,
    SeriesName,
} from "@ourworldindata/utils"
import { VerticalAxis } from "../axis/Axis"
import { byHoverThenFocusState } from "../chart/ChartUtils"
import { Slope } from "./Slope"
import {
    InitialVerticalAxisLabelsSeries,
    VerticalAxisLabelsState,
} from "../verticalAxisLabels/VerticalAxisLabelsState"
import { VerticalAxisLabels } from "../verticalAxisLabels/VerticalAxisLabels"
import { MarkX } from "./MarkX"

const DOT_RADIUS = 4
const SPACE_BETWEEN_DOT_AND_LABEL = 4

const LEGEND_PADDING = DOT_RADIUS + SPACE_BETWEEN_DOT_AND_LABEL

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

    @computed private get isMinimal(): boolean {
        return this.manager.renderMode === GrapherRenderMode.Minimal
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get bottomPadding(): number {
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
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
        return this.yAxisForLabels.tickFontSize
    }

    @computed get innerBounds(): Bounds {
        const rigthPadding = Math.max(
            this.rightAxisLabelsWidth
                ? this.rightAxisLabelsWidth + LEGEND_PADDING
                : 0,
            Bounds.forText(this.formattedEndTime, {
                fontSize: this.xMarkFontSize,
            }).width
        )

        const leftPadding = Math.max(
            this.leftAxisLabelsWidth
                ? this.leftAxisLabelsWidth + LEGEND_PADDING
                : 0,
            Bounds.forText(this.formattedStartTime, {
                fontSize: this.xMarkFontSize,
            }).width
        )

        return this.bounds
            .padBottom(this.bottomPadding)
            .padRight(rigthPadding)
            .padLeft(leftPadding)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const defaults = getYAxisConfigDefaults(yAxisConfig)
        return new AxisConfig({ ...defaults, ...yAxisConfig }, this)
    }

    // todo: copy-pastedy
    @computed get yDomainDefault(): [number, number] {
        const defaultDomain: [number, number] = [Infinity, -Infinity]
        return (
            domainExtent(
                this.chartState.allYValues,
                this.chartState.yScaleType
            ) ?? defaultDomain
        )
    }

    // todo: copy-pasted
    @computed get yDomain(): [number, number] {
        const domain = this.yAxisConfig.domain || [Infinity, -Infinity]
        const domainDefault = this.yDomainDefault
        return [
            Math.min(domain[0], domainDefault[0]),
            Math.max(domain[1], domainDefault[1]),
        ]
    }

    // todo: copy-pasted
    @computed private get yRange(): [number, number] {
        return this.innerBounds.yRange()
    }

    @computed private get xRange(): [number, number] {
        // todo
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
        return toVerticalAxis(this.yAxisConfig, this.chartState, {
            yDomain: this.yDomain,
            yRange: this.yRange,
        })
    }

    @computed private get placedSeries(): PlacedSlopeChartSeries[] {
        return toPlacedSeries(this.chartState.series, {
            yAxis: this.yAxis,
            startX: this.startX,
            endX: this.endX,
        })
    }

    // todo: copy-pasted
    @computed private get renderSeries(): RenderSlopeChartSeries[] {
        const series: RenderSlopeChartSeries[] = this.placedSeries.map(
            (series) => {
                return {
                    ...series,
                    hover: { active: false, background: false },
                }
            }
        )

        // sort by interaction state so that foreground series
        // are drawn on top of background series
        if (this.chartState.isFocusModeActive) {
            return _.sortBy(series, byHoverThenFocusState)
        }

        return series
    }

    @computed private get legendLabelFontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
    }

    // TODO: clean up
    @computed private get yAxisForLabels(): VerticalAxis {
        return toVerticalAxis(this.yAxisConfig, this.chartState, {
            yDomain: this.yDomain,
            yRange: this.bounds.yRange(),
        })
    }

    private formatLabel(value: number): string {
        return this.chartState.formatColumn.formatValueShortWithAbbreviations(
            value
        )
    }

    @computed private get rightAxisLabelsState():
        | VerticalAxisLabelsState
        | undefined {
        if (!this.manager.showLegend) return undefined

        let activeSeries = this.chartState.series

        activeSeries = this.chartState.isFocusModeActive
            ? activeSeries.filter((series) => series.focus.active)
            : activeSeries

        const series = activeSeries.map((series) => {
            const { seriesName, color } = series

            const lastPoint = series.end
            const value = lastPoint?.value ?? 0

            const yPosition = this.yAxisForLabels.place(value)
            const label = this.formatLabel(value)

            return {
                seriesName,
                value,
                label,
                yPosition,
                color,
                point: lastPoint,
            }
        })

        return new VerticalAxisLabelsState(series, {
            fontSize: this.legendLabelFontSize,
        })
    }

    @computed private get leftAxisLabelsState():
        | VerticalAxisLabelsState
        | undefined {
        if (!this.manager.showLegend) return undefined

        let activeSeries = this.chartState.series

        activeSeries = this.chartState.isFocusModeActive
            ? activeSeries.filter((series) => series.focus.active)
            : activeSeries

        const series = activeSeries.map((series) => {
            const { seriesName, color } = series
            const firstPoint = series.start
            const value = firstPoint?.value ?? 0
            const yPosition = this.yAxisForLabels.place(value)
            const label = this.isMinimal ? this.formatLabel(value) : seriesName
            return {
                seriesName,
                value,
                label,
                yPosition,
                color,
                point: firstPoint,
            }
        })

        return new VerticalAxisLabelsState(series, {
            fontSize: this.legendLabelFontSize,
            maxWidth: 0.25 * this.bounds.width,
            resolveCollision: (
                s1: InitialVerticalAxisLabelsSeries,
                s2: InitialVerticalAxisLabelsSeries
            ): InitialVerticalAxisLabelsSeries => {
                if (this.visibleRightLabels.has(s1.seriesName)) return s1
                if (this.visibleRightLabels.has(s2.seriesName)) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get visibleRightLabels(): Set<SeriesName> {
        return new Set(
            this.rightAxisLabelsState?.series.map((series) => series.seriesName)
        )
    }

    @computed private get rightAxisLabelsWidth(): number {
        return this.rightAxisLabelsState?.width ?? 0
    }

    @computed private get leftAxisLabelsWidth(): number {
        return this.leftAxisLabelsState?.width ?? 0
    }

    override render(): React.ReactElement | null {
        const { startX, endX } = this

        if (this.chartState.errorInfo.reason) return null

        return (
            <>
                <MarkX
                    label={this.formattedStartTime}
                    x={startX}
                    top={this.innerBounds.top}
                    bottom={this.innerBounds.bottom}
                    labelPadding={4}
                    fontSize={this.yAxis.tickFontSize}
                />
                <MarkX
                    label={this.formattedEndTime}
                    x={endX}
                    top={this.innerBounds.top}
                    bottom={this.innerBounds.bottom}
                    labelPadding={4}
                    fontSize={this.yAxis.tickFontSize}
                />
                <g id={makeIdForHumanConsumption("slopes")}>
                    {this.renderSeries.map((series) => (
                        <Slope
                            key={series.seriesName}
                            series={series}
                            strokeWidth={1.5}
                            outlineWidth={0}
                            outlineStroke={this.manager.backgroundColor}
                            unfocusedStyle="faded"
                        />
                    ))}
                </g>
                {this.leftAxisLabelsState && (
                    <VerticalAxisLabels
                        state={this.leftAxisLabelsState}
                        yAxis={this.yAxis}
                        x={this.innerBounds.left - LEGEND_PADDING}
                        xAnchor="end"
                    />
                )}
                {this.rightAxisLabelsState && (
                    <VerticalAxisLabels
                        state={this.rightAxisLabelsState}
                        yAxis={this.yAxis}
                        x={this.innerBounds.right + LEGEND_PADDING}
                    />
                )}
            </>
        )
    }
}
