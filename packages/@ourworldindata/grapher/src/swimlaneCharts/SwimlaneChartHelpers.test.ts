import { describe, expect, it } from "vitest"

import { Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import {
    MAX_HEIGHT_PER_SERIES,
    SwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
} from "./SwimlaneChartConstants"
import {
    computeHeightPerSeries,
    toPlacedSwimlaneSeries,
} from "./SwimlaneChartHelpers"

const placeTime = (time: Time): number => (time - 2000) * 10

function makeCategorySegment(
    category: string,
    startTime: Time,
    endTime: Time
): SwimlaneSegment {
    return {
        kind: "category",
        category,
        startTime,
        endTime,
        color: "#000",
    }
}

function makeMissingSegment(startTime: Time, endTime: Time): SwimlaneSegment {
    return { kind: "missing", startTime, endTime }
}

function makeSizedSeries(
    entityName: string,
    segments: SwimlaneSegment[]
): SizedSwimlaneSeries {
    return {
        seriesName: entityName,
        entityName,
        color: "#000",
        segments,
        label: new SeriesLabelState({
            text: entityName,
            maxWidth: 100,
            fontSize: 12,
        }),
    }
}

/** Places the rows one under the other from y = 0, 20px apart by default */
function placeRows(
    series: SizedSwimlaneSeries[],
    { heightPerSeries = 20 }: { heightPerSeries?: number } = {}
): PlacedSwimlaneSeries[] {
    const seriesNames = series.map((s) => s.seriesName)
    return toPlacedSwimlaneSeries({
        series,
        labelX: 0,
        heightPerSeries,
        placeSeries: (seriesName) =>
            (seriesNames.indexOf(seriesName) + 0.5) * heightPerSeries,
        placeTime,
    })
}

describe("placement", () => {
    it("extends each segment to where the next one starts, and the last one a step past its end", () => {
        const [row] = placeRows([
            makeSizedSeries("France", [
                makeCategorySegment("X", 2000, 2001),
                makeMissingSegment(2002, 2003),
                makeCategorySegment("Y", 2004, 2004),
            ]),
        ])

        expect(
            row.placedSegments.map(({ x, width }) => ({ x, width }))
        ).toEqual([
            { x: 0, width: 20 },
            { x: 20, width: 20 },
            { x: 40, width: 10 },
        ])
    })

    it("draws each bar centred in its series, with the row spacing split above and below", () => {
        const [row] = placeRows(
            [makeSizedSeries("France", [makeCategorySegment("X", 2000, 2001)])],
            { heightPerSeries: MAX_HEIGHT_PER_SERIES }
        )

        expect(row.placedSegments[0].height).toBeCloseTo(54)
        expect(row.placedSegments[0].y).toBeCloseTo(-27)
    })
})

describe(computeHeightPerSeries, () => {
    it("caps a lone series at the height whose bar is the maximum row height", () => {
        expect(
            computeHeightPerSeries({ height: 400, rowCount: 1 })
        ).toBeCloseTo(MAX_HEIGHT_PER_SERIES)
    })

    it("splits the height evenly between many series", () => {
        expect(computeHeightPerSeries({ height: 400, rowCount: 20 })).toBe(20)
    })
})
