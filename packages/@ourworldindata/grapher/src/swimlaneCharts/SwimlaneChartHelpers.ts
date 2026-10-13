import * as R from "remeda"
import { Bounds, roundForSvg } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { computeCenteredLabelYPositions } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import { resolveEmphasis } from "../interaction/Emphasis"
import { InteractionState } from "../interaction/InteractionState"
import { FocusArray } from "../focus/FocusArray"
import { CategoricalBin, isNoDataBin } from "../color/ColorScaleBin"
import {
    ENTITY_LABEL_CHART_GAP,
    HoveredSwimlanePoint,
    LANE_SPACING_FACTOR,
    MAX_LANE_HEIGHT,
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
    RenderSwimlaneSegment,
    RenderSwimlaneSeries,
    SizedSwimlaneSeries,
    SEGMENT_CROP_TAPER_RATIO,
    SwimlaneObservation,
    RawSwimlaneSegment,
} from "./SwimlaneChartConstants"

/** A lane's runs of one category, and its gaps, that the timeline window shows */
export function toRawSwimlaneSegments({
    observations,
    timesAsc,
    visibleTimesAsc,
}: {
    observations: SwimlaneObservation[]
    timesAsc: Time[]
    visibleTimesAsc: Time[]
}): RawSwimlaneSegment[] {
    const firstVisibleTime = R.first(visibleTimesAsc)
    const lastVisibleTime = R.last(visibleTimesAsc)
    if (firstVisibleTime === undefined || lastVisibleTime === undefined)
        return []

    return findCategoryRuns({ observations, timesAsc })
        .filter(
            (run) =>
                run.endTime >= firstVisibleTime &&
                run.startTime <= lastVisibleTime
        )
        .map(({ category, startTime, endTime }): RawSwimlaneSegment => {
            const range = {
                startTime,
                endTime,
                // A run covers consecutive times, so clamping to the window lands on one of its own times
                visibleStartTime: Math.max(startTime, firstVisibleTime),
                visibleEndTime: Math.min(endTime, lastVisibleTime),
            }
            return category === undefined
                ? { kind: "missing", ...range }
                : { kind: "category", category, ...range }
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
    visiblePeriodsEndTime,
}: {
    series: SizedSwimlaneSeries[]
    bounds: Bounds
    placeTime: (time: Time) => number
    visiblePeriodsEndTime: Time
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

    return allSeries.map(
        ({ segments, ...series }, index): PlacedSwimlaneSeries => {
            const y = blockTop + (index + 0.5) * slotHeight

            const extents = toContiguousSegmentExtents({
                segments,
                placeTime,
                visiblePeriodsEndTime,
            })
            const placedSegments: PlacedSwimlaneSegment[] = segments.map(
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
        }
    )
}

export function toRenderSwimlaneSegments({
    segments,
    hoveredSegment,
    hoveredLegendBin,
    focus,
}: {
    segments: PlacedSwimlaneSegment[]
    hoveredSegment?: PlacedSwimlaneSegment
    hoveredLegendBin?: CategoricalBin
    focus?: InteractionState
}): RenderSwimlaneSegment[] {
    const isHoverModeActive =
        hoveredSegment !== undefined || hoveredLegendBin !== undefined

    return segments.map((segment) => {
        const isInHoveredBin =
            hoveredLegendBin !== undefined &&
            (segment.kind === "missing"
                ? isNoDataBin(hoveredLegendBin)
                : hoveredLegendBin.contains(segment.category))
        const isHovered = segment === hoveredSegment || isInHoveredBin

        return {
            ...segment,
            emphasis: resolveEmphasis({
                hover: new InteractionState(isHovered, isHoverModeActive),
                focus,
            }),
        }
    })
}

export function toRenderSwimlaneSeries({
    series: allSeries,
    hoveredPoint,
    focusArray,
    hoveredLegendBin,
}: {
    series: PlacedSwimlaneSeries[]
    hoveredPoint?: HoveredSwimlanePoint
    focusArray: FocusArray
    hoveredLegendBin?: CategoricalBin
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
                hoveredLegendBin,
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
    visiblePeriodsEndTime,
}: {
    segments: RawSwimlaneSegment[]
    placeTime: (time: Time) => number
    visiblePeriodsEndTime: Time
}): { x: number; width: number }[] {
    return segments.map((segment, index) => {
        const nextSegment = segments[index + 1]
        const x = placeTime(segment.visibleStartTime)
        const right = placeTime(
            nextSegment?.visibleStartTime ?? visiblePeriodsEndTime
        )
        return { x, width: right - x }
    })
}

interface CategoryRun {
    category: string | undefined
    startTime: Time
    endTime: Time
}

/** Consecutive times with the same category, where an undefined category is a gap */
function findCategoryRuns({
    observations,
    timesAsc,
}: {
    observations: SwimlaneObservation[]
    timesAsc: Time[]
}): CategoryRun[] {
    const lastIndex = timesAsc.length - 1
    const categoryByTime = new Map(
        observations.map(({ time, category }) => [time, category])
    )
    const categoryByTimeIndex = timesAsc.map((time) => categoryByTime.get(time))

    const runs: CategoryRun[] = []
    let startIndex = 0
    for (let index = 0; index <= lastIndex; index++) {
        const isRunEnd =
            index === lastIndex ||
            categoryByTimeIndex[index + 1] !== categoryByTimeIndex[index]
        if (!isRunEnd) continue

        runs.push({
            category: categoryByTimeIndex[index],
            startTime: timesAsc[startIndex],
            endTime: timesAsc[index],
        })
        startIndex = index + 1
    }
    return runs
}
