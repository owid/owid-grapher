import { dyFromAlign, VerticalAlign } from "@ourworldindata/utils"
import { VerticalAxis } from "../axis/Axis"
import { VerticalAxisLabelsState } from "./VerticalAxisLabelsState"

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
                <text
                    key={series.position}
                    x={x}
                    y={yAxis.place(series.value)}
                    fontSize={state.options.fontSize}
                    fill={series.color}
                    dy={dyFromAlign(VerticalAlign.middle)}
                    textAnchor={xAnchor}
                >
                    {series.label}
                </text>
            ))}
        </g>
    )
}
