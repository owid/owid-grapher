#! /usr/bin/env yarn jest

import {
    TimeBoundValue,
    minTimeBoundFromJSONOrNegativeInfinity,
    maxTimeBoundFromJSONOrPositiveInfinity,
    minTimeToJSON,
    maxTimeToJSON,
    getTimeDomainFromQueryString,
} from "./TimeBounds"

describe(minTimeBoundFromJSONOrNegativeInfinity, () => {
    it("handles unbounded left", () => {
        expect(minTimeBoundFromJSONOrNegativeInfinity("earliest")).toEqual(
            TimeBoundValue.negativeInfinity
        )
    })
    it("handles unbounded right", () => {
        expect(minTimeBoundFromJSONOrNegativeInfinity("latest")).toEqual(
            TimeBoundValue.positiveInfinity
        )
    })
    it("handles undefined", () => {
        expect(minTimeBoundFromJSONOrNegativeInfinity(undefined)).toEqual(
            TimeBoundValue.negativeInfinity
        )
    })
    it("handles number", () => {
        expect(minTimeBoundFromJSONOrNegativeInfinity(1990)).toEqual(1990)
    })
    it("handles negative number", () => {
        expect(minTimeBoundFromJSONOrNegativeInfinity(-1990)).toEqual(-1990)
    })
    it("handles zero", () => {
        expect(minTimeBoundFromJSONOrNegativeInfinity(0)).toEqual(0)
    })
})

describe(maxTimeBoundFromJSONOrPositiveInfinity, () => {
    it("handles unbounded left", () => {
        expect(maxTimeBoundFromJSONOrPositiveInfinity("earliest")).toEqual(
            TimeBoundValue.negativeInfinity
        )
    })
    it("handles unbounded right", () => {
        expect(maxTimeBoundFromJSONOrPositiveInfinity("latest")).toEqual(
            TimeBoundValue.positiveInfinity
        )
    })
    it("handles undefined", () => {
        expect(maxTimeBoundFromJSONOrPositiveInfinity(undefined)).toEqual(
            TimeBoundValue.positiveInfinity
        )
    })
    it("handles number", () => {
        expect(maxTimeBoundFromJSONOrPositiveInfinity(1990)).toEqual(1990)
    })
    it("handles negative number", () => {
        expect(maxTimeBoundFromJSONOrPositiveInfinity(-1990)).toEqual(-1990)
    })
    it("handles zero", () => {
        expect(maxTimeBoundFromJSONOrPositiveInfinity(0)).toEqual(0)
    })
})

describe(minTimeToJSON, () => {
    it("handles unbounded left", () => {
        expect(minTimeToJSON(TimeBoundValue.negativeInfinity)).toEqual(
            "earliest"
        )
    })
    it("handles unbounded right", () => {
        expect(minTimeToJSON(TimeBoundValue.positiveInfinity)).toEqual("latest")
    })
    it("handles undefined", () => {
        expect(minTimeToJSON(undefined)).toEqual(undefined)
    })
    it("handles number", () => {
        expect(minTimeToJSON(1990)).toEqual(1990)
    })
    it("handles negative number", () => {
        expect(minTimeToJSON(-1990)).toEqual(-1990)
    })
    it("handles zero", () => {
        expect(minTimeToJSON(0)).toEqual(0)
    })
})

describe(maxTimeToJSON, () => {
    it("handles unbounded left", () => {
        expect(maxTimeToJSON(TimeBoundValue.negativeInfinity)).toEqual(
            "earliest"
        )
    })
    it("handles unbounded right", () => {
        expect(maxTimeToJSON(TimeBoundValue.positiveInfinity)).toEqual("latest")
    })
    it("handles undefined", () => {
        expect(maxTimeToJSON(undefined)).toEqual(undefined)
    })
    it("handles number", () => {
        expect(maxTimeToJSON(1990)).toEqual(1990)
    })
    it("handles negative number", () => {
        expect(maxTimeToJSON(-1990)).toEqual(-1990)
    })
    it("handles zero", () => {
        expect(maxTimeToJSON(0)).toEqual(0)
    })
})

describe(getTimeDomainFromQueryString, () => {
    it("can handle both unbounded", () => {
        expect(getTimeDomainFromQueryString("..")).toEqual([
            -Infinity,
            Infinity,
        ])
    })
})
