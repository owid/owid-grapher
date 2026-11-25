import type { ScaleLogarithmic } from "d3-scale"

import {
    GRAPHER_BACKGROUND,
    GRAPHER_LIGHT_TEXT,
    GRAY_20,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { BezierArrow } from "@ourworldindata/grapher/src/arrows/BezierArrow.js"

import type { AxisTick } from "../../core/axisTicks.js"

/** The income axis: gridlines and ticks (see computeAxisTicks) under the plot, and its label below them */
export function XAxis({
    ticks,
    xScale,
    plotTop,
    plotBottom,
    plotLeft,
    plotRight,
    fontSize,
    isNarrow,
    per,
    currencyLabel,
}: {
    ticks: AxisTick[]
    xScale: ScaleLogarithmic<number, number>
    plotTop: number
    plotBottom: number
    plotLeft: number
    plotRight: number
    fontSize: number
    /** Narrow charts split the axis label onto two lines */
    isNarrow: boolean
    /** "day", "month" or "year" */
    per: string
    /** "international-$" or "Euro (Germany)" */
    currencyLabel: string
}): React.ReactElement {
    return (
        <g className="income-distribution-chart__axis" pointerEvents="none">
            {/* Under the tick labels, centred on the plot */}
            <text
                className="income-distribution-chart__axis-label"
                x={(plotLeft + plotRight) / 2}
                y={plotBottom + 36}
                dy="0.71em"
                textAnchor="middle"
                fontSize={fontSize}
                fill={GRAPHER_LIGHT_TEXT}
            >
                {isNarrow ? (
                    <>
                        <tspan x={(plotLeft + plotRight) / 2}>
                            Income or consumption per {per} in {currencyLabel}
                        </tspan>
                        <tspan x={(plotLeft + plotRight) / 2} dy="1.25em">
                            logarithmic scale
                        </tspan>
                    </>
                ) : (
                    `Income or consumption per ${per} in ${currencyLabel} — logarithmic scale`
                )}
            </text>
            {ticks.map((tick) => {
                const x = xScale(tick.value)
                const isLabelled = tick.label !== undefined
                return (
                    <g key={tick.value}>
                        {isLabelled && (
                            <line
                                x1={x}
                                x2={x}
                                y1={plotTop}
                                y2={plotBottom}
                                stroke={GRAY_20}
                            />
                        )}
                        <line
                            x1={x}
                            x2={x}
                            y1={plotBottom}
                            y2={plotBottom + (isLabelled ? 5 : 3)}
                            stroke={GRAPHER_LIGHT_TEXT}
                        />
                        {isLabelled && (
                            <text
                                x={x}
                                y={plotBottom + 9}
                                dy="0.71em"
                                textAnchor="middle"
                                fontSize={fontSize}
                                fill={GRAPHER_LIGHT_TEXT}
                            >
                                {tick.label}
                            </text>
                        )}
                    </g>
                )
            })}
        </g>
    )
}

/** "⟵ Poorest" and "Richest ⟶" just above either end of the x axis */
export function AxisEndLabels({
    left,
    right,
    plotLeft,
    plotRight,
    y,
    fontSize,
}: {
    left: string
    right: string
    plotLeft: number
    plotRight: number
    /** Baseline */
    y: number
    fontSize: number
}): React.ReactElement {
    const arrowLength = 18
    const gap = 4
    const arrowY = y - fontSize * 0.3
    const textProps = {
        y,
        fontSize,
        fill: GRAPHER_LIGHT_TEXT,
        stroke: GRAPHER_BACKGROUND,
        strokeWidth: 3,
        paintOrder: "stroke",
    } as const
    return (
        <g
            className="income-distribution-chart__axis-ends"
            pointerEvents="none"
        >
            <BezierArrow
                start={{ x: plotLeft + arrowLength, y: arrowY }}
                end={{ x: plotLeft, y: arrowY }}
                color={GRAPHER_LIGHT_TEXT}
                headLength={4}
            />
            <text x={plotLeft + arrowLength + gap} {...textProps}>
                {left}
            </text>
            <BezierArrow
                start={{ x: plotRight - arrowLength, y: arrowY }}
                end={{ x: plotRight, y: arrowY }}
                color={GRAPHER_LIGHT_TEXT}
                headLength={4}
            />
            <text
                x={plotRight - arrowLength - gap}
                textAnchor="end"
                {...textProps}
            >
                {right}
            </text>
        </g>
    )
}
