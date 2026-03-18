import { HISTORICAL_END_YEAR } from "./constants.js"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"

const YEAR_LABELS: readonly [number, "start" | "middle" | "end"][] = [
    [1950, "start"],
    [HISTORICAL_END_YEAR, "middle"],
    [2100, "end"],
]

export function DemographyAxisX({
    xScale,
    innerWidth,
    innerHeight,
    strokeColor = GRAPHER_LIGHT_TEXT,
    fontSize = 11,
    labelOffset = 16,
}: {
    xScale: (v: number) => number
    innerWidth: number
    innerHeight: number
    strokeColor?: string
    fontSize?: number
    labelOffset?: number
}) {
    return (
        <g transform={`translate(0,${innerHeight})`}>
            <line x1={0} y1={0} x2={innerWidth} y2={0} stroke={strokeColor} />
            <line
                x1={xScale(HISTORICAL_END_YEAR)}
                y1={0}
                x2={xScale(HISTORICAL_END_YEAR)}
                y2={5}
                stroke={strokeColor}
            />
            {YEAR_LABELS.map(([year, anchor]) => (
                <text
                    key={year}
                    x={xScale(year)}
                    y={labelOffset}
                    textAnchor={anchor}
                    fontSize={fontSize}
                    fill={GRAPHER_LIGHT_TEXT}
                >
                    {year}
                </text>
            ))}
        </g>
    )
}
