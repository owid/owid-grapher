import * as R from "remeda"
import { SeriesName, Time } from "@ourworldindata/types"
import { CoreColumn } from "@ourworldindata/core-table"
import { computeCenteredLabelYPositions } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import { ColorScale } from "../color/ColorScale"
import { OWID_ERROR_COLOR } from "../color/ColorConstants"
import { formatTimeSpan, textWidth } from "../chart/ChartUtils"
import { resolveEmphasis } from "../interaction/Emphasis"
import { InteractionState } from "../interaction/InteractionState"
import { FocusArray } from "../focus/FocusArray"
import { CategoricalBin, NumericBin } from "../color/ColorScaleBin"
import {
    ROW_SPACING_FACTOR,
    MAX_HEIGHT_PER_SERIES,
    PlacedSwimlaneCategorySegment,
    PlacedSwimlaneSegment,
    PlacedSwimlaneSegmentLabel,
    PlacedSwimlaneSeries,
    RawSwimlaneSegment,
    RenderSwimlaneSegment,
    RenderSwimlaneSeries,
    SizedSwimlaneSeries,
    SEGMENT_CROP_TAPER_RATIO,
    SEGMENT_LABEL_PADDING,
    SwimlaneObservation,
    SwimlaneSegment,
    SwimlaneSegmentLabelStyle,
    SwimlaneTooltipTarget,
} from "./SwimlaneChartConstants"

export function toRawSwimlaneSegments({
    observations,
    timesAsc,
}: {
    observations: SwimlaneObservation[]
    timesAsc: Time[]
}): RawSwimlaneSegment[] {
    if (timesAsc.length === 0) return []

    const lastIndex = timesAsc.length - 1
    const categoryByTime = new Map(
        observations.map(({ time, category }) => [time, category])
    )
    const categoryByTimeIndex = timesAsc.map((time) => categoryByTime.get(time))

    const rawSegments: RawSwimlaneSegment[] = []
    let startIndex = 0
    for (let index = 0; index <= lastIndex; index++) {
        const isSegmentEnd =
            index === lastIndex ||
            categoryByTimeIndex[index + 1] !== categoryByTimeIndex[index]
        if (!isSegmentEnd) continue

        const range = {
            startTime: timesAsc[startIndex],
            endTime: timesAsc[index],
        }
        const category = categoryByTimeIndex[index]
        rawSegments.push(
            category === undefined
                ? { kind: "missing", ...range }
                : { kind: "category", category, ...range }
        )
        startIndex = index + 1
    }
    return rawSegments
}

