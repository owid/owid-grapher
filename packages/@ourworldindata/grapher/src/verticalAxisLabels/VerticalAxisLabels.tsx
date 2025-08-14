import React from "react"
import { VerticalAxis } from "../axis/Axis"
import { VerticalAxisLabelsState } from "./VerticalAxisLabelsState"
import { darkenColorForText } from "../color/ColorUtils.js"

export function VerticalAxisLabels({
    state,
    yAxis,
    x = 0,
    xAnchor = "start",
}: {
    state: VerticalAxisLabelsState
    yAxis: VerticalAxis
    x?: number
    xAnchor?: "start" | "end"
}): React.ReactElement {
    return (
        <g>
            {state.series.map((series) => (
                <React.Fragment key={series.yPosition}>
                    {series.textWrap.renderSVG(x, yAxis.place(series.value), {
                        textProps: {
                            textAnchor: xAnchor,
                            fill: darkenColorForText(series.color),
                        },
                    })}
                </React.Fragment>
            ))}
        </g>
    )
}
