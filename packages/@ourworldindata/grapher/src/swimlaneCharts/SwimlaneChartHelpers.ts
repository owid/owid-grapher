import { Bounds, roundForSvg } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { computeCenteredLabelYPositions } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import { resolveEmphasis } from "../interaction/Emphasis"
import { InteractionState } from "../interaction/InteractionState"
import { FocusArray } from "../focus/FocusArray"
import { CategoricalBin, NumericBin } from "../color/ColorScaleBin"
import { ColorScale } from "../color/ColorScale"
import { OWID_ERROR_COLOR } from "../color/ColorConstants"
import {
    ENTITY_LABEL_CHART_GAP,
    ROW_SPACING_FACTOR,
    MAX_ROW_HEIGHT,
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
    RenderSwimlaneSegment,
    RenderSwimlaneSeries,
    SizedSwimlaneSeries,
    SEGMENT_CROP_TAPER_RATIO,
    SwimlaneObservation,
    SwimlaneSegment,
    SwimlaneTooltipTarget,
    SwimlaneVisibleTimeRange,
    TimeColumnFormatter,
} from "./SwimlaneChartConstants"

export function toSwimlaneSegments({
    observations,
    consecutiveTimes,
    visibleTimeRange,
    colorScale,
}: {
    observations: SwimlaneObservation[]
    consecutiveTimes: Time[]
    visibleTimeRange: SwimlaneVisibleTimeRange
    colorScale: ColorScale
}): SwimlaneSegment[] {
    const { startTime: firstVisibleTime, endTime: lastVisibleTime } =
        visibleTimeRange

    return findCategoryRuns({ observations, consecutiveTimes })
        .filter(
            (run) =>
                run.endTime >= firstVisibleTime &&
                run.startTime <= lastVisibleTime
        )
        .map(({ category, startTime, endTime }): SwimlaneSegment => {
            const common = {
                startTime,
                endTime,
                visibleStartTime: Math.max(startTime, firstVisibleTime),
                visibleEndTime: Math.min(endTime, lastVisibleTime),
            }
            if (category === undefined) return { kind: "missing", ...common }
            return {
                kind: "category",
                ...common,
                category,
                categoryLabel:
                    colorScale.getBinForValue(category)?.text ?? category,
                color: colorScale.getColor(category) ?? OWID_ERROR_COLOR,
            }
        })
}

