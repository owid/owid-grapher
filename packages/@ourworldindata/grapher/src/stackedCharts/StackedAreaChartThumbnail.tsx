import * as R from "remeda"
import * as _ from "lodash-es"
import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedAreaChartState } from "./StackedAreaChartState.js"
import { type StackedAreaChartProps } from "./StackedAreaChart.js"
import { Bounds, GrapherRenderMode } from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_14,
} from "../core/GrapherConstants"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { toHorizontalAxis, toVerticalAxis } from "./StackedUtils"
import {
    HorizontalAxisComponent,
    VerticalAxisZeroLine,
} from "../axis/AxisViews"
import { StackedAreas } from "./StackedAreas"
import {
    InitialVerticalAxisLabelsSeries,
    VerticalAxisLabelsState,
} from "../verticalAxisLabels/VerticalAxisLabelsState"
import { VerticalAxisLabels } from "../verticalAxisLabels/VerticalAxisLabels"

const LEGEND_PADDING = 4

@observer
export class StackedAreaChartThumbnail
    extends React.Component<StackedAreaChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: StackedAreaChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): StackedAreaChartState {
        return this.props.chartState
    }

    @computed get manager(): ChartManager {
        return this.chartState.manager
    }

    @computed private get isMinimal(): boolean {
        return this.manager.renderMode === GrapherRenderMode.Minimal
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds.padRight(
            this.verticalAxisLabelsWidth
                ? this.verticalAxisLabelsWidth + LEGEND_PADDING
                : 0
        )
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const custom = { hideGridlines: true }
        return new AxisConfig({ ...custom, ...xAxisConfig }, this)
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const custom = { nice: true, hideAxis: true }
        return new AxisConfig({ ...custom, ...yAxisConfig }, this)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return toHorizontalAxis(this.xAxisConfig, this.chartState)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return toVerticalAxis(this.yAxisConfig, this.chartState)
    }

    @computed private get dualAxis(): DualAxis {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.innerBounds,
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed private get labelFontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_14 * this.fontSize)
    }

    // TODO: clean up
    // Same as dualAxis.verticalAxis, but doesn't depend on innerBounds
    @computed get yAxisForLabels(): VerticalAxis {
        const yAxis = this.verticalAxisPart.clone()
        yAxis.range = this.bounds.yRange()
        return yAxis
    }

    @computed private get verticalAxisLabelsState():
        | VerticalAxisLabelsState
        | undefined {
        if (!this.manager.showLegend || this.isMinimal) return undefined

        let activeSeries = this.chartState.series

        activeSeries = this.chartState.isFocusModeActive
            ? activeSeries.filter((series) => series.focus?.active)
            : activeSeries

        const series = activeSeries.map((series, seriesIndex) => {
            const { seriesName, color } = series

            const value = this.chartState.midpoints[seriesIndex]

            const yPosition = this.yAxisForLabels.place(value)
            const label = seriesName

            return { series, seriesName, value, label, yPosition, color }
        })

        return new VerticalAxisLabelsState(series, {
            fontSize: this.labelFontSize,
            maxWidth: 0.25 * this.bounds.width,
            resolveCollision: (
                s1: InitialVerticalAxisLabelsSeries,
                s2: InitialVerticalAxisLabelsSeries
            ): InitialVerticalAxisLabelsSeries => {
                const series1 = this.chartState.seriesByName.get(s1.seriesName)
                const series2 = this.chartState.seriesByName.get(s2.seriesName)

                if (!series1 || !series2) return s1 // no preference

                // todo: copy pasted from StackedArea

                // prefer series with a higher maximum value
                const yMax1 =
                    _.maxBy(series1.points, (p) => p.value)?.value ?? 0
                const yMax2 =
                    _.maxBy(series2.points, (p) => p.value)?.value ?? 0
                if (yMax1 > yMax2) return s1
                if (yMax2 > yMax1) return s2

                // prefer series with a higher last value
                const yLast1 = R.last(series1.points)?.value ?? 0
                const yLast2 = R.last(series2.points)?.value ?? 0
                if (yLast1 > yLast2) return s1
                if (yLast2 > yLast1) return s2

                // prefer series with a higher total area
                const area1 = _.sumBy(series1.points, (p) => p.value)
                const area2 = _.sumBy(series2.points, (p) => p.value)
                if (area1 > area2) return s1
                if (area2 > area1) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get verticalAxisLabelsWidth(): number {
        return this.verticalAxisLabelsState?.width ?? 0
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
                    onlyShowMinMaxLabels
                />
                <StackedAreas
                    dualAxis={this.dualAxis}
                    seriesArr={this.chartState.series}
                />
                {this.verticalAxisLabelsState && (
                    <VerticalAxisLabels
                        state={this.verticalAxisLabelsState}
                        yAxis={this.dualAxis.verticalAxis}
                        x={this.innerBounds.right + LEGEND_PADDING}
                    />
                )}
            </>
        )
    }
}
