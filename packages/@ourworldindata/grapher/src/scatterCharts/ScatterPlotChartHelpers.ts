import * as _ from "lodash-es"
import * as R from "remeda"
import { ScaleLinear } from "d3-scale"
import { SortOrder, SeriesName } from "@ourworldindata/types"
import { PointVector, sortNumeric, makeSafeForCSS } from "@ourworldindata/utils"
import { DualAxis } from "../axis/Axis"
import { ColorScale } from "../color/ColorScale"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import {
    ScatterSeries,
    ScatterPlacedPoint,
    PlacedScatterSeries,
    RenderScatterSeries,
    SCATTER_POINT_MIN_RADIUS,
    SCATTER_LINE_MIN_WIDTH,
    SCATTER_LABEL_MIN_FONT_SIZE_FACTOR,
} from "./ScatterPlotChartConstants"

function getPointRadius(
    value: number | undefined,
    sizeScale: ScaleLinear<number, number>,
    isConnected: boolean
): number {
    const radius = value !== undefined ? sizeScale(value) : sizeScale.range()[0]
    return Math.max(
        radius,
        isConnected ? SCATTER_LINE_MIN_WIDTH : SCATTER_POINT_MIN_RADIUS
    )
}

function getLabelFontSize(
    value: number | undefined,
    fontScale: ScaleLinear<number, number> | undefined,
    baseFontSize: number
): number {
    if (!fontScale) return BASE_FONT_SIZE
    const fontSize =
        value !== undefined ? fontScale(value) : fontScale.range()[0]
    return Math.max(fontSize, SCATTER_LABEL_MIN_FONT_SIZE_FACTOR * baseFontSize)
}

function computeOffsetVector(points: ScatterPlacedPoint[]): PointVector {
    if (points.length <= 1) return PointVector.up
    const lastPos = points[points.length - 1].position
    const prevPos = points[points.length - 2].position
    return lastPos.subtract(prevPos)
}

export function toPlacedScatterSeries(
    seriesArray: ScatterSeries[],
    opts: {
        dualAxis: DualAxis
        colorScale?: ColorScale
        sizeScale: ScaleLinear<number, number>
        fontScale?: ScaleLinear<number, number>
        baseFontSize: number
        isConnected: boolean
    }
): PlacedScatterSeries[] {
    const {
        dualAxis,
        colorScale,
        sizeScale,
        fontScale,
        baseFontSize,
        isConnected,
    } = opts
    const bounds = dualAxis.innerBounds
    const xAxis = dualAxis.horizontalAxis.clone()
    xAxis.range = bounds.xRange()
    const yAxis = dualAxis.verticalAxis.clone()
    yAxis.range = bounds.yRange()

    return sortNumeric(
        seriesArray.map((series): PlacedScatterSeries => {
            const placedPoints = series.points.map(
                (point): ScatterPlacedPoint => {
                    const scaleColor =
                        colorScale !== undefined
                            ? colorScale.getColor(point.color)
                            : undefined
                    return {
                        position: new PointVector(
                            Math.floor(xAxis.place(point.x)),
                            Math.floor(yAxis.place(point.y))
                        ),
                        color: scaleColor ?? series.color,
                        size: getPointRadius(
                            point.size,
                            sizeScale,
                            isConnected
                        ),
                        time: point.time,
                        label: point.label,
                    }
                }
            )

            return {
                ...series,
                seriesName: series.seriesName,
                label: series.label,
                displayKey: "key-" + makeSafeForCSS(series.seriesName),
                color: series.color,
                size: R.last(placedPoints)!.size,
                fontSize: getLabelFontSize(
                    R.last(series.points)!.size,
                    fontScale,
                    baseFontSize
                ),
                placedPoints: placedPoints,
                text: series.label,
                isScaleColor: series.isScaleColor,
                offsetVector: computeOffsetVector(placedPoints),
            }
        }),
        (d) => d.size,
        SortOrder.desc
    )
}

export function toRenderScatterSeries(
    placedSeries: PlacedScatterSeries[],
    opts: {
        hoveredSeriesNames: SeriesName[]
        focusedSeriesNames: SeriesName[]
        tooltipSeriesName?: SeriesName
    }
): RenderScatterSeries[] {
    const { hoveredSeriesNames, focusedSeriesNames, tooltipSeriesName } = opts

    return placedSeries.map((series): RenderScatterSeries => {
        const isHover = hoveredSeriesNames.includes(series.seriesName)
        const isFocus = focusedSeriesNames.includes(series.seriesName)
        const isForeground = isHover || isFocus
        const isTooltip = tooltipSeriesName === series.seriesName

        return {
            ...series,
            size: isHover ? series.size + 1 : series.size,
            isHover,
            isFocus,
            isForeground,
            isTooltip,
            midLabels: [],
            allLabels: [],
        }
    })
}
