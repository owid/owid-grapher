import { findClosestYear, getStartEndValues, DataValue } from "../Util"

function iteratorFromArray<T>(array: T[]): Iterable<T> {
    return array[Symbol.iterator]()
}

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

        describe("iterator", () => {
            it("returns the correct year", () => {
                const years = iteratorFromArray([2010, 2015, 2017])
                expect(findClosestYear(years, 2015, 0)).toEqual(2015)
            })
            it("returns undefined", () => {
                const years = iteratorFromArray([2010, 2015, 2017])
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
