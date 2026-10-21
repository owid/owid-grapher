import React from "react"
import { TextWrapSvg } from "@ourworldindata/components"
import { makeFigmaId, roundForSvg } from "@ourworldindata/utils"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { SeriesLabel } from "../seriesLabel/SeriesLabel"
import {
    RenderSwimlaneSegment,
    RenderSwimlaneSeries,
    SWIMLANE_LABEL_STYLE,
} from "./SwimlaneChartConstants"
import { SwimlaneSegments } from "./SwimlaneSegments"

export function SwimlaneRow({
    series,
    y,
    noDataPatternId,
    onSegmentMouseEnter,
    onSegmentMouseLeave,
}: {
    series: RenderSwimlaneSeries
    y: number
    noDataPatternId: string
    onSegmentMouseEnter?: (
        entityName: string,
        segment: RenderSwimlaneSegment
    ) => void
    onSegmentMouseLeave?: () => void
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
            {series.annotationTextWrap && series.annotationPosition && (
                <TextWrapSvg
                    textWrap={series.annotationTextWrap}
                    x={series.annotationPosition.x}
                    y={series.annotationPosition.yOffset}
                    fill={GRAPHER_LIGHT_TEXT}
                    textAnchor="end"
                    opacity={SWIMLANE_LABEL_STYLE[series.emphasis].opacity}
                />
            )}
            <SwimlaneSegments
                segments={series.placedSegments}
                noDataPatternId={noDataPatternId}
                onMouseEnter={
                    onSegmentMouseEnter &&
                    ((segment): void =>
                        onSegmentMouseEnter(series.entityName, segment))
                }
                onMouseLeave={onSegmentMouseLeave}
            />
        </g>
    )
}
