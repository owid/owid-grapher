import React from "react"
import { Bounds, makeFigmaId } from "@ourworldindata/utils"
import { HorizontalAxis } from "../axis/Axis"
import { HorizontalAxisGridLines } from "../axis/AxisViews"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"

export function SlopeChartXAxis({
    axis,
    bounds,
    padding,
}: {
    axis: HorizontalAxis
    bounds: Bounds
    padding: number
}): React.ReactElement {
    const hideTickLabels = axis.config.hideTickLabels
    return (
        <g id={makeFigmaId("horizontal-axis")}>
            <HorizontalAxisGridLines axis={axis} bounds={bounds} />
            {!hideTickLabels && (
                <g id={makeFigmaId("tick-labels")}>
                    {axis.tickLabels.map((label) => (
                        <text
                            key={label.value}
                            x={axis.place(label.value)}
                            y={bounds.bottom + padding + axis.tickFontSize}
                            textAnchor="middle"
                            fontSize={axis.tickFontSize}
                            fill={GRAPHER_DARK_TEXT}
                        >
                            {label.formattedValue}
                        </text>
                    ))}
                </g>
            )}
        </g>
    )
}
