#! /usr/bin/env yarn jest

import {
    TimeBoundValue,
    minTimeFromJSON,
    maxTimeFromJSON,
    minTimeToJSON,
    maxTimeToJSON
} from "charts/utils/TimeBounds"

describe(minTimeFromJSON, () => {
    it("handles unbounded left", () => {
        expect(minTimeFromJSON("earliest")).toEqual(
            TimeBoundValue.unboundedLeft
        )
    })
    it("handles unbounded right", () => {
        expect(minTimeFromJSON("latest")).toEqual(TimeBoundValue.unboundedRight)
    })
    it("handles undefined", () => {
        expect(minTimeFromJSON(undefined)).toEqual(TimeBoundValue.unboundedLeft)
    })
    it("handles number", () => {
        expect(minTimeFromJSON(1990)).toEqual(1990)
    })
    it("handles negative number", () => {
        expect(minTimeFromJSON(-1990)).toEqual(-1990)
    })
    it("handles zero", () => {
        expect(minTimeFromJSON(0)).toEqual(0)
    })
})

describe(maxTimeFromJSON, () => {
    it("handles unbounded left", () => {
        expect(maxTimeFromJSON("earliest")).toEqual(
            TimeBoundValue.unboundedLeft
        )
    })
    it("handles unbounded right", () => {
        expect(maxTimeFromJSON("latest")).toEqual(TimeBoundValue.unboundedRight)
    })
    it("handles undefined", () => {
        expect(maxTimeFromJSON(undefined)).toEqual(
            TimeBoundValue.unboundedRight
        )
    })
    it("handles number", () => {
        expect(maxTimeFromJSON(1990)).toEqual(1990)
    })
    it("handles negative number", () => {
        expect(maxTimeFromJSON(-1990)).toEqual(-1990)
    })
    it("handles zero", () => {
        expect(maxTimeFromJSON(0)).toEqual(0)
    })
})

describe(minTimeToJSON, () => {
    it("handles unbounded left", () => {
        expect(minTimeToJSON(TimeBoundValue.unboundedLeft)).toEqual("earliest")
    })
    it("handles unbounded right", () => {
        expect(minTimeToJSON(TimeBoundValue.unboundedRight)).toEqual("latest")
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
        expect(maxTimeToJSON(TimeBoundValue.unboundedLeft)).toEqual("earliest")
    })
    it("handles unbounded right", () => {
        expect(maxTimeToJSON(TimeBoundValue.unboundedRight)).toEqual("latest")
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
