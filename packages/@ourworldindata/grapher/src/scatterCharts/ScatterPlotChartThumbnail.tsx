import * as _ from "lodash-es"
import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { ScatterPlotChartState } from "./ScatterPlotChartState"
import { type ScatterPlotChartProps } from "./ScatterPlotChart.js"
import { ScaleLinear, scaleSqrt } from "d3-scale"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { Bounds } from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ScatterPlotManager } from "./ScatterPlotChartConstants"
import { toSizeRange } from "./ScatterUtils"
import { DualAxisComponent } from "../axis/AxisViews"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import { getVisibleLabels } from "../chart/ChartUtils"

@observer
export class ScatterPlotChartThumbnail
    extends React.Component<ScatterPlotChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: ScatterPlotChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): ScatterPlotChartState {
        return this.props.chartState
    }

    @computed get manager(): ScatterPlotManager {
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

    @computed get axisBounds(): Bounds {
        return this.innerBounds
    }

    @computed private get shouldShowAxisTitles(): boolean {
        return getVisibleLabels(this.manager.labelMode).axisText
    }

    @computed private get shouldShowTickLabels(): boolean {
        return getVisibleLabels(this.manager.labelMode).values
    }

    @computed private get labelModeOverrides(): {
        hideTickLabels?: boolean
        hideLabelUnit?: boolean
    } {
        return this.shouldShowTickLabels
            ? {}
            : { hideTickLabels: true, hideLabelUnit: true }
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const custom = { labelPadding: 2, shortenLabelLogNotice: true }
        return new AxisConfig(
            { ...custom, ...xAxisConfig, ...this.labelModeOverrides },
            this
        )
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const custom = { labelPadding: 8, shortenLabelLogNotice: true }
        return new AxisConfig(
            { ...custom, ...yAxisConfig, ...this.labelModeOverrides },
            this
        )
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const axis = this.chartState.toVerticalAxis(this.yAxisConfig)
        if (!this.shouldShowAxisTitles) axis.label = ""
        return axis
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.chartState.toHorizontalAxis(this.xAxisConfig)
        if (!this.shouldShowAxisTitles) axis.label = ""
        return axis
    }

    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
            horizontalAxis: this.horizontalAxisPart,
            verticalAxis: this.verticalAxisPart,
        })
    }

    @computed private get sizeRange(): [number, number] {
        return toSizeRange(this.chartState, this.innerBounds)
    }

    @computed get sizeScale(): ScaleLinear<number, number> {
        return scaleSqrt()
            .domain(this.chartState.sizeDomain)
            .range(this.sizeRange)
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataMessage
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return (
            <>
                <DualAxisComponent
                    dualAxis={this.dualAxis}
                    showTickMarks={false}
                    showEndpointsOnly={true}
                />
                <ScatterPointsWithLabels
                    noDataMessageManager={this.manager}
                    isConnected={this.chartState.isConnected}
                    hideConnectedScatterLines={
                        !!this.manager.hideConnectedScatterLines
                    }
                    seriesArray={this.chartState.series}
                    dualAxis={this.dualAxis}
                    colorScale={
                        !this.chartState.colorColumn.isMissing
                            ? this.chartState.colorScale
                            : undefined
                    }
                    sizeScale={this.sizeScale}
                    baseFontSize={this.fontSize}
                    focusedSeriesNames={
                        this.chartState.selectionArray.selectedEntityNames
                    }
                    hideScatterLabels={true}
                />
            </>
        )
    }
}
