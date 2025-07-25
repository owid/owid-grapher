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
import { Bounds, InteractionState } from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
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
        return this.bounds.pad(GRAPHER_THUMBNAIL_PADDING)
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
        let series: RenderLineChartSeries[] = this.placedSeries.map(
            (series) => {
                return {
                    ...series,
                    hover: { active: false, background: false },
                    focus: this.focusStateForSeries(series),
                }
            }
        )

        // draw lines on top of markers-only series
        series = _.sortBy(series, (series) => !series.plotMarkersOnly)

        // sort by interaction state so that foreground series
        // are drawn on top of background series
        if (this.isFocusModeActive) {
            series = _.sortBy(series, byHoverThenFocusState)
        }

        return series
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
            </g>
        )
    }
}
