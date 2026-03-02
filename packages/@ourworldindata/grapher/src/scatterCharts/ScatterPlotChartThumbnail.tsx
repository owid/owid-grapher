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
import {
    ScatterPlotManager,
    PlacedScatterSeries,
    RenderScatterSeries,
} from "./ScatterPlotChartConstants"
import { toSizeRange } from "./ScatterUtils"
import {
    toPlacedScatterSeries,
    toRenderScatterSeries,
} from "./ScatterPlotChartHelpers"
import { DualAxisComponent } from "../axis/AxisViews"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels"
import { NoDataModal } from "../noDataModal/NoDataModal"

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

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const custom = { labelPadding: 2 }
        return new AxisConfig({ ...custom, ...xAxisConfig }, this)
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const custom = { labelPadding: 8 }
        return new AxisConfig({ ...custom, ...yAxisConfig }, this)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
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

    @computed private get placedSeries(): PlacedScatterSeries[] {
        return toPlacedScatterSeries(this.chartState.series, {
            dualAxis: this.dualAxis,
            colorScale: !this.chartState.colorColumn.isMissing
                ? this.chartState.colorScale
                : undefined,
            sizeScale: this.sizeScale,
            baseFontSize: this.fontSize,
            isConnected: this.chartState.isConnected,
        })
    }

    @computed private get renderSeries(): RenderScatterSeries[] {
        const selectedNames = this.chartState.selectionArray.selectedEntityNames
        return toRenderScatterSeries(this.placedSeries, {
            hoveredSeriesNames: [],
            focusedSeriesNames: selectedNames,
            tooltipSeriesName: undefined,
        })
    }

    @computed private get isLayerMode(): boolean {
        return this.chartState.selectionArray.selectedEntityNames.length > 0
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataModal
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
                    noDataModalManager={this.manager}
                    isConnected={this.chartState.isConnected}
                    hideConnectedScatterLines={
                        !!this.manager.hideConnectedScatterLines
                    }
                    seriesArray={this.renderSeries}
                    isLayerMode={this.isLayerMode}
                    dualAxis={this.dualAxis}
                    baseFontSize={this.fontSize}
                    hideScatterLabels={true}
                    backgroundColor={this.manager.backgroundColor}
                />
            </>
        )
    }
}