export function formatSegmentTimeRange({
    startTime,
    endTime,
    timeColumn,
}: {
    startTime: Time
    endTime: Time
    timeColumn: TimeColumnFormatter
}): string {
    if (startTime === endTime) return timeColumn.formatTime(startTime)
    return `${timeColumn.formatTimeShort(startTime)}–${timeColumn.formatTimeShortEnd(endTime)}`
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

export function computeRowSlotHeight({
    height,
    rowCount,
}: {
    height: number
    rowCount: number
}): number {
    return Math.min(
        height / rowCount,
        MAX_ROW_HEIGHT / (1 - ROW_SPACING_FACTOR)
    )
}

export function toPlacedSwimlaneSeries({
    series: allSeries,
    bounds,
    placeTime,
    visibleExclusiveEndTime,
}: {
    series: SizedSwimlaneSeries[]
    bounds: Bounds
    placeTime: (time: Time) => number
    visibleExclusiveEndTime: Time
}): PlacedSwimlaneSeries[] {
    if (allSeries.length === 0) return []

    const slotHeight = computeRowSlotHeight({
        height: bounds.height,
        rowCount: allSeries.length,
    })
    const rowHeight = slotHeight * (1 - ROW_SPACING_FACTOR)
    const labelX = bounds.left - ENTITY_LABEL_CHART_GAP
    const blockTop =
        bounds.top + (bounds.height - slotHeight * allSeries.length) / 2

    return allSeries.map(
        ({ segments, ...series }, index): PlacedSwimlaneSeries => {
            const y = blockTop + (index + 0.5) * slotHeight

            const extents = toContiguousSegmentExtents({
                segments,
                placeTime,
                visibleExclusiveEndTime,
            })
            const placedSegments: PlacedSwimlaneSegment[] = segments.map(
                (segment, segmentIndex): PlacedSwimlaneSegment => ({
                    ...segment,
                    ...extents[segmentIndex],
                    y: -rowHeight / 2,
                    height: rowHeight,
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
    hoveredStartTime,
    hoveredLegendBin,
    isHoverModeActive,
    focus,
}: {
    segments: PlacedSwimlaneSegment[]
    hoveredStartTime?: Time
    hoveredLegendBin?: CategoricalBin
    isHoverModeActive: boolean
    focus?: InteractionState
}): RenderSwimlaneSegment[] {
    return segments.map((segment) => {
        const category =
            segment.kind === "category" ? segment.category : undefined
        const isHovered =
            segment.startTime === hoveredStartTime ||
            !!hoveredLegendBin?.contains(category)

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
    hoveredSegment,
    focusArray,
    hoveredLegendBin,
}: {
    series: PlacedSwimlaneSeries[]
    hoveredSegment?: SwimlaneTooltipTarget
    focusArray: FocusArray
    hoveredLegendBin?: CategoricalBin
}): RenderSwimlaneSeries[] {
    const isHoverModeActive =
        hoveredSegment !== undefined || hoveredLegendBin !== undefined

    return allSeries.map((series): RenderSwimlaneSeries => {
        const focus = focusArray.state(series.seriesName)
        const hoveredStartTime =
            hoveredSegment?.entityName === series.entityName
                ? hoveredSegment.segment.startTime
                : undefined
        return {
            ...series,
            emphasis: resolveEmphasis({ focus }),
            placedSegments: toRenderSwimlaneSegments({
                segments: series.placedSegments,
                hoveredStartTime,
                hoveredLegendBin,
                isHoverModeActive,
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

export function findRowAtY(
    series: PlacedSwimlaneSeries[],
    y: number
): PlacedSwimlaneSeries | undefined {
    return series.find(
        ({ y: rowY, slotHeight }) =>
            y >= rowY - slotHeight / 2 && y < rowY + slotHeight / 2
    )
}

/** A category as one step of the ordinal legend's numeric strip */
export function toLabelledNumericBin(
    bin: CategoricalBin,
    index: number
): NumericBin {
    return new NumericBin({
        isFirst: index === 0,
        isOpenLeft: false,
        isOpenRight: false,
        min: index,
        max: index + 1,
        displayMin: "",
        displayMax: "",
        label: bin.text,
        color: bin.color,
    })
}

function toContiguousSegmentExtents({
    segments,
    placeTime,
    visibleExclusiveEndTime,
}: {
    segments: SwimlaneSegment[]
    placeTime: (time: Time) => number
    visibleExclusiveEndTime: Time
}): { x: number; width: number }[] {
    return segments.map((segment, index) => {
        const nextSegment = segments[index + 1]
        const x = placeTime(segment.visibleStartTime)
        const right = placeTime(
            nextSegment?.visibleStartTime ?? visibleExclusiveEndTime
        )
        return { x, width: right - x }
    })
}

interface CategoryRun {
    category?: string
    startTime: Time
    endTime: Time
}

/** Consecutive times with the same category, where an undefined category is a gap */
function findCategoryRuns({
    observations,
    consecutiveTimes,
}: {
    observations: SwimlaneObservation[]
    consecutiveTimes: Time[]
}): CategoryRun[] {
    const lastIndex = consecutiveTimes.length - 1
    const categoryByTime = new Map(
        observations.map(({ time, category }) => [time, category])
    )
    const categoryByTimeIndex = consecutiveTimes.map((time) =>
        categoryByTime.get(time)
    )

    const runs: CategoryRun[] = []
    let startIndex = 0
    for (let index = 0; index <= lastIndex; index++) {
        const isRunEnd =
            index === lastIndex ||
            categoryByTimeIndex[index + 1] !== categoryByTimeIndex[index]
        if (!isRunEnd) continue

        runs.push({
            category: categoryByTimeIndex[index],
            startTime: consecutiveTimes[startIndex],
            endTime: consecutiveTimes[index],
        })
        startIndex = index + 1
    }
    return runs
}
