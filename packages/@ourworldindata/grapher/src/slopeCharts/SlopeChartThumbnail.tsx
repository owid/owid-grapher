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
} from "../core/GrapherConstants"
import { Bounds, SeriesName } from "@ourworldindata/utils"
import { VerticalAxis } from "../axis/Axis"
import { Slope } from "./Slope"
import {
    InitialVerticalLabelsSeries,
    VerticalLabelsState,
} from "../verticalLabels/VerticalLabelsState"
import { VerticalLabels } from "../verticalLabels/VerticalLabels"
import { MarkX } from "./MarkX"

const DOT_RADIUS = 4
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

    @computed get innerBounds(): Bounds {
        const rightPadding = Math.max(
            this.paddedEndLabelsWidth, // width of end labels plus padding
            0.5 * this.xEndMarkWidth // half the width of the end time label (since it's centered)
        )
        const leftPadding = Math.max(
            this.paddedStartLabelsWidth, // width of start labels plus padding
            0.5 * this.xStartMarkWidth // half the width of the start time label (since it's centered)
        )

        return this.bounds
            .padBottom(Math.floor(this.xMarkFontSize))
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
        return this.innerBounds.yRange()
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

    @computed private get labelFontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
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

    @computed private get endLabelsState(): VerticalLabelsState | undefined {
        if (!this.manager.showLegend) return undefined

        const series = this.labelCandidateSeries.map((series) => {
            const { seriesName, color } = series

            const lastPoint = series.end
            const value = lastPoint?.value ?? 0

            const yPosition = this.outerBoundsVerticalAxis.place(value)
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

        return new VerticalLabelsState(series, {
            fontSize: this.labelFontSize,
            minSpacing: 2,
            yRange: this.bounds
                .expand({ top: this.manager.chartAreaPadding ?? 0 })
                .yRange(),
        })
    }

    @computed private get startLabelsState(): VerticalLabelsState | undefined {
        if (!this.manager.showLegend) return undefined

        const showEntityNames =
            !this.manager.isDisplayedAlongsideComplementaryTable

        const series = this.labelCandidateSeries.map((series) => {
            const { seriesName, color } = series
            const firstPoint = series.start
            const value = firstPoint?.value ?? 0
            const yPosition = this.outerBoundsVerticalAxis.place(value)
            const label = showEntityNames ? seriesName : this.formatLabel(value)
            return {
                seriesName,
                value,
                label,
                yPosition,
                color,
                point: firstPoint,
            }
        })

        return new VerticalLabelsState(series, {
            fontSize: this.labelFontSize,
            maxWidth: showEntityNames ? 0.25 * this.bounds.width : undefined,
            minSpacing: showEntityNames ? 5 : 2,
            yRange: this.bounds
                .expand({ top: this.manager.chartAreaPadding ?? 0 })
                .yRange(),
            resolveCollision: (
                s1: InitialVerticalLabelsSeries,
                s2: InitialVerticalLabelsSeries
            ): InitialVerticalLabelsSeries => {
                // Prefer to label series that have an end label
                if (this.visibleEndLabels.has(s1.seriesName)) return s1
                if (this.visibleEndLabels.has(s2.seriesName)) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get visibleEndLabels(): Set<SeriesName> {
        return new Set(
            this.endLabelsState?.series.map((series) => series.seriesName)
        )
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

    override render(): React.ReactElement | null {
        if (this.chartState.errorInfo.reason) return null

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
                            dotRadius={2.5}
                            strokeWidth={1.5}
                            outlineWidth={0}
                            outlineStroke={this.manager.backgroundColor}
                            unfocusedStyle="faded"
                        />
                    ))}
                </g>
                {this.startLabelsState && (
                    <VerticalLabels
                        state={this.startLabelsState}
                        yAxis={this.yAxis}
                        x={this.innerBounds.left - LABEL_PADDING}
                        xAnchor="end"
                    />
                )}
                {this.endLabelsState && (
                    <VerticalLabels
                        state={this.endLabelsState}
                        yAxis={this.yAxis}
                        x={this.innerBounds.right + LABEL_PADDING}
                    />
                )}
            </>
        )
    }
}
