import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { computeCenteredLabelYPositions } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import {
    ENTITY_LABEL_CHART_GAP,
    LANE_SPACING_FACTOR,
    MAX_LANE_HEIGHT,
    MIN_SEGMENT_WIDTH,
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
    SwimlaneObservation,
    SwimlaneSegment,
} from "./SwimlaneChartConstants"

export function toSwimlaneSegments({
    observations,
    timesAsc,
}: {
    observations: SwimlaneObservation[]
    timesAsc: Time[]
}): SwimlaneSegment[] {
    if (timesAsc.length === 0) return []

    const lastIndex = timesAsc.length - 1
    const categoryByTime = new Map(
        observations.map(({ time, category }) => [time, category])
    )
    const categoryByTimeIndex = timesAsc.map((time) => categoryByTime.get(time))

    const segments: SwimlaneSegment[] = []
    let startIndex = 0
    for (let index = 0; index <= lastIndex; index++) {
        const isRunEnd =
            index === lastIndex ||
            categoryByTimeIndex[index + 1] !== categoryByTimeIndex[index]
        if (!isRunEnd) continue

        const range = {
            startTime: timesAsc[startIndex],
            endTime: timesAsc[index],
        }
        const category = categoryByTimeIndex[index]
        segments.push(
            category === undefined
                ? { kind: "missing", ...range }
                : { kind: "category", category, ...range }
        )
        startIndex = index + 1
    }
    return segments
}

export function computeLaneSlotHeight({
    plotHeight,
    laneCount,
}: {
    plotHeight: number
    laneCount: number
}): number {
    return Math.min(
        plotHeight / laneCount,
        MAX_LANE_HEIGHT / (1 - LANE_SPACING_FACTOR)
    )
}

export function toPlacedSwimlaneSeries({
    series: allSeries,
    bounds,
    placeTime,
}: {
    series: SizedSwimlaneSeries[]
    bounds: Bounds
    placeTime: (time: Time) => number
}): PlacedSwimlaneSeries[] {
    if (allSeries.length === 0) return []

    const slotHeight = computeLaneSlotHeight({
        plotHeight: bounds.height,
        laneCount: allSeries.length,
    })
    const laneHeight = slotHeight * (1 - LANE_SPACING_FACTOR)
    const labelX = bounds.left - ENTITY_LABEL_CHART_GAP
    const blockTop =
        bounds.top + (bounds.height - slotHeight * allSeries.length) / 2

    return allSeries.map((series, index): PlacedSwimlaneSeries => {
        const y = blockTop + (index + 0.5) * slotHeight

        const extents = toContiguousSegmentExtents({
            segments: series.segments,
            bounds,
            placeTime,
        })
        const placedSegments: PlacedSwimlaneSegment[] = series.segments.map(
            (segment, segmentIndex): PlacedSwimlaneSegment => ({
                ...segment,
                ...extents[segmentIndex],
                y: -laneHeight / 2,
                height: laneHeight,
            })
        )

        const { labelY } = computeCenteredLabelYPositions({
            y,
            label: series.label,
        })

        return {
            ...series,
            y,
            labelPosition: { x: labelX, yOffset: labelY - y },
            placedSegments,
        }
    })
}

function toContiguousSegmentExtents({
    segments,
    bounds,
    placeTime,
}: {
    segments: SwimlaneSegment[]
    bounds: Bounds
    placeTime: (time: Time) => number
}): { x: number; width: number }[] {
    // Degenerate case: a lone zero-extent segment covers the full width
    const [onlySegment] = segments
    if (segments.length === 1 && onlySegment.startTime === onlySegment.endTime)
        return [{ x: bounds.left, width: bounds.width }]

    return segments.map((segment, index) => {
        const nextSegment = segments[index + 1]
        const x = placeTime(segment.startTime)
        const right = placeTime(nextSegment?.startTime ?? segment.endTime)
        return { x, width: Math.max(right - x, MIN_SEGMENT_WIDTH) }
    })
}
