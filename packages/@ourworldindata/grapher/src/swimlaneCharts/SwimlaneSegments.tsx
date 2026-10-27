import React from "react"
import { curveLinearClosed, line } from "d3-shape"
import { dyFromAlign, roundForSvg } from "@ourworldindata/utils"
import { VerticalAlign } from "@ourworldindata/types"
import { GRAY_100 } from "../color/ColorConstants"
import { isDarkColor } from "../color/ColorUtils"
import {
    PlacedSwimlaneCategorySegment,
    PlacedSwimlaneSegment,
    SwimlaneSegmentCrop,
    SwimlaneSegmentPlacement,
} from "./SwimlaneChartConstants"

type Point = [x: number, y: number]

export function SwimlaneSegments({
    segments,
    noDataPatternId,
}: {
    segments: PlacedSwimlaneSegment[]
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
    segment: PlacedSwimlaneSegment
    noDataPatternId: string
}): React.ReactElement {
    const { x, y, width, height } = segment
    const fill =
        segment.kind === "missing" ? `url(#${noDataPatternId})` : segment.color

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
            />
        )

    return <path d={toSegmentOutlinePath(segment)} fill={fill} />
}

function SwimlaneSegmentLabelText({
    segment,
}: {
    segment: PlacedSwimlaneCategorySegment
}): React.ReactElement | null {
    const { label } = segment
    if (!label) return null

    const { category, timeRange } = label.style
    const x = roundForSvg(label.x)
    const lineHeight = category.fontSize * category.lineHeight
    const color = isDarkColor(segment.color) ? "#fff" : GRAY_100

    return (
        <text
            x={x}
            y={roundForSvg(label.y)}
            dy={dyFromAlign(VerticalAlign.middle)}
            fontSize={category.fontSize}
            fill={color}
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
function toSegmentOutlinePath({
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

    const outline = [...leftEdge, ...rightEdge].map(
        ([pointX, pointY]): Point => [roundForSvg(pointX), roundForSvg(pointY)]
    )
    return line<Point>().curve(curveLinearClosed)(outline) ?? ""
}