export function toSwimlaneSegments({
    rawSegments,
    visibleTimesAsc,
    colorScale,
    timeColumn,
}: {
    rawSegments: RawSwimlaneSegment[]
    visibleTimesAsc: Time[]
    colorScale: ColorScale
    timeColumn: CoreColumn
}): SwimlaneSegment[] {
    const firstVisibleTime = R.first(visibleTimesAsc)
    const lastVisibleTime = R.last(visibleTimesAsc)
    if (firstVisibleTime === undefined || lastVisibleTime === undefined)
        return []

    return rawSegments
        .filter(
            (rawSegment) =>
                rawSegment.endTime >= firstVisibleTime &&
                rawSegment.startTime <= lastVisibleTime
        )
        .map((rawSegment): SwimlaneSegment => {
            const common = {
                visibleStartTime: Math.max(
                    rawSegment.startTime,
                    firstVisibleTime
                ),
                visibleEndTime: Math.min(rawSegment.endTime, lastVisibleTime),
                timeRangeLabel: formatSegmentTimeRange({
                    startTime: rawSegment.startTime,
                    endTime: rawSegment.endTime,
                    timeColumn,
                }),
            }
            if (rawSegment.kind === "missing")
                return { ...rawSegment, ...common }
            const bin = colorScale.getBinForValue(rawSegment.category)
            return {
                ...rawSegment,
                ...common,
                categoryLabel: bin?.text ?? rawSegment.category,
                color: bin?.color ?? OWID_ERROR_COLOR,
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
    timeColumn: CoreColumn
}): string {
    if (startTime === endTime) return timeColumn.formatTime(startTime)
    return timeColumn.formatTimeRange(startTime, endTime)
}

/** How long a segment's whole run lasts, e.g. "2 years" */
export function formatSegmentDuration({
    segment,
    timeColumn,
}: {
    segment: SwimlaneSegment
    timeColumn: CoreColumn
}): string | undefined {
    const duration = segment.endTime - segment.startTime
    if (duration === 0) return undefined
    return formatTimeSpan(duration, timeColumn.timeInterval)
}

export function computeHeightPerSeries({
    height,
    rowCount,
}: {
    height: number
    rowCount: number
}): number {
    return Math.min(height / rowCount, MAX_HEIGHT_PER_SERIES)
}

export function toPlacedSwimlaneSeries({
    series,
    labelX,
    heightPerSeries,
    placeSeries,
    placeTime,
    shouldShowSegmentLabels,
    segmentLabelStyle,
}: {
    series: SizedSwimlaneSeries[]
    labelX: number
    heightPerSeries: number
    placeSeries: (seriesName: SeriesName) => number
    placeTime: (time: Time) => number
    shouldShowSegmentLabels: boolean
    segmentLabelStyle: SwimlaneSegmentLabelStyle
}): PlacedSwimlaneSeries[] {
    const rowHeight = heightPerSeries * (1 - ROW_SPACING_FACTOR)

    return series.map(({ segments, ...sizedSeries }): PlacedSwimlaneSeries => {
        const y = placeSeries(sizedSeries.seriesName)

        const extents = toContiguousSegmentExtents({
            segments,
            placeTime,
        })
        const placedSegments = segments.map((segment, segmentIndex) =>
            toPlacedSwimlaneSegment({
                segment,
                ...extents[segmentIndex],
                y: -rowHeight / 2,
                height: rowHeight,
                shouldShowLabel: shouldShowSegmentLabels,
                labelStyle: segmentLabelStyle,
            })
        )

        const { labelY } = computeCenteredLabelYPositions({
            y,
            label: sizedSeries.label,
        })

        return {
            ...sizedSeries,
            y,
            height: heightPerSeries,
            labelPosition: { x: labelX, yOffset: labelY - y },
            placedSegments,
        }
    })
}

function toRenderSwimlaneSegments({
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
}: {
    segments: SwimlaneSegment[]
    placeTime: (time: Time) => number
}): { x: number; width: number }[] {
    return segments.map((segment, index) => {
        const nextSegment = segments[index + 1]
        const x = placeTime(segment.visibleStartTime)
        const right = placeTime(
            nextSegment?.visibleStartTime ?? segment.visibleEndTime + 1
        )
        return { x, width: right - x }
    })
}

function toPlacedSwimlaneSegment({
    segment,
    x,
    width,
    y,
    height,
    shouldShowLabel,
    labelStyle,
}: {
    segment: SwimlaneSegment
    x: number
    width: number
    y: number
    height: number
    shouldShowLabel: boolean
    labelStyle: SwimlaneSegmentLabelStyle
}): PlacedSwimlaneSegment {
    const placement = { x, width, y, height }
    if (segment.kind === "missing") return { ...segment, ...placement }

    const placedSegment = {
        ...segment,
        ...placement,
        isStartCropped: segment.startTime < segment.visibleStartTime,
        isEndCropped: segment.endTime > segment.visibleEndTime,
        cropTaper: Math.min(SEGMENT_CROP_TAPER_RATIO * height, width / 3),
    }
    return {
        ...placedSegment,
        label: shouldShowLabel
            ? placeSegmentLabel(placedSegment, labelStyle)
            : undefined,
    }
}

/** Position of a category segment's two-line label, or undefined if it doesn't fit */
function placeSegmentLabel(
    segment: PlacedSwimlaneCategorySegment,
    style: SwimlaneSegmentLabelStyle
): PlacedSwimlaneSegmentLabel | undefined {
    const lineHeight = style.category.fontSize * style.category.lineHeight
    if (segment.height < 2 * lineHeight) return undefined

    const startInset = segment.isStartCropped ? segment.cropTaper : 0
    const endInset = segment.isEndCropped ? segment.cropTaper : 0
    const availableWidth =
        segment.width - startInset - endInset - 2 * SEGMENT_LABEL_PADDING
    const widestLine = Math.max(
        textWidth(segment.categoryLabel, style.category),
        textWidth(segment.timeRangeLabel, style.timeRange)
    )
    if (availableWidth < widestLine) return undefined

    return {
        x: segment.x + startInset + SEGMENT_LABEL_PADDING,
        y: segment.y + segment.height / 2 - lineHeight / 2,
        style,
    }
}
