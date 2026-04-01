import { HISTORICAL_END_YEAR } from "../helpers/constants.js"
import { GRAPHER_LIGHT_TEXT } from "@ourworldindata/grapher/src/color/ColorConstants.js"

type YearLabel = readonly [number, "start" | "middle" | "end"]

const DEFAULT_YEAR_LABELS: readonly YearLabel[] = [
    [1950, "start"],
    [HISTORICAL_END_YEAR, "middle"],
    [2100, "end"],
]

export function TimeAxisX({
    xScale,
    innerWidth,
    innerHeight,
    strokeColor = GRAPHER_LIGHT_TEXT,
    fontSize = 11,
    labelOffset = 16,
    hideLabels = false,
    yearLabels = DEFAULT_YEAR_LABELS,
}: {
    xScale: (v: number) => number
    innerWidth: number
    innerHeight: number
    strokeColor?: string
    fontSize?: number
    labelOffset?: number
    hideLabels?: boolean
    yearLabels?: readonly YearLabel[]
}) {
    return (
        <g transform={`translate(0,${innerHeight})`}>
            <line x1={0} y1={0} x2={innerWidth} y2={0} stroke={strokeColor} strokeLinecap="square" />
            {yearLabels.map(([year]) => (
                <line
                    key={year}
                    x1={xScale(year)}
                    y1={0}
                    x2={xScale(year)}
                    y2={5}
                    stroke={strokeColor}
                />
            ))}
            {!hideLabels &&
                yearLabels.map(([year, anchor]) => (
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
