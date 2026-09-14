import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { computeCenteredLabelYPositions } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import {
    LANE_SPACING_FACTOR,
    ENTITY_LABEL_CHART_GAP,
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
} from "./SwimlaneChartConstants"

export function placeSwimlaneLanes({
    series: allSeries,
    bounds,
    placeTime,
}: {
    series: SizedSwimlaneSeries[]
    bounds: Bounds
    placeTime: (time: Time) => number
}): PlacedSwimlaneSeries[] {
    if (allSeries.length === 0) return []

    const slotHeight = bounds.height / allSeries.length
    const laneSpacing = slotHeight * LANE_SPACING_FACTOR
    const laneHeight = slotHeight - laneSpacing

    return allSeries.map((series, index): PlacedSwimlaneSeries => {
        const y =
            bounds.top +
            laneHeight / 2 +
            laneSpacing / 2 +
            index * (laneHeight + laneSpacing)

        const placedSegments: PlacedSwimlaneSegment[] = series.segments.map(
            (segment) => {
                const x = placeTime(segment.startTime)
                const width = placeTime(segment.endTimeExclusive) - x
                return {
                    ...segment,
                    x,
                    width,
                    y: y - laneHeight / 2,
                    height: laneHeight,
                }
            }
        )

        const { labelY } = computeCenteredLabelYPositions({
            y,
            label: series.label,
        })
        const labelPosition = {
            x: bounds.left - ENTITY_LABEL_CHART_GAP,
            y: labelY,
        }

        return { ...series, y, labelPosition, placedSegments }
    })
}
