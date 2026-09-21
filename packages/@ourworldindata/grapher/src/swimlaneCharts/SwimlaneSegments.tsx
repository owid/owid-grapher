import React from "react"
import { dyFromAlign, roundForSvg } from "@ourworldindata/utils"
import { VerticalAlign } from "@ourworldindata/types"
import { GRAY_100 } from "../color/ColorConstants"
import { isDarkColor } from "../color/ColorUtils"
import {
    RenderSwimlaneCategorySegment,
    RenderSwimlaneSegment,
    SEGMENT_OUTLINE_WIDTH,
    SWIMLANE_LABEL_STYLE,
    SWIMLANE_SEGMENT_STYLE,
    SwimlaneSegmentCrop,
    SwimlaneSegmentPlacement,
} from "./SwimlaneChartConstants"

type Point = [x: number, y: number]

export function SwimlaneSegments({
    segments,
    noDataPatternId,
}: {
    segments: RenderSwimlaneSegment[]
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
                        <SwimlaneSegmentLabelText segment={segment} />
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

    if (
        segment.kind === "missing" ||
        (!segment.isStartCropped && !segment.isEndCropped)
    )
        return (
            <rect
                x={roundForSvg(x)}
                y={roundForSvg(y)}
                width={roundForSvg(width)}
                height={roundForSvg(height)}
                fill={fill}
                stroke="#fff"
                strokeWidth={SEGMENT_OUTLINE_WIDTH}
                opacity={opacity}
            />
        )

    return (
        <polygon
            points={toSegmentOutlinePoints(segment)}
            fill={fill}
            stroke="#fff"
            strokeWidth={SEGMENT_OUTLINE_WIDTH}
            opacity={opacity}
        />
    )
}

function SwimlaneSegmentLabelText({
    segment,
}: {
    segment: RenderSwimlaneCategorySegment
}): React.ReactElement | null {
    const { label } = segment
    if (!label) return null

    const { category, timeRange } = label.style
    const x = roundForSvg(label.x)
    const lineHeight = category.fontSize * category.lineHeight
    const color = isDarkColor(segment.color) ? "#fff" : GRAY_100
    const opacity = SWIMLANE_LABEL_STYLE[segment.emphasis].opacity

    return (
        <text
            x={x}
            y={roundForSvg(label.y)}
            dy={dyFromAlign(VerticalAlign.middle)}
            fontSize={category.fontSize}
            fill={color}
            opacity={opacity}
        >
            <tspan x={x} fontWeight={category.fontWeight}>
                {segment.categoryLabel}
            </tspan>
            <tspan
                x={x}
                dy={roundForSvg(lineHeight)}
                fontSize={timeRange.fontSize}
                fontWeight={timeRange.fontWeight}
            >
                {segment.timeRangeLabel}
            </tspan>
        </text>
    )
}

/** Outline of a segment, tapered to a point at each edge the timeline window cropped */
function toSegmentOutlinePoints({
    x,
    y,
    width,
    height,
    isStartCropped,
    isEndCropped,
    cropTaper,
}: SwimlaneSegmentPlacement & SwimlaneSegmentCrop): string {
    const [left, right, top, bottom] = [x, x + width, y, y + height]
    const middle = y + height / 2

    const leftEdge: Point[] = isStartCropped
        ? [
              [left + cropTaper, bottom],
              [left, middle],
              [left + cropTaper, top],
          ]
        : [
              [left, bottom],
              [left, top],
          ]
    const rightEdge: Point[] = isEndCropped
        ? [
              [right - cropTaper, top],
              [right, middle],
              [right - cropTaper, bottom],
          ]
        : [
              [right, top],
              [right, bottom],
          ]

    return [...leftEdge, ...rightEdge]
        .map(
            ([pointX, pointY]) =>
                `${roundForSvg(pointX)},${roundForSvg(pointY)}`
        )
        .join(" ")
}
