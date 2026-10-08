import React from "react"
import { dyFromAlign, roundForSvg } from "@ourworldindata/utils"
import { VerticalAlign } from "@ourworldindata/types"
import { GRAY_100 } from "../color/ColorConstants"
import { isDarkColor } from "../color/ColorUtils"
import {
    RenderSwimlaneCategorySegment,
    RenderSwimlaneSegment,
    SEGMENT_LABEL_PADDING,
    SEGMENT_LABEL_TIME_RANGE_FONT_WEIGHT,
    SWIMLANE_SEGMENT_STYLE,
} from "./SwimlaneChartConstants"
import {
    computeSegmentCropTaper,
    toSegmentOutlinePath,
} from "./SwimlaneChartHelpers"
import {
    formatSegmentTimeRange,
    shouldLabelSegment,
    SwimlaneSegmentLabelSettings,
} from "./SwimlaneLabels"

export function SwimlaneSegments({
    segments,
    labelSettings,
    noDataPatternId,
}: {
    segments: RenderSwimlaneSegment[]
    labelSettings: SwimlaneSegmentLabelSettings
    noDataPatternId: string
}): React.ReactElement {
    return (
        <>
            {segments.map((segment) => (
                <g key={segment.startTime}>
                    <SwimlaneSegmentShape
                        segment={segment}
                        noDataPatternId={noDataPatternId}
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

function SwimlaneSegmentShape({
    segment,
    noDataPatternId,
}: {
    segment: RenderSwimlaneSegment
    noDataPatternId: string
}): React.ReactElement {
    const { x, y, width, height } = segment
    const fill =
        segment.kind === "missing" ? `url(#${noDataPatternId})` : segment.color
    const opacity = SWIMLANE_SEGMENT_STYLE[segment.emphasis].opacity

    const isStartCropped = isSegmentStartCropped(segment)
    const isEndCropped = isSegmentEndCropped(segment)

    if (!isStartCropped && !isEndCropped)
        return (
            <rect
                x={roundForSvg(x)}
                y={roundForSvg(y)}
                width={roundForSvg(width)}
                height={roundForSvg(height)}
                fill={fill}
                opacity={opacity}
            />
        )

    return (
        <path
            d={toSegmentOutlinePath({
                x,
                y,
                width,
                height,
                isStartCropped,
                isEndCropped,
            })}
            fill={fill}
            opacity={opacity}
        />
    )
}

function SwimlaneSegmentLabelText({
    segment,
    labelSettings,
}: {
    segment: RenderSwimlaneCategorySegment
    labelSettings: SwimlaneSegmentLabelSettings
}): React.ReactElement | null {
    const { segmentLabels, fontSettings, formatTime } = labelSettings
    const { categoryLabel, width, height } = segment

    const timeRange = formatSegmentTimeRange({
        runStartTime: segment.runStartTime,
        runEndTime: segment.runEndTime,
        formatTime,
    })

    const taper = computeSegmentCropTaper({ width, height })
    const startInset = isSegmentStartCropped(segment) ? taper : 0
    const endInset = isSegmentEndCropped(segment) ? taper : 0

    const fits = shouldLabelSegment({
        segmentLabels,
        category: categoryLabel,
        timeRange,
        width: width - startInset - endInset,
        height,
        fontSettings,
    })
    if (!fits) return null

    const lineHeight = fontSettings.fontSize * fontSettings.lineHeight
    const x = roundForSvg(segment.x + startInset + SEGMENT_LABEL_PADDING)
    const firstLineY = roundForSvg(segment.y + height / 2 - lineHeight / 2)
    const color = isDarkColor(segment.color) ? "#fff" : GRAY_100
    const opacity = SWIMLANE_SEGMENT_STYLE[segment.emphasis].opacity

    return (
        <text
            x={x}
            y={firstLineY}
            dy={dyFromAlign(VerticalAlign.middle)}
            fontSize={fontSettings.fontSize}
            fill={color}
            opacity={opacity}
        >
            <tspan x={x} fontWeight={fontSettings.fontWeight}>
                {categoryLabel}
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

function isSegmentStartCropped(segment: RenderSwimlaneSegment): boolean {
    return (
        segment.kind === "category" && segment.runStartTime < segment.startTime
    )
}

function isSegmentEndCropped(segment: RenderSwimlaneSegment): boolean {
    return segment.kind === "category" && segment.runEndTime > segment.endTime
}
