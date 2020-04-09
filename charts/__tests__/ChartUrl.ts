#! /usr/bin/env yarn jest

import { createConfig } from "test/utils"

import { ChartUrl, ChartQueryParams } from "../ChartUrl"

type TimeDomain = [number | undefined, number | undefined]

function fromQueryParams(params: ChartQueryParams) {
    const chart = createConfig()
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
            irreversible?: boolean
        }[] = [
            { name: "single year", query: "1500", param: [1500, 1500] },
            {
                name: "empty string",
                query: "",
                param: [undefined, undefined],
                irreversible: true
            },
            { name: "two years", query: "2000..2005", param: [2000, 2005] },
            {
                name: "right unbounded",
                query: "2000..",
                param: [2000, undefined]
            },
            {
                name: "left unbounded",
                query: "..2005",
                param: [undefined, 2005]
            },
            {
                name: "unbounded (both)",
                query: "..",
                param: [undefined, undefined]
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
            if (!test.irreversible) {
                it(`encode ${test.name}`, () => {
                    const params = toQueryParams(test.param)
                    expect(params.time).toEqual(test.query)
                })
            }
        }
    })
})
