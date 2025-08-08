import {
    AxisConfigInterface,
    PointVector,
    ScaleType,
} from "@ourworldindata/utils"
import { VerticalAxis } from "../axis/Axis"
import { PlacedSlopeChartSeries, SlopeChartSeries } from "./SlopeChartConstants"
import { AxisConfig } from "../axis/AxisConfig"
import { SlopeChartState } from "./SlopeChartState"

export function getYAxisConfigDefaults(
    config?: AxisConfigInterface
): AxisConfigInterface {
    return { nice: config?.scaleType !== ScaleType.log }
}

export function toVerticalAxis(
    config: AxisConfig,
    chartState: SlopeChartState,
    { yDomain, yRange }: { yDomain: [number, number]; yRange: [number, number] }
): VerticalAxis {
    const axis = config.toVerticalAxis()
    axis.domain = yDomain
    axis.range = yRange
    axis.formatColumn = chartState.yColumns[0]
    axis.label = ""
    return axis
}

export function toPlacedSeries(
    series: SlopeChartSeries[],
    {
        yAxis,
        startX,
        endX,
    }: { yAxis: VerticalAxis; startX: number; endX: number }
): PlacedSlopeChartSeries[] {
    return series.map((series) => {
        const startY = yAxis.place(series.start.value)
        const endY = yAxis.place(series.end.value)

        const startPoint = new PointVector(startX, startY)
        const endPoint = new PointVector(endX, endY)

        return { ...series, startPoint, endPoint }
    })
}
