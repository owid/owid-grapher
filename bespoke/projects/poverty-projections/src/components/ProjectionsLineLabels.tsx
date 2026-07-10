import { useMemo } from "react"
import { TextWrap } from "@ourworldindata/components"
import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"

import { placeLineLabels } from "../helpers/lineLabelPlacement.js"

// Grapher's line-legend metrics (see grapher's VerticalLabels)
export const LABEL_FONT_SIZE = 12
export const MARKER_MARGIN = 4
export const CONNECTOR_LINE_WIDTH = 25
const CONNECTOR_COLOR = "#999"

export interface LineLabelSpec {
    id: string
    text: string
    /** The series color; the text is darkened for contrast like grapher's
     * line legend */
    color: string
    /** Preferred vertical center: the y position of the line's last point */
    idealY: number
    bold?: boolean
}

export interface WrappedLineLabel {
    spec: LineLabelSpec
    wrap: TextWrap
}

/** Measure the labels, so the chart can size its right margin:
 * connector + widest label */
export function wrapLineLabels(
    specs: LineLabelSpec[],
    maxWidth: number
): { labels: WrappedLineLabel[]; width: number } {
    const labels = specs.map((spec) => ({
        spec,
        wrap: new TextWrap({
            text: spec.text,
            maxWidth,
            fontSize: LABEL_FONT_SIZE,
            fontWeight: spec.bold ? 700 : 400,
        }),
    }))
    const maxLabelWidth = Math.max(...labels.map(({ wrap }) => wrap.width), 0)
    return {
        labels,
        width: CONNECTOR_LINE_WIDTH + Math.ceil(maxLabelWidth) + MARKER_MARGIN,
    }
}

/** Grapher-style line labels at the right edge of a chart: wrapped,
 * collision-resolved, connected to their series by thin stepped connector
 * lines */
export function LineLabels({
    labels,
    seriesEndX,
    top,
    bottom,
}: {
    labels: WrappedLineLabel[]
    /** x position where the series end (the right edge of the plot) */
    seriesEndX: number
    top: number
    bottom: number
}) {
    const placed = useMemo(() => {
        const positions = placeLineLabels(
            labels.map(({ spec, wrap }) => ({
                id: spec.id,
                idealY: spec.idealY,
                height: wrap.height,
            })),
            { top, bottom, gap: 4 }
        )
        return labels.map(({ spec, wrap }) => ({
            spec,
            wrap,
            centerY: positions.get(spec.id) ?? spec.idealY,
        }))
    }, [labels, top, bottom])

    const connectorStartX = seriesEndX + MARKER_MARGIN
    const connectorEndX = seriesEndX + CONNECTOR_LINE_WIDTH - MARKER_MARGIN
    const connectorMidX = (connectorStartX + connectorEndX) / 2
    const labelsX = seriesEndX + CONNECTOR_LINE_WIDTH

    return (
        <g className="poverty-projections-line-labels">
            {placed.map(({ spec, centerY }) => (
                <path
                    key={spec.id}
                    d={`M${connectorStartX},${spec.idealY} H${connectorMidX} V${centerY} H${connectorEndX}`}
                    stroke={CONNECTOR_COLOR}
                    strokeWidth={0.5}
                    fill="none"
                />
            ))}
            {placed.map(({ spec, wrap, centerY }) => {
                const topY = centerY - wrap.height / 2
                return (
                    <text
                        key={spec.id}
                        fontSize={LABEL_FONT_SIZE}
                        fill={darkenColorForText(spec.color)}
                        fontWeight={spec.bold ? 700 : 400}
                    >
                        {wrap.lines.map((line, index) => (
                            <tspan
                                key={index}
                                x={labelsX}
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
