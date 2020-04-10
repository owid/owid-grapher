#! /usr/bin/env yarn jest

import { ChartConfigProps } from "charts/ChartConfig"
import { Time, TimeBoundValue, TimeBound } from "charts/TimeBounds"
import { createConfig } from "test/utils"

import { ChartUrl, ChartQueryParams } from "../ChartUrl"
import { MapConfigProps } from "charts/MapConfig"

type TimeDomain = [Time, Time]

function fromQueryParams(
    params: ChartQueryParams,
    props?: Partial<ChartConfigProps>
) {
    const chart = createConfig(props)
    chart.url.populateFromQueryParams(params)
    return chart
}

function toQueryParams(props?: Partial<ChartConfigProps>) {
    const chart = createConfig({
        minTime: -5000,
        maxTime: 5000,
        map: new MapConfigProps({ targetYear: 5000 })
    })
    chart.update(props)
    return chart.url.params
}

describe(ChartUrl, () => {
    describe("time parameter", () => {
        const tests: {
            name: string
            query: string
            param: TimeDomain
        }[] = [
            { name: "single year", query: "1500", param: [1500, 1500] },
            {
                name: "single year negative",
                query: "-1500",
                param: [-1500, -1500]
            },
            { name: "single year zero", query: "0", param: [0, 0] },
            {
                name: "single year latest",
                query: "latest",
                param: [
                    TimeBoundValue.unboundedRight,
                    TimeBoundValue.unboundedRight
                ]
            },
            {
                name: "single year earliest",
                query: "earliest",
                param: [
                    TimeBoundValue.unboundedLeft,
                    TimeBoundValue.unboundedLeft
                ]
            },
            { name: "two years", query: "2000..2005", param: [2000, 2005] },
            {
                name: "right unbounded",
                query: "2000..",
                param: [2000, TimeBoundValue.unboundedRight]
            },
            {
                name: "left unbounded",
                query: "..2005",
                param: [TimeBoundValue.unboundedLeft, 2005]
            },
            {
                name: "unbounded (both)",
                query: "..",
                param: [
                    TimeBoundValue.unboundedLeft,
                    TimeBoundValue.unboundedRight
                ]
            },
            {
                name: "negative years",
                query: "-500..-1",
                param: [-500, -1]
            }
        ]

        for (const test of tests) {
            it(`parse ${test.name}`, () => {
                const chart = fromQueryParams({ time: test.query })
                const [start, end] = chart.timeDomain
                expect(start).toEqual(test.param[0])
                expect(end).toEqual(test.param[1])
            })
            it(`encode ${test.name}`, () => {
                const params = toQueryParams({
                    minTime: test.param[0],
                    maxTime: test.param[1]
                })
                expect(params.time).toEqual(test.query)
            })
        }

        it("empty string doesn't change time", () => {
            const chart = fromQueryParams(
                { time: "" },
                { minTime: 0, maxTime: 5 }
            )
            const [start, end] = chart.timeDomain
            expect(start).toEqual(0)
            expect(end).toEqual(5)
        })

        it("doesn't include URL param if it's identical to original config", () => {
            const chart = createConfig({
                minTime: 0,
                maxTime: 75
            })
            expect(chart.url.params.time).toEqual(undefined)
        })
    })

    describe("year parameter", () => {
        const tests: {
            name: string
            query: string
            param: TimeBound
        }[] = [
            { name: "single year", query: "1500", param: 1500 },
            {
                name: "single year negative",
                query: "-1500",
                param: -1500
            },
            { name: "single year zero", query: "0", param: 0 },
            {
                name: "single year latest",
                query: "latest",
                param: TimeBoundValue.unboundedRight
            },
            {
                name: "single year earliest",
                query: "earliest",
                param: TimeBoundValue.unboundedLeft
            }
        ]

        for (const test of tests) {
            it(`parse ${test.name}`, () => {
                const chart = fromQueryParams({ year: test.query })
                expect(chart.map.targetYear).toEqual(test.param)
            })
            it(`encode ${test.name}`, () => {
                const params = toQueryParams({
                    map: new MapConfigProps({ targetYear: test.param })
                })
                expect(params.year).toEqual(test.query)
            })
        }

        it("empty string doesn't change time", () => {
            const chart = fromQueryParams(
                { year: "" },
                { map: new MapConfigProps({ targetYear: 2015 }) }
            )
            expect(chart.map.targetYear).toEqual(2015)
        })
    })
})
