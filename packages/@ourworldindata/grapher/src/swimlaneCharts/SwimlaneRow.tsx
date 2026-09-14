import React from "react"
import { makeFigmaId } from "@ourworldindata/utils"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { Patterns } from "../core/GrapherConstants"
import { SeriesLabel } from "../seriesLabel/SeriesLabel"
import { PlacedSwimlaneSeries } from "./SwimlaneChartConstants"

export function SwimlaneRow({
    series,
}: {
    series: PlacedSwimlaneSeries
}): React.ReactElement {
    return (
        <g id={makeFigmaId(series.seriesName)}>
            <SeriesLabel
                state={series.label}
                x={series.labelPosition.x}
                y={series.labelPosition.y}
                color={{ name: GRAPHER_LIGHT_TEXT }}
            />
            {series.placedSegments.map((segment) => (
                <rect
                    key={segment.startTime}
                    x={segment.x}
                    y={segment.y}
                    width={segment.width}
                    height={segment.height}
                    fill={
                        segment.kind === "missing"
                            ? `url(#${Patterns.noDataPattern})`
                            : segment.color
                    }
                />
            ))}
        </g>
    )
}
