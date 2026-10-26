import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { roundForSvg } from "@ourworldindata/utils"
import { GRAPHER_BACKGROUND } from "../color/ColorConstants"

export function AnnotationInfoIcon({
    radius,
    color,
}: {
    radius: number
    color: string
}): React.ReactElement {
    return (
        <g className="annotation-info-icon">
            <circle r={roundForSvg(radius + 1)} fill={GRAPHER_BACKGROUND} />
            <FontAwesomeIcon
                icon={faCircleInfo}
                x={roundForSvg(-radius)}
                y={roundForSvg(-radius)}
                width={roundForSvg(2 * radius)}
                height={roundForSvg(2 * radius)}
                color={color}
            />
        </g>
    )
}
