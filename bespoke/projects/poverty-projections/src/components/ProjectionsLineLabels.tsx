import { useMemo } from "react"
import { TextWrap } from "@ourworldindata/components"

import { placeLineLabels } from "../helpers/lineLabelPlacement.js"

const LABEL_FONT_SIZE = 11

export interface LineLabelSpec {
    id: string
    text: string
    color: string
    /** Preferred vertical center: the y position of the line's last point */
    idealY: number
    bold?: boolean
}

/** Wrapped, collision-resolved labels at the right edge of a chart */
export function LineLabels({
    specs,
    x,
    maxWidth,
    top,
    bottom,
}: {
    specs: LineLabelSpec[]
    x: number
    maxWidth: number
    top: number
    bottom: number
}) {
    const labels = useMemo(() => {
        const wrapped = specs.map((spec) => ({
            spec,
            wrap: new TextWrap({
                text: spec.text,
                maxWidth,
                fontSize: LABEL_FONT_SIZE,
                fontWeight: spec.bold ? 700 : 400,
            }),
        }))

        const positions = placeLineLabels(
            wrapped.map(({ spec, wrap }) => ({
                id: spec.id,
                idealY: spec.idealY,
                height: wrap.height,
            })),
            { top, bottom, gap: 4 }
        )

        return wrapped.map(({ spec, wrap }) => ({
            spec,
            wrap,
            centerY: positions.get(spec.id) ?? spec.idealY,
        }))
    }, [specs, maxWidth, top, bottom])

    return (
        <g className="poverty-projections-line-labels">
            {labels.map(({ spec, wrap, centerY }) => {
                const topY = centerY - wrap.height / 2
                return (
                    <text
                        key={spec.id}
                        fontSize={LABEL_FONT_SIZE}
                        fill={spec.color}
                        fontWeight={spec.bold ? 700 : 400}
                    >
                        {wrap.lines.map((line, index) => (
                            <tspan
                                key={index}
                                x={x}
                                y={
                                    topY +
                                    index * wrap.singleLineHeight +
                                    LABEL_FONT_SIZE * 0.85
                                }
                            >
                                {line.text}
                            </tspan>
                        ))}
                    </text>
                )
            })}
        </g>
    )
}

/** Swatch legend shown instead of the right-edge labels on narrow charts */
export function ProjectionsLegend({
    items,
}: {
    items: { id: string; label: string; color: string }[]
}) {
    return (
        <div className="poverty-projections-legend">
            {items.map((item) => (
                <div key={item.id} className="poverty-projections-legend__item">
                    <span
                        className="poverty-projections-legend__swatch"
                        style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                </div>
            ))}
        </div>
    )
}
