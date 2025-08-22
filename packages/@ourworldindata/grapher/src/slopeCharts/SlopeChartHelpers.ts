import * as _ from "lodash-es"
import {
    AxisConfigInterface,
    PointVector,
    ScaleType,
    SeriesName,
} from "@ourworldindata/utils"
import { VerticalAxis } from "../axis/Axis"
import {
    PlacedSlopeChartSeries,
    RenderSlopeChartSeries,
    SlopeChartSeries,
} from "./SlopeChartConstants"
import {
    byHoverThenFocusState,
    getHoverStateForSeries,
} from "../chart/ChartUtils"

export function getYAxisConfigDefaults(
    config?: AxisConfigInterface
): AxisConfigInterface {
    return { nice: config?.scaleType !== ScaleType.log }
}

export function toPlacedSlopeChartSeries(
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

export function toRenderSlopeChartSeries(
    placedSeries: PlacedSlopeChartSeries[],
    {
        isFocusModeActive = false,
        isHoverModeActive = false,
        hoveredSeriesNames = [],
    }: {
        isFocusModeActive?: boolean
        isHoverModeActive?: boolean
        hoveredSeriesNames?: SeriesName[]
    }
): RenderSlopeChartSeries[] {
    const series: RenderSlopeChartSeries[] = placedSeries.map((series) => {
        return {
            ...series,
            hover: getHoverStateForSeries(series, {
                isHoverModeActive,
                hoveredSeriesNames,
            }),
        }
    })

    // Sort by interaction state so that foreground series
    // are drawn on top of background series
    if (isHoverModeActive || isFocusModeActive) {
        return _.sortBy(series, byHoverThenFocusState)
    }

    return series
}
