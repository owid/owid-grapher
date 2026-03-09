import * as React from "react"
import { makeFigmaId } from "@ourworldindata/utils"
import {
    RenderDumbbellDataSeries,
    DUMBBELL_STYLE,
} from "./DumbbellChartConstants"

interface DumbbellProps {
    series: RenderDumbbellDataSeries
    /** Full width of the chart area for the gray background line */
    chartAreaLeft: number
    chartAreaRight: number
    dotRadius?: number
    lineWidth?: number
    outlineWidth?: number
    outlineStroke?: string
}

export function Dumbbell({
    series,
    chartAreaLeft,
    chartAreaRight,
    dotRadius = 4,
    lineWidth = 2,
    outlineWidth = 0.5,
    outlineStroke = "#fff",
}: DumbbellProps): React.ReactElement {
    const {
        startX,
        endX,
        barY,
        displayName,
        startColor,
        endColor,
        connectorColor,
    } = series
    const style = DUMBBELL_STYLE[series.emphasis]

    const minX = Math.min(startX, endX)
    const maxX = Math.max(startX, endX)

    return (
        <g
            id={makeFigmaId("dumbbell", displayName)}
            opacity={style.opacity}
            className="dumbbell"
        >
            {/* Gray background line spanning the full chart width */}
            <line
                x1={chartAreaLeft}
                y1={barY}
                x2={chartAreaRight}
                y2={barY}
                stroke="#eee"
                strokeWidth={1}
            />
            {/* Connecting line between dots */}
            <line
                id={makeFigmaId("connector")}
                x1={minX}
                y1={barY}
                x2={maxX}
                y2={barY}
                stroke={connectorColor}
                strokeWidth={lineWidth}
            />
            {/* Outline circles */}
            <circle
                id={makeFigmaId("start-outline")}
                cx={startX}
                cy={barY}
                r={dotRadius + outlineWidth}
                fill={outlineStroke}
            />
            <circle
                id={makeFigmaId("end-outline")}
                cx={endX}
                cy={barY}
                r={dotRadius + outlineWidth}
                fill={outlineStroke}
            />
            {/* Start dot */}
            <circle
                id={makeFigmaId("start-point")}
                cx={startX}
                cy={barY}
                r={dotRadius}
                fill={startColor}
            />
            {/* End dot */}
            <circle
                id={makeFigmaId("end-point")}
                cx={endX}
                cy={barY}
                r={dotRadius}
                fill={endColor}
            />
        </g>
    )
}
