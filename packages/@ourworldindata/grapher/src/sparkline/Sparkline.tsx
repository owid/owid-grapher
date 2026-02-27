import * as React from "react"
import { scaleLinear } from "d3-scale"
import { extent, line } from "d3"
import { Bounds } from "@ourworldindata/utils"
import { OwidVariableRow } from "@ourworldindata/types"
import { GRAY_30 } from "../color/ColorConstants"
import { SparklineHighlight } from "../dataTable/DataTableConstants"

export function Sparkline({
    width = 75,
    height = 18,
    owidRows,
    minTime,
    maxTime,
    highlights = [],
    dotSize = 3.5,
    color = "#4C6A9C",
    strokeStyle = "solid",
}: {
    width?: number
    height?: number
    owidRows: OwidVariableRow<number>[]
    minTime: number
    maxTime: number
    highlights?: SparklineHighlight[]
    dotSize?: number
    color?: string
    strokeStyle?: "solid" | "dotted"
}): React.ReactElement | null {
    if (owidRows.length <= 1) return null

    // add a little padding so the dots don't overflow
    const bounds = new Bounds(0, 0, width, height).padWidth(dotSize)

    // calculate x-scale
    const xDomain = [minTime, maxTime]
    const xScale = scaleLinear()
        .domain(xDomain)
        .range([bounds.left, bounds.right])

    // calculate y-scale
    const yDomain = extent(owidRows.map((row) => row.value)) as [number, number]
    const yScale = scaleLinear()
        .domain(yDomain)
        .range([bounds.bottom, bounds.top])

    const makePath = line<OwidVariableRow<number>>()
        .x((row) => xScale(row.originalTime))
        .y((row) => yScale(row.value))

    const path = makePath(owidRows)
    if (!path) return null

    const strokeDasharray = strokeStyle === "dotted" ? "2,3" : undefined

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ overflow: "visible" }}
        >
            {/* marker lines of highlights */}
            {highlights
                .filter((highlight) => highlight.showMarker)
                .map((highlight) => (
                    <line
                        key={highlight.time}
                        x1={xScale(highlight.time)}
                        x2={xScale(highlight.time)}
                        y1={0}
                        y2={height}
                        stroke={GRAY_30}
                    />
                ))}

            {/* sparkline */}
            <path
                d={path}
                stroke={color}
                fill="none"
                strokeWidth={1.5}
                strokeDasharray={strokeDasharray}
            />

            {/* highlighted data points */}
            {highlights
                .filter((highlight) => highlight.value !== undefined)
                .map((highlight) => (
                    <circle
                        key={highlight.time}
                        cx={xScale(highlight.time)}
                        cy={yScale(highlight.value!)}
                        r={dotSize}
                        fill={color}
                        stroke="#fff"
                    />
                ))}
        </svg>
    )
}
