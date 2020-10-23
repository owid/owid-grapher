#! /usr/bin/env yarn jest

import { imemo, interpolateRowValuesWithTolerance } from "./CoreTableUtils"
import { InvalidCellTypes } from "./InvalidCells"

describe(interpolateRowValuesWithTolerance, () => {
    it("handles empty array", () => {
        expect(
            interpolateRowValuesWithTolerance([], "value", "time", 2)
        ).toEqual([])
    })
    it("leaves array unchanged if tolerance = 0", () => {
        const result = interpolateRowValuesWithTolerance(
            [
                { value: 1, time: 0 },
                { value: undefined, time: 1 },
                { value: undefined, time: 2 },
                { value: 3, time: 3 },
            ],
            "value",
            "time",
            0
        )
        expect(result[1].value).toEqual(InvalidCellTypes.NoValueWithinTolerance)
        expect(result[2].value).toEqual(InvalidCellTypes.NoValueWithinTolerance)
    })
    it("fills in gaps in simple case", () => {
        const result = interpolateRowValuesWithTolerance(
            [
                { value: 1, time: 0 },
                { value: undefined, time: 1 },
                { value: undefined, time: 2 },
                { value: 3, time: 3 },
            ],
            "value",
            "time",
            2
        )
        expect(result.map((r) => r.value)).toEqual([1, 1, 3, 3])
        expect(result.map((r) => r.time)).toEqual([0, 0, 3, 3])
    })
    it("fills in initial and trailing values", () => {
        const result = interpolateRowValuesWithTolerance(
            [
                { value: undefined, time: 0 },
                { value: InvalidCellTypes.NaNButShouldBeNumber, time: 1 },
                { value: 1, time: 2 },
                { value: InvalidCellTypes.UndefinedButShouldBeNumber, time: 3 },
                { value: undefined, time: 4 },
                { value: undefined, time: 5 },
                { value: 3, time: 6 },
                { value: undefined, time: 7 },
            ],
            "value",
            "time",
            1
        )
        expect(result.map((r) => r.value)).toEqual([
            InvalidCellTypes.NoValueWithinTolerance,
            1,
            1,
            1,
            InvalidCellTypes.NoValueWithinTolerance,
            3,
            3,
            3,
        ])
        expect(result.map((r) => r.time)).toEqual([0, 2, 2, 2, 4, 6, 6, 6])
    })
})

describe("immutable memoization", () => {
    class WeatherForecast {
        conditions = "rainy"

        @imemo get forecast() {
            return this.conditions
        }
    }

    it("runs getters once", () => {
        const forecast = new WeatherForecast()
        expect(forecast.forecast).toEqual("rainy")

        forecast.conditions = "sunny"
        expect(forecast.forecast).toEqual("rainy")

        const forecast2 = new WeatherForecast()
        forecast2.conditions = "sunny"
        expect(forecast2.forecast).toEqual("sunny")
    })
})
