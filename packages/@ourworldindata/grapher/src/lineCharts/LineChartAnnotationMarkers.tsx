import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { roundForSvg } from "@ourworldindata/utils"
import { LINE_STYLE, RenderAnnotation } from "./LineChartConstants"
import { GRAPHER_BACKGROUND } from "../color/ColorConstants"

interface LineChartAnnotationMarkersProps {
    annotations: RenderAnnotation[]
    radius: number
}

export function LineChartAnnotationMarkers({
    annotations,
    radius,
}: LineChartAnnotationMarkersProps): React.ReactElement {
    return (
        <g className="line-chart-annotation-markers">
            {annotations.map(({ key, point, emphasis }) => (
                <g
                    key={`${key}-${point.time}`}
                    transform={`translate(${roundForSvg(point.x)}, ${roundForSvg(point.y)})`}
                    opacity={LINE_STYLE[emphasis].opacity}
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
            ))}
        </g>
    )
}
