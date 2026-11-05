import { describe, expect, it } from "vitest"

import { StackedSeries } from "./StackedConstants"
import { compareStackedSeriesByImportance } from "./StackedUtils"

describe(compareStackedSeriesByImportance, () => {
    const makeSeries = (
        values: number[],
        isAllZeros = false
    ): StackedSeries<number> => ({
        seriesName: "s",
        columnSlug: "var",
        color: "red",
        isAllZeros,
        points: values.map((value, i) => ({
            position: 2000 + i,
            time: 2000 + i,
            value,
            valueOffset: 0,
        })),
    })

    it("ranks all-zero series last, then by last value, maximum and area", () => {
        const allZeros = makeSeries([0, 0], true)
        const higherLast = makeSeries([1, 5])
        const lowerLast = makeSeries([9, 4])
        expect(compareStackedSeriesByImportance(allZeros, lowerLast)).toBe(1)
        expect(compareStackedSeriesByImportance(lowerLast, allZeros)).toBe(-1)
        expect(compareStackedSeriesByImportance(higherLast, lowerLast)).toBe(-1)

        const higherMax = makeSeries([8, 3, 4])
        const lowerMax = makeSeries([2, 3, 4])
        expect(compareStackedSeriesByImportance(lowerMax, higherMax)).toBe(1)

        const largerArea = makeSeries([3, 3, 4])
        const smallerArea = makeSeries([1, 3, 4])
        expect(compareStackedSeriesByImportance(largerArea, smallerArea)).toBe(
            -1
        )
        expect(compareStackedSeriesByImportance(largerArea, largerArea)).toBe(0)
    })
})
