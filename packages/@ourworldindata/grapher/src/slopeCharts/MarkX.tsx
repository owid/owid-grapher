import { dyFromAlign, makeFigmaId, VerticalAlign } from "@ourworldindata/utils"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import { roundPixel } from "../chart/ChartUtils"

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
                id={makeFigmaId(label)}
                x1={roundPixel(x)}
                y1={roundPixel(top)}
                x2={roundPixel(x)}
                y2={roundPixel(bottom)}
                stroke="#999"
            />
            <text
                x={roundPixel(x)}
                y={roundPixel(bottom + labelPadding)}
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
