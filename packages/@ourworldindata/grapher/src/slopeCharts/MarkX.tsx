import {
    dyFromAlign,
    makeIdForHumanConsumption,
    VerticalAlign,
} from "@ourworldindata/utils"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"

export function MarkX({
    label,
    x,
    top,
    bottom,
    labelPadding,
    fontSize,
}: {
    label: string
    x: number
    top: number
    bottom: number
    labelPadding: number
    fontSize: number
}) {
    return (
        <>
            <line
                id={makeIdForHumanConsumption(label)}
                x1={x}
                y1={top}
                x2={x}
                y2={bottom}
                stroke="#999"
            />
            <text
                x={x}
                y={bottom + labelPadding}
                dy={dyFromAlign(VerticalAlign.bottom)}
                textAnchor="middle"
                fill={GRAPHER_DARK_TEXT}
                fontSize={fontSize}
            >
                {label}
            </text>
        </>
    )
}
