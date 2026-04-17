import React from "react"
import { Time } from "@ourworldindata/types"
import { DualAxis } from "../axis/Axis"
import { LineChartState } from "./LineChartState"
import { RenderLineChartSeries } from "./LineChartConstants"
import { darkenColorForLine } from "../color/ColorUtils"
import { Emphasis } from "../interaction/Emphasis"
import { GRAPHER_OPACITY_MUTED } from "../core/GrapherConstants"
import { GRAPHER_BACKGROUND } from "../color/ColorConstants"
import { getSeriesKey } from "../chart/ChartUtils"

interface LineChartActiveTimeMarkersProps {
    activeTimes: Time[]
    renderSeries: RenderLineChartSeries[]
    dualAxis: DualAxis
    chartState: LineChartState
    circleRadius: number
    backgroundColor?: string
}

/**
 * Vertical reference line and series-value circles drawn at each active time
 * (the hovered time plus any externally highlighted times).
 */
export function LineChartActiveTimeMarkers({
    activeTimes,
    renderSeries,
    dualAxis,
    chartState,
    circleRadius,
}: LineChartActiveTimeMarkersProps): React.ReactElement | null {
    const { horizontalAxis, verticalAxis } = dualAxis

    if (activeTimes.length === 0) return null

    return (
        <>
            {activeTimes.map((time) => (
                <g className="hoverIndicator" key={time}>
                    <line
                        x1={horizontalAxis.place(time)}
                        y1={verticalAxis.range[0]}
                        x2={horizontalAxis.place(time)}
                        y2={verticalAxis.range[1]}
                        stroke="rgba(180,180,180,.4)"
                    />
                    {renderSeries.map((series, index) => {
                        const point = series.points.find(
                            (point) => point.x === time
                        )
                        if (!point || series.hover.background) return null

                        const valueColor = chartState.hasColorScale
                            ? darkenColorForLine(
                                  chartState.getColorScaleColor(
                                      point.colorValue
                                  )
                              )
                            : series.color
                        const opacity =
                            series.emphasis === Emphasis.Muted
                                ? GRAPHER_OPACITY_MUTED
                                : 1

                        return (
                            <circle
                                key={getSeriesKey(series, index)}
                                cx={horizontalAxis.place(point.x)}
                                cy={verticalAxis.place(point.y)}
                                r={circleRadius}
                                fill={valueColor}
                                fillOpacity={opacity}
                                stroke={GRAPHER_BACKGROUND}
                                strokeWidth={0.5}
                            />
                        )
                    })}
                </g>
            ))}
        </>
    )
}
