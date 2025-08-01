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
import { Bounds, InteractionState, VerticalAlign } from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_THUMBNAIL_PADDING,
} from "../core/GrapherConstants"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { Lines } from "./Lines"
import { FocusArray } from "../focus/FocusArray"
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
import { LineLabelSeries } from "../lineLegend/LineLegendTypes"
import { LineLegend, LineLegendProps } from "../lineLegend/LineLegend"

const SPACE_BETWEEN_LINE_AND_LABEL = 4

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
            .pad(GRAPHER_THUMBNAIL_PADDING)
            .padRight(
                this.manager.showLegend
                    ? this.lineLegendWidthRight + SPACE_BETWEEN_LINE_AND_LABEL
                    : 0
            )
            .padLeft(
                this.manager.showLegend
                    ? this.lineLegendWidthLeft + SPACE_BETWEEN_LINE_AND_LABEL
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
        return new AxisConfig(this.manager.xAxisConfig, this)
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

    @computed private get focusArray(): FocusArray {
        return this.manager.focusArray ?? new FocusArray()
    }

    @computed private get isFocusModeActive(): boolean {
        return !this.focusArray.isEmpty
    }

    private focusStateForSeries(series: LineChartSeries): InteractionState {
        return this.focusArray.state(series.seriesName)
    }

    @computed private get renderSeries(): RenderLineChartSeries[] {
        let series = this.placedSeries.map((series) => {
            return {
                ...series,
                hover: { active: false, background: false },
                focus: this.focusStateForSeries(series),
                shouldHighlightStartPoint:
                    this.lineLegendLeft.visibleSeriesNames.includes(
                        series.seriesName
                    ),
                shouldHighlightEndPoint:
                    this.lineLegendRight.visibleSeriesNames.includes(
                        series.seriesName
                    ),
            }
        })

        // draw lines on top of markers-only series
        series = _.sortBy(series, (series) => !series.plotMarkersOnly)

        // sort by interaction state so that foreground series
        // are drawn on top of background series
        if (this.isFocusModeActive) {
            series = _.sortBy(series, byHoverThenFocusState)
        }

        return series
    }

    @computed private get maxLineLegendWidth(): number {
        return Infinity
    }

    @computed private get lineLegendPropsCommon(): Partial<LineLegendProps> {
        return {
            yAxis: this.dualAxis.verticalAxis,
            maxWidth: this.maxLineLegendWidth,
            fontSize: this.fontSize,
            isStatic: this.manager.isStatic,
            yRange: this.lineLegendYRange,
            verticalAlign: VerticalAlign.top,
            useConnectorLines: false,
        }
    }

    @computed private get lineLegendPropsRight(): Partial<LineLegendProps> {
        return { xAnchor: "start" }
    }

    @computed private get lineLegendPropsLeft(): Partial<LineLegendProps> {
        return { xAnchor: "end" }
    }

    @computed private get lineLegendWidthRight(): number {
        // todo: copy-pasted from LineLegend
        const fontSize = Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
        const labelWidths = this.lineLegendSeriesRight.map(
            (series) =>
                Bounds.forText(series.label, {
                    fontSize,
                }).width
        )
        const maxLabelWidth = _.max(labelWidths) ?? 0
        return maxLabelWidth
    }

    @computed private get lineLegendWidthLeft(): number {
        // todo: copy-pasted from LineLegend
        const fontSize = Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
        const labelWidths = this.lineLegendSeriesRight.map(
            (series) =>
                Bounds.forText(series.label, {
                    fontSize,
                }).width
        )
        const maxLabelWidth = _.max(labelWidths) ?? 0
        return maxLabelWidth
    }

    private constructLineLegendSeries(
        series: LineChartSeries,
        getValue: (series: LineChartSeries) => number
    ): LineLabelSeries {
        const { seriesName, color } = series
        const value = getValue(series)
        const formattedValue =
            this.chartState.formatColumn.formatValueShortWithAbbreviations(
                value
            )
        return {
            color,
            seriesName,
            label: formattedValue,
            yValue: value,
        }
    }

    @computed private get lineLegendYRange(): [number, number] {
        return [this.bounds.top, this.bounds.bottom]
    }

    @computed private get lineLegendSeriesRight(): LineLabelSeries[] {
        return this.chartState.series.map((series) =>
            this.constructLineLegendSeries(series, (series) => {
                const maxPoint = _.maxBy(series.points, (point) => point.x)
                return maxPoint?.y ?? 0
            })
        )
    }

    @computed private get lineLegendSeriesLeft(): LineLabelSeries[] {
        return this.chartState.series.map((series) =>
            this.constructLineLegendSeries(series, (series) => {
                const minPoint = _.minBy(series.points, (point) => point.x)
                return minPoint?.y ?? 0
            })
        )
    }

    @computed private get lineLegendRight(): LineLegend {
        return new LineLegend({
            series: this.lineLegendSeriesRight,
            ...this.lineLegendPropsCommon,
            ...this.lineLegendPropsRight,
        })
    }

    @computed private get lineLegendLeft(): LineLegend {
        return new LineLegend({
            series: this.lineLegendSeriesLeft,
            ...this.lineLegendPropsCommon,
            ...this.lineLegendPropsLeft,
        })
    }

    override render(): React.ReactElement {
        return (
            <g>
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
                />
                <LineLegend
                    series={this.lineLegendSeriesRight}
                    x={this.innerBounds.right + SPACE_BETWEEN_LINE_AND_LABEL}
                    {...this.lineLegendPropsCommon}
                    {...this.lineLegendPropsRight}
                />
                <LineLegend
                    series={this.lineLegendSeriesLeft}
                    x={this.innerBounds.left - SPACE_BETWEEN_LINE_AND_LABEL}
                    {...this.lineLegendPropsCommon}
                    {...this.lineLegendPropsLeft}
                />
            </g>
        )
    }
}
