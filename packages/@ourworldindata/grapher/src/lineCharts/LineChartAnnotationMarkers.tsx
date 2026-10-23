import React from "react"
import { Time } from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { roundForSvg } from "@ourworldindata/utils"
import { LINE_STYLE, RenderLineChartSeries } from "./LineChartConstants"
import { getSeriesKey } from "../chart/ChartUtils"
import { GRAPHER_BACKGROUND } from "../color/ColorConstants"

interface LineChartAnnotationMarkersProps {
    renderSeries: RenderLineChartSeries[]
    times: Time[]
    radius: number
}

export function LineChartAnnotationMarkers({
    renderSeries,
    times,
    radius,
}: LineChartAnnotationMarkersProps): React.ReactElement {
    return (
        <g className="line-chart-annotation-markers">
            {renderSeries.map((series, index) => {
                if (series.hover.background) return null
                return series.placedAnnotations
                    .filter(({ point }) => times.includes(point.time))
                    .map(({ point }) => (
                        <g
                            key={`${getSeriesKey(series, index)}-${point.time}`}
                            transform={`translate(${roundForSvg(point.x)}, ${roundForSvg(point.y)})`}
                            opacity={LINE_STYLE[series.emphasis].opacity}
                        >
                            <g className="line-chart-annotation-markers__icon">
                                <circle
                                    r={roundForSvg(radius + 1)}
                                    fill={GRAPHER_BACKGROUND}
                                />
                                <FontAwesomeIcon
                                    icon={faCircleInfo}
                                    x={roundForSvg(-radius)}
                                    y={roundForSvg(-radius)}
                                    width={roundForSvg(2 * radius)}
                                    height={roundForSvg(2 * radius)}
                                    color={point.color}
                                />
                            </g>
                        </g>
                    ))
            })}
        </g>
    )
}
