import { SeriesName, Time } from "@ourworldindata/types"
import { computeCenteredLabelYPositions } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import { CategoricalBin, NumericBin } from "../color/ColorScaleBin"
import {
    ROW_SPACING_FACTOR,
    MAX_HEIGHT_PER_SERIES,
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
    SwimlaneObservation,
    RawSwimlaneSegment,
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

    const segments: RawSwimlaneSegment[] = []
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
}: {
    series: SizedSwimlaneSeries[]
    labelX: number
    heightPerSeries: number
    placeSeries: (seriesName: SeriesName) => number
    placeTime: (time: Time) => number
}): PlacedSwimlaneSeries[] {
    const rowHeight = heightPerSeries * (1 - ROW_SPACING_FACTOR)

    return series.map(({ segments, ...sizedSeries }): PlacedSwimlaneSeries => {
        const y = placeSeries(sizedSeries.seriesName)

        const extents = toContiguousSegmentExtents({
            segments,
            placeTime,
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
            label: sizedSeries.label,
        })

        return {
            ...sizedSeries,
            y,
            labelPosition: { x: labelX, yOffset: labelY - y },
            placedSegments,
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
    segments: RawSwimlaneSegment[]
    placeTime: (time: Time) => number
}): { x: number; width: number }[] {
    return segments.map((segment, index) => {
        const nextSegment = segments[index + 1]
        const x = placeTime(segment.startTime)
        const right = placeTime(nextSegment?.startTime ?? segment.endTime + 1)
        return { x, width: right - x }
    })
}
