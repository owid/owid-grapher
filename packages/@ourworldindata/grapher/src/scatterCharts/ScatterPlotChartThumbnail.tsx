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
import {
    SCATTER_LINE_MIN_WIDTH,
    SCATTER_POINT_MIN_RADIUS,
    ScatterPlotManager,
    SeriesPoint,
} from "./ScatterPlotChartConstants"
import { toSizeRange } from "./ScatterUtils"
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

    private getPointRadius(value: number | undefined): number {
        const radius =
            value !== undefined
                ? this.sizeScale(value)
                : this.sizeScale.range()[0]

        // We are enforcing the minimum radius/width just before render,
        // it should not be enforced earlier than that.
        return Math.max(
            radius,
            this.props.chartState.isConnected
                ? SCATTER_LINE_MIN_WIDTH
                : SCATTER_POINT_MIN_RADIUS
        )
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
                    backgroundColor={this.manager.backgroundColor}
                    hideFocusRing={true}
                />
                {!this.chartState.isConnected &&
                    this.chartState.focusArray.seriesNames.map((entityName) => {
                        const series = this.chartState.series.find(
                            (s) => s.seriesName === entityName
                        )
                        const point = series?.points[0]
                        if (!point) return null

                        const color =
                            this.chartState.colorScale !== undefined
                                ? this.chartState.colorScale.getColor(
                                      point.color
                                  )
                                : undefined

                        return (
                            <CrossHair
                                key={entityName}
                                dualAxis={this.dualAxis}
                                point={point}
                                color={color ?? series.color}
                                dotRadius={this.getPointRadius(point.size)}
                            />
                        )
                    })}
            </>
        )
    }
}

function CrossHair({
    dualAxis,
    point,
    color,
    dotRadius = 4,
}: {
    dualAxis: DualAxis
    point: SeriesPoint
    color: string
    dotRadius?: number
}): React.ReactElement {
    const bounds = dualAxis.innerBounds

    const x = Math.floor(dualAxis.horizontalAxis.place(point.x))
    const y = Math.floor(dualAxis.verticalAxis.place(point.y))

    return (
        <g>
            <line
                x1={x}
                x2={x}
                y1={bounds.top}
                y2={bounds.bottom}
                stroke={color}
            />
            <line
                x1={bounds.left}
                x2={bounds.right}
                y1={y}
                y2={y}
                stroke={color}
            />
            <circle cx={x} cy={y} r={dotRadius} fill={color} />
        </g>
    )
}
