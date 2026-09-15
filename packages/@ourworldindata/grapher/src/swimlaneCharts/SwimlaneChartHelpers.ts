import * as R from "remeda"
import { match } from "ts-pattern"
import { Bounds } from "@ourworldindata/utils"
import { SortOrder, SwimlaneSortBy, Time } from "@ourworldindata/types"
import { sortByKey } from "../chart/ChartUtils"
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

export function sortSwimlaneRows({
    rows,
    sortBy,
    sortOrder,
    categories,
}: {
    rows: SwimlaneSeries[]
    sortBy: SwimlaneSortBy
    sortOrder: SortOrder
    categories: string[]
}): SwimlaneSeries[] {
    return match(sortBy)
        .with(SwimlaneSortBy.custom, () => rows)
        .with(SwimlaneSortBy.entityName, () =>
            sortByKey(rows, (row) => row.entityName, sortOrder)
        )
        .with(SwimlaneSortBy.firstCategory, () =>
            sortRowsByCategory({ rows, at: "first", sortOrder, categories })
        )
        .with(SwimlaneSortBy.lastCategory, () =>
            sortRowsByCategory({ rows, at: "last", sortOrder, categories })
        )
        .exhaustive()
}

function sortRowsByCategory({
    rows,
    at,
    sortOrder,
    categories,
}: {
    rows: SwimlaneSeries[]
    at: "first" | "last"
    sortOrder: SortOrder
    categories: string[]
}): SwimlaneSeries[] {
    const rankedCategories =
        at === "first" ? categories.toReversed() : categories

    const sortableRows = rows.map((row) => {
        const categorySegments = row.segments.filter(
            (segment) => segment.kind === "category"
        )
        const segment =
            at === "first"
                ? R.first(categorySegments)
                : R.last(categorySegments)

        return {
            row,
            categoryRank: segment
                ? rankedCategories.indexOf(segment.category)
                : -1,
            duration: segment ? segment.endTime - segment.startTime : 0,
        }
    })

    return sortByKey(
        sortableRows,
        [
            ({ categoryRank }) => categoryRank,
            ({ duration }) => duration,
            ({ row }) => row.entityName,
        ],
        sortOrder
    ).map(({ row }) => row)
}
