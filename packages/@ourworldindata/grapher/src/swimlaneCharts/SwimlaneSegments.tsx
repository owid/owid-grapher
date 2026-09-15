import React from "react"
import { roundForSvg } from "@ourworldindata/utils"
import { Patterns } from "../core/GrapherConstants"
import { PlacedSwimlaneSegment } from "./SwimlaneChartConstants"

export function SwimlaneSegments({
    segments,
}: {
    segments: PlacedSwimlaneSegment[]
}): React.ReactElement {
    return (
        <>
            {segments.map((segment) => (
                <rect
                    key={segment.startTime}
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
            ))}
        </>
    )
}
