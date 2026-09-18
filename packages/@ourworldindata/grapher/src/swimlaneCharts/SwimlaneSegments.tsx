import React from "react"
import { match } from "ts-pattern"
import { dyFromAlign, roundForSvg } from "@ourworldindata/utils"
import { VerticalAlign } from "@ourworldindata/types"
import { Patterns } from "../core/GrapherConstants"
import { GRAY_100 } from "../color/ColorConstants"
import { isDarkColor } from "../color/ColorUtils"
import {
    PlacedSwimlaneCategorySegment,
    PlacedSwimlaneSegment,
    SEGMENT_LABEL_PADDING,
    SEGMENT_LABEL_TIME_RANGE_FONT_WEIGHT,
} from "./SwimlaneChartConstants"
import {
    chooseSegmentLabel,
    formatSegmentTimeRange,
    SwimlaneSegmentLabel,
    SwimlaneSegmentLabelSettings,
} from "./SwimlaneLabels"

export function SwimlaneSegments({
    segments,
    labelSettings,
}: {
    segments: PlacedSwimlaneSegment[]
    labelSettings: SwimlaneSegmentLabelSettings
}): React.ReactElement {
    return (
        <>
            {segments.map((segment) => (
                <g key={segment.startTime}>
                    <rect
                        x={roundForSvg(segment.x)}
                        y={roundForSvg(segment.y)}
                        width={roundForSvg(segment.width)}
                        height={roundForSvg(segment.height)}
                        fill={
                            segment.kind === "missing"
                                ? `url(#${Patterns.noDataPattern})`
                                : segment.color
                        }
                    />
                    {segment.kind === "category" && (
                        <SwimlaneSegmentLabelText
                            segment={segment}
                            labelSettings={labelSettings}
                        />
                    )}
                </g>
            ))}
        </>
    )
}

function SwimlaneSegmentLabelText({
    segment,
    labelSettings,
}: {
    segment: PlacedSwimlaneCategorySegment
    labelSettings: SwimlaneSegmentLabelSettings
}): React.ReactElement | null {
    const { segmentLabels, fontSettings, formatTime } = labelSettings

    const timeRange = formatSegmentTimeRange({
        startTime: segment.startTime,
        endTime: segment.endTime,
        formatTime,
    })

    const label = chooseSegmentLabel({
        segmentLabels,
        category: segment.category,
        timeRange,
        width: segment.width,
        height: segment.height,
        fontSettings,
    })

    const lines = toLabelLines(label, fontSettings.fontWeight)
    if (lines.length === 0) return null

    const lineHeight = fontSettings.fontSize * fontSettings.lineHeight
    const x = roundForSvg(segment.x + SEGMENT_LABEL_PADDING)
    const firstLineY = roundForSvg(
        segment.y + segment.height / 2 - ((lines.length - 1) * lineHeight) / 2
    )
    const color = isDarkColor(segment.color) ? "#fff" : GRAY_100

    return (
        <text
            x={x}
            y={firstLineY}
            dy={dyFromAlign(VerticalAlign.middle)}
            fontSize={fontSettings.fontSize}
            fill={color}
        >
            {lines.map((line, index) => (
                <tspan
                    key={line.text}
                    x={x}
                    dy={index === 0 ? undefined : roundForSvg(lineHeight)}
                    fontWeight={line.fontWeight}
                >
                    {line.text}
                </tspan>
            ))}
        </text>
    )
}

interface SwimlaneSegmentLabelLine {
    text: string
    fontWeight: number
}

function toLabelLines(
    label: SwimlaneSegmentLabel,
    categoryFontWeight: number
): SwimlaneSegmentLabelLine[] {
    return match(label)
        .with({ kind: "twoLines" }, ({ category, timeRange }) => [
            { text: category, fontWeight: categoryFontWeight },
            {
                text: timeRange,
                fontWeight: SEGMENT_LABEL_TIME_RANGE_FONT_WEIGHT,
            },
        ])
        .with({ kind: "oneLine" }, ({ text }) => [
            { text, fontWeight: categoryFontWeight },
        ])
        .with({ kind: "categoryOnly" }, ({ category }) => [
            { text: category, fontWeight: categoryFontWeight },
        ])
        .with({ kind: "none" }, () => [])
        .exhaustive()
}
