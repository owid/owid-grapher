import * as _ from "lodash-es"
import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedBarChartState } from "./StackedBarChartState.js"
import { type StackedBarChartProps } from "./StackedBarChart.js"
import { ChartManager } from "../chart/ChartManager"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { Bounds, excludeUndefined, GrapherVariant } from "@ourworldindata/utils"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import {
    getXAxisConfigDefaultsForStackedBar,
    resolveCollision,
} from "./StackedUtils"
import {
    HorizontalAxisComponent,
    VerticalAxisZeroLine,
} from "../axis/AxisViews"
import { StackedBars } from "./StackedBars"
import {
    InitialVerticalLabelsSeries,
    VerticalLabelsState,
} from "../verticalLabels/VerticalLabelsState"
import { VerticalLabels } from "../verticalLabels/VerticalLabels"

const LEGEND_PADDING = 4

@observer
export class StackedBarChartThumbnail
    extends React.Component<StackedBarChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: StackedBarChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): StackedBarChartState {
        return this.props.chartState
    }

    @computed get manager(): ChartManager {
        return this.chartState.manager
    }

    @computed private get isMinimal(): boolean {
        return this.manager.variant === GrapherVariant.MinimalThumbnail
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds.padRight(this.paddedLabelsWidth)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const defaults = getXAxisConfigDefaultsForStackedBar(this.chartState)
        const custom = { labelPadding: 0 }
        return new AxisConfig({ ...custom, ...defaults, ...xAxisConfig }, this)
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const custom = { nice: true, hideAxis: true }
        return new AxisConfig({ ...custom, ...yAxisConfig }, this)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
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
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
    }

    // Same as dualAxis.verticalAxis, but doesn't depend on innerBounds
    @computed get outerBoundsVerticalAxis(): VerticalAxis {
        const yAxis = this.verticalAxisPart.clone()
        yAxis.range = this.bounds.yRange()
        return yAxis
    }

    @computed private get verticalLabelsState():
        | VerticalLabelsState
        | undefined {
        if (!this.manager.showLegend || this.isMinimal) return undefined

        const series = excludeUndefined(
            this.chartState.series.map((series, seriesIndex) => {
                const { seriesName, color, focus } = series

                // Don't label background series
                if (focus?.background) return undefined

                const value = this.chartState.midpoints[seriesIndex]

                const yPosition = this.outerBoundsVerticalAxis.place(value)
                const label = seriesName

                return { series, seriesName, value, label, yPosition, color }
            })
        )

        return new VerticalLabelsState(series, {
            fontSize: this.labelFontSize,
            maxWidth: 0.25 * this.bounds.width,
            resolveCollision: (
                s1: InitialVerticalLabelsSeries,
                s2: InitialVerticalLabelsSeries
            ): InitialVerticalLabelsSeries => {
                const series1 = this.chartState.seriesByName.get(s1.seriesName)
                const series2 = this.chartState.seriesByName.get(s2.seriesName)

                if (!series1 || !series2) return s1 // no preference

                const picked = resolveCollision(series1, series2)
                if (picked?.seriesName === s1.seriesName) return s1
                if (picked?.seriesName === s2.seriesName) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get labelsWidth(): number {
        return this.verticalLabelsState?.width ?? 0
    }

    @computed private get paddedLabelsWidth(): number {
        return this.labelsWidth ? this.labelsWidth + LEGEND_PADDING : 0
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
                <StackedBars
                    dualAxis={this.dualAxis}
                    series={this.chartState.series}
                    formatColumn={this.chartState.formatColumn}
                />
                {this.verticalLabelsState && (
                    <VerticalLabels
                        state={this.verticalLabelsState}
                        yAxis={this.dualAxis.verticalAxis}
                        x={this.innerBounds.right + LEGEND_PADDING}
                    />
                )}
            </>
        )
    }
}
