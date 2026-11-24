import * as React from "react"
import { scaleLinear } from "d3-scale"
import { extent } from "d3-array"
import { Bounds, pointsToPath, roundForSvg } from "@ourworldindata/utils"
import { OwidVariableRow } from "@ourworldindata/types"
import { GRAPHER_DENIM } from "../color/ColorConstants"

const WIDTH = 75
const HEIGHT = 18
const DOT_RADIUS = 3

export function Sparkline({
    owidRows,
    strokeStyle,
}: {
    owidRows: OwidVariableRow<number>[]
    strokeStyle: "solid" | "dotted"
}): React.ReactElement | null {
    if (owidRows.length <= 1) return null

    // add a little padding so the dots don't overflow
    const bounds = new Bounds(0, 0, WIDTH, HEIGHT).padWidth(DOT_RADIUS)

    const firstRow = owidRows[0]
    const lastRow = owidRows[owidRows.length - 1]
    const minTime = firstRow.originalTime
    const maxTime = lastRow.originalTime

    // calculate x-scale
    const xScale = scaleLinear()
        .domain([minTime, maxTime])
        .range([bounds.left, bounds.right])

    // calculate y-scale
    const yDomain = extent(owidRows.map((row) => row.value)) as [number, number]
    const yScale = scaleLinear()
        .domain(yDomain)
        .range([bounds.bottom, bounds.top])

    const path = pointsToPath(
        owidRows.map((row) => ({
            x: xScale(row.originalTime),
            y: yScale(row.value),
        }))
    )

    const strokeDasharray = strokeStyle === "dotted" ? "2,3" : undefined

    return (
        <svg
            width={WIDTH}
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            style={{ overflow: "visible" }}
        >
            <path
                d={path}
                stroke={GRAPHER_DENIM}
                fill="none"
                strokeWidth={1.5}
                strokeDasharray={strokeDasharray}
            />

            {[firstRow, lastRow].map((row) => (
                <circle
                    key={row.originalTime}
                    cx={roundForSvg(xScale(row.originalTime))}
                    cy={roundForSvg(yScale(row.value))}
                    r={DOT_RADIUS}
                    fill={GRAPHER_DENIM}
                />
            ))}
        </svg>
    )
}
