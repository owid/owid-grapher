import * as R from "remeda"
import { Bounds, roundForSvg } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { computeCenteredLabelYPositions } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import { resolveEmphasis } from "../interaction/Emphasis"
import { InteractionState } from "../interaction/InteractionState"
import { FocusArray } from "../focus/FocusArray"
import {
    ENTITY_LABEL_CHART_GAP,
    HoveredSwimlanePoint,
    LANE_SPACING_FACTOR,
    MAX_LANE_HEIGHT,
    MIN_SEGMENT_WIDTH,
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
    RenderSwimlaneSegment,
    RenderSwimlaneSeries,
    SizedSwimlaneSeries,
    SEGMENT_CROP_TAPER_RATIO,
    SwimlaneObservation,
    SwimlaneSegment,
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

/** Length of the point drawn at each cropped edge of a segment */
export function computeSegmentCropTaper({
    width,
    height,
}: {
    width: number
    height: number
}): number {
    return Math.min(SEGMENT_CROP_TAPER_RATIO * height, width / 3)
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
    const taper = computeSegmentCropTaper({ width, height })
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
            slotHeight,
            labelPosition: { x: labelX, yOffset: labelY - y },
            placedSegments,
        }
    })
}

export function toRenderSwimlaneSegments({
    segments,
    hoveredSegment,
    focus,
}: {
    segments: PlacedSwimlaneSegment[]
    hoveredSegment?: PlacedSwimlaneSegment
    focus?: InteractionState
}): RenderSwimlaneSegment[] {
    return segments.map((segment) => ({
        ...segment,
        emphasis: resolveEmphasis({
            hover: InteractionState.for(segment, hoveredSegment),
            focus,
        }),
    }))
}

export function toRenderSwimlaneSeries({
    series: allSeries,
    hoveredPoint,
    focusArray,
}: {
    series: PlacedSwimlaneSeries[]
    hoveredPoint?: HoveredSwimlanePoint
    focusArray: FocusArray
}): RenderSwimlaneSeries[] {
    const hoveredSeries = allSeries.find(
        (series) => series.seriesName === hoveredPoint?.laneEntityName
    )
    const hoveredSegment =
        hoveredSeries && hoveredPoint
            ? findSegmentAtX(hoveredSeries.placedSegments, hoveredPoint.x)
            : undefined

    return allSeries.map((series): RenderSwimlaneSeries => {
        const focus = focusArray.state(series.seriesName)
        return {
            ...series,
            emphasis: resolveEmphasis({ focus }),
            placedSegments: toRenderSwimlaneSegments({
                segments: series.placedSegments,
                hoveredSegment,
                focus,
            }),
        }
    })
}

export function findSegmentAtX(
    segments: PlacedSwimlaneSegment[],
    x: number
): PlacedSwimlaneSegment | undefined {
    if (segments.length === 0) return undefined

    let low = 0
    let high = segments.length - 1
    while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        if (segments[mid].x <= x) low = mid
        else high = mid - 1
    }

    const segment = segments[low]
    return x >= segment.x && x < segment.x + segment.width ? segment : undefined
}

export function findLaneAtY(
    series: PlacedSwimlaneSeries[],
    y: number
): PlacedSwimlaneSeries | undefined {
    return series.find(
        ({ y: laneY, slotHeight }) =>
            y >= laneY - slotHeight / 2 && y < laneY + slotHeight / 2
    )
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
