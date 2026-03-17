import React from "react"
import { TextWrapSvg } from "@ourworldindata/components"
import { VerticalAxis } from "../axis/Axis"
import { SimpleVerticalLabelsState } from "./SimpleVerticalLabelsState"
import { darkenColorForText } from "../color/ColorUtils.js"

export function SimpleVerticalLabels({
    state,
    yAxis,
    x = 0,
    xAnchor = "start",
}: {
    state: SimpleVerticalLabelsState
    yAxis: VerticalAxis
    x?: number
    xAnchor?: "start" | "end"
}): React.ReactElement {
    return (
        <g>
            {state.series.map((series) => (
                <React.Fragment key={series.yPosition}>
                    <TextWrapSvg
                        textWrap={series.textWrap}
                        x={x}
                        y={yAxis.place(series.value)}
                        textAnchor={xAnchor}
                        fill={darkenColorForText(series.color)}
                    />
                </React.Fragment>
            ))}
        </g>
    )
}
