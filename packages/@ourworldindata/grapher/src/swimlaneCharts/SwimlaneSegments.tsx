import React from "react"
import { roundForSvg } from "@ourworldindata/utils"
import { PlacedSwimlaneSegment } from "./SwimlaneChartConstants"

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
                <rect
                    key={segment.startTime}
                    x={roundForSvg(segment.x)}
                    y={roundForSvg(segment.y)}
                    width={roundForSvg(segment.width)}
                    height={roundForSvg(segment.height)}
                    fill={
                        segment.kind === "missing"
                            ? `url(#${noDataPatternId})`
                            : segment.color
                    }
                />
            ))}
        </>
    )
}
