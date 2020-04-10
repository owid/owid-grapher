#! /usr/bin/env yarn jest

import { ChartConfigProps } from "charts/ChartConfig"
import { Time } from "charts/TimeBounds"
import { createConfig } from "test/utils"

import { ChartUrl, ChartQueryParams } from "../ChartUrl"

type TimeDomain = [Time, Time]

function fromQueryParams(
    params: ChartQueryParams,
    props?: Partial<ChartConfigProps>
) {
    const chart = createConfig(props)
    chart.url.populateFromQueryParams(params)
    return chart
}

function toQueryParams(domain: TimeDomain) {
    const chart = createConfig({ minTime: -5000, maxTime: 5000 })
    chart.timeDomain = domain
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
                name: "single year latest",
                query: "latest",
                param: [Infinity, Infinity]
            },
            {
                name: "single year earliest",
                query: "earliest",
                param: [-Infinity, -Infinity]
            },
            { name: "two years", query: "2000..2005", param: [2000, 2005] },
            {
                name: "right unbounded",
                query: "2000..",
                param: [2000, Infinity]
            },
            {
                name: "left unbounded",
                query: "..2005",
                param: [-Infinity, 2005]
            },
            {
                name: "unbounded (both)",
                query: "..",
                param: [-Infinity, Infinity]
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
                const params = toQueryParams(test.param)
                expect(params.time).toEqual(test.query)
            })
        }

        it("empty string doesn't change timeline", () => {
            const chart = fromQueryParams(
                { time: "" },
                { minTime: 0, maxTime: 5 }
            )
            const [start, end] = chart.timeDomain
            expect(start).toEqual(0)
            expect(end).toEqual(5)
        })
    })
})
