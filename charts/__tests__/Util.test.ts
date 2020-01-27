import { findClosestYear } from "../Util"

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
