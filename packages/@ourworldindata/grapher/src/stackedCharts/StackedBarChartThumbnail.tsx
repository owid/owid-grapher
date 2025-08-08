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
} from "../core/GrapherConstants"
import { Bounds } from "@ourworldindata/utils/dist"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import {
    getXAxisConfigDefaultsForStackedBar,
    toHorizontalAxis,
    toVerticalAxis,
} from "./StackedUtils"
import {
    HorizontalAxisComponent,
    HorizontalAxisDomainLine,
} from "../axis/AxisViews"
import { StackedBars } from "./StackedBars"

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

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const defaults = getXAxisConfigDefaultsForStackedBar(this.chartState)
        return new AxisConfig({ ...defaults, ...xAxisConfig }, this)
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

    override render(): React.ReactElement {
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
                <StackedBars
                    dualAxis={this.dualAxis}
                    series={this.chartState.series}
                    formatColumn={this.chartState.formatColumn}
                />
            </>
        )
    }
}
