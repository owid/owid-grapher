import {
    END_YEAR,
    HISTORICAL_END_YEAR,
    START_YEAR,
} from "../helpers/constants.js"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import type { YearLabel } from "../helpers/types.js"

const DEFAULT_X_TICK_LABELS: YearLabel[] = [
    { year: START_YEAR, position: "start" },
    { year: HISTORICAL_END_YEAR, position: "middle" },
    { year: END_YEAR, position: "end" },
]

export function TimeAxisX({
    xScale,
    innerWidth,
    innerHeight,
    strokeColor = GRAPHER_LIGHT_TEXT,
    fontSize = 11,
    labelOffset = 16,
    hiddenYears,
    xTickLabels = DEFAULT_X_TICK_LABELS,
}: {
    xScale: (v: number) => number
    innerWidth: number
    innerHeight: number
    strokeColor?: string
    fontSize?: number
    labelOffset?: number
    hiddenYears?: Set<number>
    xTickLabels?: YearLabel[]
}) {
    return (
        <g transform={`translate(0,${innerHeight})`}>
            <line
                x1={0}
                y1={0}
                x2={innerWidth}
                y2={0}
                stroke={strokeColor}
                strokeLinecap="square"
            />
            {xTickLabels.map(({ year }) => (
                <line
                    key={year}
                    x1={xScale(year)}
                    y1={0}
                    x2={xScale(year)}
                    y2={5}
                    stroke={strokeColor}
                />
            ))}
            {xTickLabels.map(({ year, position }) => (
                <text
                    key={year}
                    x={xScale(year)}
                    y={labelOffset}
                    textAnchor={position}
                    fontSize={fontSize}
                    fill={GRAPHER_LIGHT_TEXT}
                    opacity={hiddenYears?.has(year) ? 0 : 1}
                >
                    {year}
                </text>
            ))}
        </g>
    )
}
