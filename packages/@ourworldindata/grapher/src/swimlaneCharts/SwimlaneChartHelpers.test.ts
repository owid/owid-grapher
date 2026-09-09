import { describe, expect, it } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import {
    ColoredSwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
} from "./SwimlaneChartConstants"
import { toPlacedSwimlaneSeries } from "./SwimlaneChartHelpers"

const placeTime = (time: Time): number => (time - 2000) * 10

function makeCategorySegment(
    category: string,
    startTime: Time,
    endTime: Time
): ColoredSwimlaneSegment {
    return {
        kind: "category",
        category,
        startTime,
        endTime,
        color: "#000",
    }
}

function makeSizedSeries(
    entityName: string,
    segments: ColoredSwimlaneSegment[]
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

function placeLanes(
    series: SizedSwimlaneSeries[],
    bounds = new Bounds(0, 0, 200, 400)
): PlacedSwimlaneSeries[] {
    return toPlacedSwimlaneSeries({ series, bounds, placeTime })
}

describe("placement", () => {
    it("splits the plot height evenly between many lanes", () => {
        const lanes = placeLanes(
            Array.from({ length: 20 }, (_, index) =>
                makeSizedSeries(`Entity ${index}`, [
                    makeCategorySegment("X", 2000, 2001),
                ])
            )
        )

        expect(lanes[1].y - lanes[0].y).toBeCloseTo(20)
        expect(lanes[0].y).toBeCloseTo(10)
        expect(lanes[19].y).toBeCloseTo(390)
    })
})
