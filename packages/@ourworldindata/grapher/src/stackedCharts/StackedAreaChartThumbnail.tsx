import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedAreaChartState } from "./StackedAreaChartState.js"
import { type StackedAreaChartProps } from "./StackedAreaChart.js"
import { Bounds } from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { toHorizontalAxis, toVerticalAxis } from "./StackedUtils"
import {
    HorizontalAxisComponent,
    HorizontalAxisDomainLine,
} from "../axis/AxisViews"
import { StackedAreas } from "./StackedAreas"

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
                <StackedAreas
                    dualAxis={this.dualAxis}
                    seriesArr={this.chartState.series}
                />
            </>
        )
    }
}
