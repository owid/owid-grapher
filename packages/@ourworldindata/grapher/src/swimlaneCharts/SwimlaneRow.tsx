import React from "react"
import { makeFigmaId, roundForSvg } from "@ourworldindata/utils"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { SeriesLabel } from "../seriesLabel/SeriesLabel"
import { PlacedSwimlaneSeries } from "./SwimlaneChartConstants"
import { SwimlaneSegments } from "./SwimlaneSegments"

export function SwimlaneRow({
    series,
    y,
    noDataPatternId,
}: {
    series: PlacedSwimlaneSeries
    y: number
    noDataPatternId: string
}): React.ReactElement {
    return (
        <g
            id={makeFigmaId(series.seriesName)}
            transform={`translate(0, ${roundForSvg(y)})`}
        >
            <SeriesLabel
                state={series.label}
                x={series.labelPosition.x}
                y={series.labelPosition.yOffset}
                color={{ name: GRAPHER_LIGHT_TEXT }}
            />
            <SwimlaneSegments
                segments={series.placedSegments}
                noDataPatternId={noDataPatternId}
            />
        </g>
    )
}
