import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { SortKeyFn } from "../chart/ChartUtils"
import { computeCenteredLabelYPositions } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import {
    ENTITY_LABEL_CHART_GAP,
    LANE_SPACING_FACTOR,
    MIN_SEGMENT_WIDTH,
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
    SwimlaneObservation,
    SwimlaneSegment,
    SwimlaneSeries,
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

    const slotHeight = bounds.height / allSeries.length
    const laneHeight = slotHeight * (1 - LANE_SPACING_FACTOR)
    const labelX = bounds.left - ENTITY_LABEL_CHART_GAP

    return allSeries.map((series, index): PlacedSwimlaneSeries => {
        const y = bounds.top + (index + 0.5) * slotHeight

        const placedSegments: PlacedSwimlaneSegment[] = series.segments.map(
            (segment, segmentIndex): PlacedSwimlaneSegment => {
                // A segment runs up to wherever the next one starts, so that
                // two categories share an edge rather than showing a seam that
                // would read as missing data. The last one stops at its own
                // final observation.
                const nextSegment = series.segments[segmentIndex + 1]
                const x = placeTime(segment.startTime)
                const endTime = nextSegment?.startTime ?? segment.endTime
                const width = Math.max(
                    placeTime(endTime) - x,
                    MIN_SEGMENT_WIDTH
                )
                return {
                    ...segment,
                    x,
                    width,
                    y: -laneHeight / 2,
                    height: laneHeight,
                }
            }
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

/** Sort key that orders series by the category they start or end on */
export function sortByCategory({
    series: allSeries,
    boundary,
    categories,
}: {
    series: SwimlaneSeries[]
    boundary: "first" | "last"
    categories: string[]
}): SortKeyFn<SwimlaneSeries>[] {
    const rankedCategories =
        boundary === "first" ? categories.toReversed() : categories

    const sortCriteriaByEntityName = new Map(
        allSeries.map((series) => {
            const segment =
                boundary === "first"
                    ? series.segments.find(
                          (segment) => segment.kind === "category"
                      )
                    : series.segments.findLast(
                          (segment) => segment.kind === "category"
                      )

            return [
                series.entityName,
                {
                    categoryRank: segment
                        ? rankedCategories.indexOf(segment.category)
                        : -1,
                    duration: segment ? segment.endTime - segment.startTime : 0,
                },
            ]
        })
    )

    return [
        (series) =>
            sortCriteriaByEntityName.get(series.entityName)?.categoryRank,
        (series) => sortCriteriaByEntityName.get(series.entityName)?.duration,
        (series) => series.entityName,
    ]
}
