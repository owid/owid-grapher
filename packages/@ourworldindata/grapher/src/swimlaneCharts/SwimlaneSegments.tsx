import React from "react"
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
    formatSegmentTimeRange,
    shouldLabelSegment,
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
    const { category, width, height } = segment

    const timeRange = formatSegmentTimeRange({
        startTime: segment.startTime,
        endTime: segment.endTime,
        formatTime,
    })

    const fits = shouldLabelSegment({
        segmentLabels,
        category,
        timeRange,
        width,
        height,
        fontSettings,
    })
    if (!fits) return null

    const lineHeight = fontSettings.fontSize * fontSettings.lineHeight
    const x = roundForSvg(segment.x + SEGMENT_LABEL_PADDING)
    const firstLineY = roundForSvg(segment.y + height / 2 - lineHeight / 2)
    const color = isDarkColor(segment.color) ? "#fff" : GRAY_100

    return (
        <text
            x={x}
            y={firstLineY}
            dy={dyFromAlign(VerticalAlign.middle)}
            fontSize={fontSettings.fontSize}
            fill={color}
        >
            <tspan x={x} fontWeight={fontSettings.fontWeight}>
                {category}
            </tspan>
            <tspan
                x={x}
                dy={roundForSvg(lineHeight)}
                fontWeight={SEGMENT_LABEL_TIME_RANGE_FONT_WEIGHT}
            >
                {timeRange}
            </tspan>
        </text>
    )
}
