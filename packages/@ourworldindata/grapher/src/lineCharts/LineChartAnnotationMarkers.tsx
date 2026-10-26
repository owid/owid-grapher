import React from "react"
import { roundForSvg } from "@ourworldindata/utils"
import { LINE_STYLE, RenderAnnotation } from "./LineChartConstants"
import { AnnotationInfoIcon } from "../annotations/AnnotationInfoIcon"

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
                    <AnnotationInfoIcon radius={radius} color={point.color} />
                </g>
            ))}
        </g>
    )
}
