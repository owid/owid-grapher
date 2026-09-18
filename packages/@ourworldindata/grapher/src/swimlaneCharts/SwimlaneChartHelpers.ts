import * as R from "remeda"
import { Bounds, roundForSvg } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { SortKeyFn } from "../chart/ChartUtils"
import { computeCenteredLabelYPositions } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import {
    ENTITY_LABEL_CHART_GAP,
    LANE_SPACING_FACTOR,
    MAX_LANE_HEIGHT,
    MIN_SEGMENT_WIDTH,
    OrdinalSwimlaneCategories,
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
    RankedSwimlane,
    SEGMENT_CROP_TAPER,
    SwimlaneCategories,
    SwimlaneObservation,
    SwimlaneSegment,
    SwimlaneSeries,
    VisibleSwimlaneSegment,
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

/** Restricts segments to the times the timeline shows, keeping the whole run each one covers */
export function toVisibleSwimlaneSegments({
    segments,
    visibleTimesAsc,
}: {
    segments: SwimlaneSegment[]
    visibleTimesAsc: Time[]
}): VisibleSwimlaneSegment[] {
    const firstVisibleTime = R.first(visibleTimesAsc)
    const lastVisibleTime = R.last(visibleTimesAsc)
    if (firstVisibleTime === undefined || lastVisibleTime === undefined)
        return []

    return segments
        .filter(
            (segment) =>
                segment.endTime >= firstVisibleTime &&
                segment.startTime <= lastVisibleTime
        )
        .map((segment) => {
            // A run covers consecutive times, so clamping to the window lands on one of its own times
            const range = {
                startTime: Math.max(segment.startTime, firstVisibleTime),
                endTime: Math.min(segment.endTime, lastVisibleTime),
            }
            if (segment.kind === "missing") return { ...segment, ...range }
            return {
                ...segment,
                ...range,
                runStartTime: segment.startTime,
                runEndTime: segment.endTime,
            }
        })
}

/** Outline of a segment, tapered to a point at each edge the timeline window cropped */
export function toSegmentOutlinePath({
    x,
    y,
    width,
    height,
    isStartCropped,
    isEndCropped,
}: {
    x: number
    y: number
    width: number
    height: number
    isStartCropped: boolean
    isEndCropped: boolean
}): string {
    const taper = Math.min(SEGMENT_CROP_TAPER, width / 3)
    const [left, right, top, bottom] = [x, x + width, y, y + height].map(
        roundForSvg
    )
    const middle = roundForSvg(y + height / 2)

    const start = isStartCropped
        ? [`M ${left},${middle}`, `L ${roundForSvg(left + taper)},${top}`]
        : [`M ${left},${top}`]
    const end = isEndCropped
        ? [
              `L ${roundForSvg(right - taper)},${top}`,
              `L ${right},${middle}`,
              `L ${roundForSvg(right - taper)},${bottom}`,
          ]
        : [`L ${right},${top}`, `L ${right},${bottom}`]
    const close = isStartCropped
        ? [`L ${roundForSvg(left + taper)},${bottom}`, "Z"]
        : [`L ${left},${bottom}`, "Z"]

    return [...start, ...end, ...close].join(" ")
}

export function toRankedSwimlane({
    series,
    categories,
}: {
    series: SwimlaneSeries[]
    categories: SwimlaneCategories | undefined
}): RankedSwimlane | undefined {
    if (series.length !== 1 || categories?.kind !== "ordinal") return undefined
    return { series: series[0], categories }
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

export function toPlacedSwimlaneSegmentsByCategoryRank({
    series,
    categories,
    bounds,
    placeTime,
}: {
    series: SwimlaneSeries
    categories: OrdinalSwimlaneCategories
    bounds: Bounds
    placeTime: (time: Time) => number
}): PlacedSwimlaneSegment[] {
    const bandHeight = Math.min(
        bounds.height / categories.values.length,
        MAX_LANE_HEIGHT
    )
    const stackBottom =
        bounds.bottom -
        (bounds.height - bandHeight * categories.values.length) / 2

    const extents = toContiguousSegmentExtents({
        segments: series.segments,
        placeTime,
    })

    return series.segments.flatMap(
        (segment, segmentIndex): PlacedSwimlaneSegment[] => {
            if (segment.kind === "missing") return []
            const rank = categories.values.indexOf(segment.category)
            return [
                {
                    ...segment,
                    ...extents[segmentIndex],
                    y: stackBottom - (rank + 1) * bandHeight,
                    height: bandHeight,
                },
            ]
        }
    )
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

function toContiguousSegmentExtents({
    segments,
    placeTime,
}: {
    segments: SwimlaneSegment[]
    placeTime: (time: Time) => number
}): { x: number; width: number }[] {
    return segments.map((segment, index) => {
        const nextSegment = segments[index + 1]
        const x = placeTime(segment.startTime)
        const right = placeTime(nextSegment?.startTime ?? segment.endTime)
        return { x, width: Math.max(right - x, MIN_SEGMENT_WIDTH) }
    })
}
