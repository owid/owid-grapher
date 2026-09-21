import React from "react"
import { makeFigmaId, roundForSvg } from "@ourworldindata/utils"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { SeriesLabel } from "../seriesLabel/SeriesLabel"
import {
    RenderSwimlaneSeries,
    SWIMLANE_LABEL_STYLE,
} from "./SwimlaneChartConstants"
import { SwimlaneSegments } from "./SwimlaneSegments"

export function SwimlaneRow({
    series,
    y,
    noDataPatternId,
}: {
    series: RenderSwimlaneSeries
    y: number
    noDataPatternId: string
}): React.ReactElement {
    return (
        <g
            id={makeFigmaId(series.seriesName)}
            transform={y ? `translate(0, ${roundForSvg(y)})` : undefined}
        >
            <SeriesLabel
                state={series.label}
                x={series.labelPosition.x}
                y={series.labelPosition.yOffset}
                color={{ name: GRAPHER_LIGHT_TEXT }}
                opacity={SWIMLANE_LABEL_STYLE[series.emphasis].opacity}
            />
            <SwimlaneSegments
                segments={series.placedSegments}
                noDataPatternId={noDataPatternId}
            />
        </g>
    )
}
