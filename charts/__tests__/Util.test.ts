#! /usr/bin/env yarn jest

import * as timezoneMock from "timezone-mock"

import {
    findClosestYear,
    getStartEndValues,
    DataValue,
    formatDay,
    retryPromise
} from "../Util"

describe(findClosestYear, () => {
    describe("without tolerance", () => {
        describe("array", () => {
            it("returns the correct year", () => {
                const years = [2010, 2015, 2017]
                expect(findClosestYear(years, 2015, 0)).toEqual(2015)
            })
            it("returns undefined", () => {
                const years = [2010, 2015, 2017]
                expect(findClosestYear(years, 2014, 0)).toEqual(undefined)
            })
        })
    })

    describe("specified tolerance", () => {
        it("returns the closest year within the specified tolerance", () => {
            const years = [2010, 2015, 2017]
            expect(findClosestYear(years, 2013, 2)).toEqual(2015)
        })
        it("returns undefined outside the tolerance", () => {
            const years = [2010, 2017]
            expect(findClosestYear(years, 2014, 1)).toEqual(undefined)
        })
        it("prefers later years", () => {
            const years = [2010, 2012, 2013, 2017]
            expect(findClosestYear(years, 2011, 3)).toEqual(2012)
            expect(findClosestYear(years, 2015, 3)).toEqual(2017)
        })
    })

    describe("unspecified tolerance", () => {
        it("returns the closest year", () => {
            const years = [1990, 2016]
            expect(findClosestYear(years, 2013)).toEqual(2016)
            expect(findClosestYear(years, 2002)).toEqual(1990)
        })
    })
})

describe(getStartEndValues, () => {
    it("handles an empty array", () => {
        const extent = getStartEndValues([]) as DataValue[]
        expect(extent[0]).toEqual(undefined)
        expect(extent[1]).toEqual(undefined)
    })
    it("handles a single element array", () => {
        const extent = getStartEndValues([
            { year: 2016, value: 1 }
        ]) as DataValue[]
        expect(extent[0].year).toEqual(2016)
        expect(extent[1].year).toEqual(2016)
    })
    it("handles a multi-element array", () => {
        const extent = getStartEndValues([
            { year: 2016, value: -20 },
            { year: 2014, value: 5 },
            { year: 2017, value: 7 }
        ]) as DataValue[]
        expect(extent[0].year).toEqual(2014)
        expect(extent[1].year).toEqual(2017)
    })
})

describe(formatDay, () => {
    describe("timezones", () => {
        it("formats date consistently in GMT", () => {
            timezoneMock.register("Europe/London")
            expect(formatDay(0)).toEqual("Jan 21, 2020")
            timezoneMock.unregister()
        })

        it("formats date consistently in US/Pacific", () => {
            timezoneMock.register("US/Pacific")
            expect(formatDay(0)).toEqual("Jan 21, 2020")
            timezoneMock.unregister()
        })

        it("formats date consistently in US/Pacific", () => {
            timezoneMock.register("Australia/Adelaide")
            expect(formatDay(0)).toEqual("Jan 21, 2020")
            timezoneMock.unregister()
        })
    })

    describe("epoch", () => {
        it("starts on Jan 21, 2020", () => {
            expect(formatDay(0)).toEqual("Jan 21, 2020")
        })

        it("handles increments", () => {
            expect(formatDay(11)).toEqual("Feb 1, 2020")
        })

        it("handles decrements", () => {
            expect(formatDay(-21)).toEqual("Dec 31, 2019")
        })
    })
})

describe(retryPromise, () => {
    function resolveAfterNthRetry(nth: number, message: string = "success") {
        let retried = 0
        return () =>
            new Promise((resolve, reject) =>
                retried++ >= nth ? resolve(message) : reject()
            )
    }

    it("resolves when promise succeeds first-time", async () => {
        const promiseGetter = resolveAfterNthRetry(0, "success")
        expect(retryPromise(promiseGetter, 1)).resolves.toEqual("success")
    })

    it("resolves when promise succeeds before retry limit", async () => {
        const promiseGetter = resolveAfterNthRetry(2, "success")
        expect(retryPromise(promiseGetter, 3)).resolves.toEqual("success")
    })

    it("rejects when promise doesn't succeed within retry limit", async () => {
        const promiseGetter = resolveAfterNthRetry(3, "success")
        expect(retryPromise(promiseGetter, 3)).rejects.toBeUndefined()
    })
})
