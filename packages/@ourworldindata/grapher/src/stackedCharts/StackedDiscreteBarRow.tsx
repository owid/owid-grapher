import * as _ from "lodash-es"
import React from "react"
import { Bounds, makeFigmaId, dyFromAlign } from "@ourworldindata/utils"
import { VerticalAlign } from "@ourworldindata/types"
import { STACKED_BAR_STYLE } from "./StackedConstants"
import {
    LABEL_STYLE,
    RenderBarSegment,
    RenderDiscreteBarRow,
} from "./StackedDiscreteBarChartConstants.js"
import { isDarkColor } from "../color/ColorUtils"
import { HorizontalAxis } from "../axis/Axis"
import { SeriesLabel } from "../seriesLabel/SeriesLabel.js"

const labelToBarPadding = 5

export function StackedDiscreteBarRow({
    row,
    y = 0,
    barHeight,
    labelFontSize,
    yAxis,
    showTotalValueLabel,
    formatValueForLabel,
    onEntityMouseEnter,
    onEntityMouseLeave,
    onClearTooltip,
}: {
    row: RenderDiscreteBarRow
    y?: number
    barHeight: number
    labelFontSize: number
    yAxis: HorizontalAxis
    showTotalValueLabel: boolean
    formatValueForLabel: (value: number) => string
    onEntityMouseEnter: (entityName: string, seriesName?: string) => void
    onEntityMouseLeave: () => void
    onClearTooltip: () => void
}): React.ReactElement {
    const { entityName, label, segments, totalValue, emphasis } = row

    const totalLabel = formatValueForLabel(totalValue)
    const showLabelInsideBar = segments.length > 1

    const labelStyle = LABEL_STYLE[emphasis]

    // We can't just take the last segment here because if it has a negative value,
    // its position on the chart might actually be leftmost rather than rightmost.
    const lastValue =
        _.max(segments.map((seg) => seg.point.valueOffset + seg.point.value)) ??
        0

    return (
        <g
            id={makeFigmaId(entityName)}
            transform={`translate(0, ${y})`}
            opacity={1}
        >
            {segments.map((segment) => (
                <StackedDiscreteBar
                    key={segment.seriesName}
                    segment={segment}
                    entityName={entityName}
                    barHeight={barHeight}
                    label={formatValueForLabel(segment.point.value)}
                    labelFontSize={labelFontSize}
                    showLabelInsideBar={showLabelInsideBar}
                    onMouseEnter={onEntityMouseEnter}
                    onMouseLeave={onEntityMouseLeave}
                />
            ))}
            <SeriesLabel
                state={label}
                x={yAxis.place(0) - labelToBarPadding}
                y={-label.height / 2}
                onMouseEnter={(): void => onEntityMouseEnter(label.text)}
                onMouseLeave={onEntityMouseLeave}
                onInfoTooltipShow={onClearTooltip}
                opacity={labelStyle.opacity}
            />
            {showTotalValueLabel && (
                <text
                    transform={`translate(${
                        yAxis.place(lastValue) + labelToBarPadding
                    }, 0)`}
                    dy={dyFromAlign(VerticalAlign.middle)}
                    opacity={labelStyle.opacity}
                    fill="#555"
                    fontSize={labelFontSize}
                >
                    {totalLabel}
                </text>
            )}
        </g>
    )
}

function StackedDiscreteBar({
    segment,
    entityName,
    barHeight,
    label,
    labelFontSize,
    showLabelInsideBar,
    onMouseEnter,
    onMouseLeave,
}: {
    segment: RenderBarSegment
    entityName: string
    barHeight: number
    label: string
    labelFontSize: number
    showLabelInsideBar: boolean
    onMouseEnter: (entityName: string, seriesName: string) => void
    onMouseLeave: () => void
}): React.ReactElement {
    const labelBounds = Bounds.forText(label, { fontSize: labelFontSize })
    const canShowLabel =
        showLabelInsideBar &&
        labelBounds.width < 0.85 * segment.barWidth &&
        labelBounds.height < 0.85 * barHeight
    const labelColor = isDarkColor(segment.color) ? "#fff" : "#000"
    const segmentStyle = STACKED_BAR_STYLE[segment.emphasis]

    return (
        <g
            id={makeFigmaId(segment.seriesName)}
            onMouseEnter={(): void =>
                onMouseEnter(entityName, segment.seriesName)
            }
            onMouseLeave={onMouseLeave}
        >
            <rect
                id={makeFigmaId("bar")}
                x={0}
                y={0}
                transform={`translate(${segment.x}, ${-barHeight / 2})`}
                width={segment.barWidth}
                height={barHeight}
                fill={segment.color}
                opacity={segmentStyle.opacity}
                style={{ transition: "height 200ms ease" }}
            />
            {canShowLabel && (
                <text
                    x={segment.x + segment.barWidth / 2}
                    y={0}
                    width={segment.barWidth}
                    height={barHeight}
                    fill={labelColor}
                    fontSize={labelFontSize}
                    textAnchor="middle"
                    dy={dyFromAlign(VerticalAlign.middle)}
                >
                    {label}
                </text>
            )}
        </g>
    )
}
