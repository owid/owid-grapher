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
    SCATTER_LINE_DEFAULT_WIDTH,
    SCATTER_LINE_MAX_WIDTH,
    SCATTER_LINE_MIN_WIDTH,
    SCATTER_POINT_DEFAULT_RADIUS,
    SCATTER_POINT_MAX_RADIUS,
    SCATTER_POINT_MIN_RADIUS,
    ScatterPlotManager,
    SeriesPoint,
} from "./ScatterPlotChartConstants"
import { toHorizontalAxis, toVerticalAxisPart } from "./ScatterUtils"
import { DualAxisComponent } from "../axis/AxisViews"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels"
import { GRAPHER_DENIM } from "../color/ColorConstants"

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

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.xAxisConfig, this)
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return toVerticalAxisPart(this.yAxisConfig, this.chartState)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return toHorizontalAxis(this.xAxisConfig, this.chartState)
    }

    @computed private get dualAxis(): DualAxis {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.innerBounds,
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    // todo: copy-pasted from ScatterPlotChart
    @computed private get sizeRange(): [number, number] {
        if (this.chartState.sizeColumn.isMissing) {
            // if the size column is missing, we want all points/lines to have the same width
            return this.chartState.isConnected
                ? [SCATTER_LINE_DEFAULT_WIDTH, SCATTER_LINE_DEFAULT_WIDTH]
                : [SCATTER_POINT_DEFAULT_RADIUS, SCATTER_POINT_DEFAULT_RADIUS]
        }

        const maxLineWidth = SCATTER_LINE_MAX_WIDTH
        const maxPointRadius = Math.min(
            SCATTER_POINT_MAX_RADIUS,
            _.round(
                Math.min(this.innerBounds.width, this.innerBounds.height) *
                    0.06,
                1
            )
        )

        return this.chartState.isConnected
            ? // Note that the scale starts at 0.
              // When using the scale to plot marks, we need to make sure the minimums
              // (e.g. `SCATTER_POINT_MIN_RADIUS`) are respected.
              [0, maxLineWidth]
            : [0, maxPointRadius]
    }

    @computed get sizeScale(): ScaleLinear<number, number> {
        return scaleSqrt()
            .domain(this.chartState.sizeDomain)
            .range(this.sizeRange)
    }

    // todo: copy-pasted from ScatterPoints
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
        return (
            <>
                <DualAxisComponent
                    dualAxis={this.dualAxis}
                    showTickMarks={false}
                    onlyShowMinMaxLabels={true}
                    backgroundColor={this.manager.backgroundColor}
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
                />
                {this.chartState.selectionArray.selectedEntityNames.map(
                    (entityName) => {
                        const series = this.chartState.series.find(
                            (s) => s.seriesName === entityName
                        )
                        const point = series?.points[0]
                        if (!point) return null

                        return (
                            <CrossHair
                                key={entityName}
                                dualAxis={this.dualAxis}
                                point={point}
                                dotRadius={this.getPointRadius(point.size)}
                            />
                        )
                    }
                )}
            </>
        )
    }
}

function CrossHair({
    dualAxis,
    point,
    color = GRAPHER_DENIM,
    dotRadius = 4,
}: {
    dualAxis: DualAxis
    point: SeriesPoint
    color?: string
    dotRadius?: number
}): React.ReactElement {
    const bounds = dualAxis.innerBounds

    // TODO: why is rounding done here?
    const x = Math.floor(dualAxis.horizontalAxis.place(point.x)).toFixed(2)
    const y = Math.floor(dualAxis.verticalAxis.place(point.y)).toFixed(2)

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
