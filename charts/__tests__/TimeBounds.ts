#! /usr/bin/env yarn jest

import {
    TimeBoundValue,
    selectedTimelineStartYearFromJSON,
    selectedTimelineEndYearFromJSON,
    minTimeToJSON,
    maxTimeToJSON
} from "charts/TimeBounds"

describe(selectedTimelineStartYearFromJSON, () => {
    it("handles unbounded left", () => {
        expect(selectedTimelineStartYearFromJSON("earliest")).toEqual(
            TimeBoundValue.unboundedLeft
        )
    })
    it("handles unbounded right", () => {
        expect(selectedTimelineStartYearFromJSON("latest")).toEqual(
            TimeBoundValue.unboundedRight
        )
    })
    it("handles undefined", () => {
        expect(selectedTimelineStartYearFromJSON(undefined)).toEqual(
            TimeBoundValue.unboundedLeft
        )
    })
    it("handles number", () => {
        expect(selectedTimelineStartYearFromJSON(1990)).toEqual(1990)
    })
    it("handles negative number", () => {
        expect(selectedTimelineStartYearFromJSON(-1990)).toEqual(-1990)
    })
    it("handles zero", () => {
        expect(selectedTimelineStartYearFromJSON(0)).toEqual(0)
    })
})

describe(selectedTimelineEndYearFromJSON, () => {
    it("handles unbounded left", () => {
        expect(selectedTimelineEndYearFromJSON("earliest")).toEqual(
            TimeBoundValue.unboundedLeft
        )
    })
    it("handles unbounded right", () => {
        expect(selectedTimelineEndYearFromJSON("latest")).toEqual(
            TimeBoundValue.unboundedRight
        )
    })
    it("handles undefined", () => {
        expect(selectedTimelineEndYearFromJSON(undefined)).toEqual(
            TimeBoundValue.unboundedRight
        )
    })
    it("handles number", () => {
        expect(selectedTimelineEndYearFromJSON(1990)).toEqual(1990)
    })
    it("handles negative number", () => {
        expect(selectedTimelineEndYearFromJSON(-1990)).toEqual(-1990)
    })
    it("handles zero", () => {
        expect(selectedTimelineEndYearFromJSON(0)).toEqual(0)
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
