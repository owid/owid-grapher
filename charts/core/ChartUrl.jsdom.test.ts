#! /usr/bin/env yarn jest

import { ChartConfigProps } from "charts/core/ChartConfig"
import { TimeBoundValue, TimeBound, TimeBounds } from "charts/utils/TimeBounds"
import { createConfig, setupChart } from "charts/test/utils"

import { ChartUrl, ChartQueryParams, EntityUrlBuilder } from "./ChartUrl"
import { MapConfigProps } from "charts/mapCharts/MapConfig"

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
        describe("with years", () => {
            const tests: {
                name: string
                query: string
                param: TimeBounds
                irreversible?: boolean
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
                    name: "negative years",
                    query: "-500..-1",
                    param: [-500, -1]
                },
                {
                    name: "right unbounded",
                    query: "2000..latest",
                    param: [2000, TimeBoundValue.unboundedRight]
                },
                {
                    name: "left unbounded",
                    query: "earliest..2005",
                    param: [TimeBoundValue.unboundedLeft, 2005]
                },
                {
                    name: "left unbounded",
                    query: "earliest..latest",
                    param: [
                        TimeBoundValue.unboundedLeft,
                        TimeBoundValue.unboundedRight
                    ]
                },

                // The queries below can be considered legacy and are no longer generated this way,
                // but we still want to support existing URLs of this form
                {
                    name: "right unbounded [legacy]",
                    query: "2000..",
                    param: [2000, TimeBoundValue.unboundedRight],
                    irreversible: true
                },
                {
                    name: "left unbounded [legacy]",
                    query: "..2005",
                    param: [TimeBoundValue.unboundedLeft, 2005],
                    irreversible: true
                },
                {
                    name: "both unbounded [legacy]",
                    query: "..",
                    param: [
                        TimeBoundValue.unboundedLeft,
                        TimeBoundValue.unboundedRight
                    ],
                    irreversible: true
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
                        const params = toQueryParams({
                            minTime: test.param[0],
                            maxTime: test.param[1]
                        })
                        expect(params.time).toEqual(test.query)
                    })
                }
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

            it("doesn't include URL param if unbounded is encoded as `undefined`", () => {
                const chart = createConfig({
                    minTime: undefined,
                    maxTime: 75
                })
                expect(chart.url.params.time).toEqual(undefined)
            })
        })

        describe("with days", () => {
            const tests: {
                name: string
                query: string
                param: TimeBounds
                irreversible?: boolean
            }[] = [
                {
                    name: "single day (date)",
                    query: "2020-01-22",
                    param: [1, 1]
                },
                {
                    name: "single day negative (date)",
                    query: "2020-01-01",
                    param: [-20, -20]
                },
                {
                    name: "single day zero (date)",
                    query: "2020-01-21",
                    param: [0, 0]
                },
                {
                    name: "single day latest",
                    query: "latest",
                    param: [
                        TimeBoundValue.unboundedRight,
                        TimeBoundValue.unboundedRight
                    ]
                },
                {
                    name: "single day earliest",
                    query: "earliest",
                    param: [
                        TimeBoundValue.unboundedLeft,
                        TimeBoundValue.unboundedLeft
                    ]
                },
                {
                    name: "two days",
                    query: "2020-01-01..2020-02-01",
                    param: [-20, 11]
                },
                {
                    name: "left unbounded (date)",
                    query: "earliest..2020-02-01",
                    param: [TimeBoundValue.unboundedLeft, 11]
                },
                {
                    name: "right unbounded (date)",
                    query: "2020-01-01..latest",
                    param: [-20, TimeBoundValue.unboundedRight]
                },
                {
                    name: "both unbounded (date)",
                    query: "earliest..latest",
                    param: [
                        TimeBoundValue.unboundedLeft,
                        TimeBoundValue.unboundedRight
                    ]
                },

                // The queries below can be considered legacy and are no longer generated this way,
                // but we still want to support existing URLs of this form
                {
                    name: "right unbounded (date) [legacy]",
                    query: "2020-01-01..",
                    param: [-20, TimeBoundValue.unboundedRight],
                    irreversible: true
                },
                {
                    name: "left unbounded (date) [legacy]",
                    query: "..2020-01-01",
                    param: [TimeBoundValue.unboundedLeft, -20],
                    irreversible: true
                },
                {
                    name: "both unbounded [legacy]",
                    query: "..",
                    param: [
                        TimeBoundValue.unboundedLeft,
                        TimeBoundValue.unboundedRight
                    ],
                    irreversible: true
                },

                {
                    name: "single day (number)",
                    query: "5",
                    param: [5, 5],
                    irreversible: true
                },
                {
                    name: "range (number)",
                    query: "-5..5",
                    param: [-5, 5],
                    irreversible: true
                },
                {
                    name: "unbounded range (number)",
                    query: "-500..",
                    param: [-500, TimeBoundValue.unboundedRight],
                    irreversible: true
                }
            ]

            for (const test of tests) {
                it(`parse ${test.name}`, () => {
                    const chart = setupChart(4066, [142708])
                    chart.url.populateFromQueryParams({ time: test.query })
                    const [start, end] = chart.timeDomain
                    expect(start).toEqual(test.param[0])
                    expect(end).toEqual(test.param[1])
                })
                if (!test.irreversible) {
                    it(`encode ${test.name}`, () => {
                        const chart = setupChart(4066, [142708])
                        chart.update({
                            minTime: test.param[0],
                            maxTime: test.param[1]
                        })
                        const params = chart.url.params
                        expect(params.time).toEqual(test.query)
                    })
                }
            }
        })
    })

    describe("year parameter", () => {
        describe("with years", () => {
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

        describe("with days", () => {
            const tests: {
                name: string
                query: string
                param: TimeBound
                irreversible?: boolean
            }[] = [
                { name: "single day", query: "2020-01-30", param: 9 },
                {
                    name: "single day negative",
                    query: "2020-01-01",
                    param: -20
                },
                { name: "single day zero", query: "2020-01-21", param: 0 },
                {
                    name: "single day latest",
                    query: "latest",
                    param: TimeBoundValue.unboundedRight
                },
                {
                    name: "single day earliest",
                    query: "earliest",
                    param: TimeBoundValue.unboundedLeft
                },
                {
                    name: "single day (number)",
                    query: "0",
                    param: 0,
                    irreversible: true
                }
            ]

            for (const test of tests) {
                it(`parse ${test.name}`, () => {
                    const chart = setupChart(4066, [142708])
                    chart.url.populateFromQueryParams({ year: test.query })
                    expect(chart.map.targetYear).toEqual(test.param)
                })
                if (!test.irreversible) {
                    it(`encode ${test.name}`, () => {
                        const chart = setupChart(4066, [142708])
                        chart.update({
                            map: new MapConfigProps({ targetYear: test.param })
                        })
                        const params = chart.url.params
                        expect(params.year).toEqual(test.query)
                    })
                }
            }
        })
    })
})

describe(EntityUrlBuilder, () => {
    const encodeTests = [
        { entities: ["USA", "GB"], queryString: "USA~GB" },
        {
            entities: ["YouTube", "Google+"],
            queryString: "YouTube~Google%2B"
        },
        {
            entities: [
                "Bogebakken (Denmark); 4300 - 3800 BCE",
                "British Columbia (30 sites); 3500 BCE - 1674 CE",
                "Brittany; 6000 BCE"
            ],
            queryString:
                "Bogebakken%20(Denmark)%3B%204300%20-%203800%20BCE~British%20Columbia%20(30%20sites)%3B%203500%20BCE%20-%201674%20CE~Brittany%3B%206000%20BCE"
        },
        {
            entities: ["British Columbia (30 sites); 3500 BCE - 1674 CE"],
            queryString:
                "~British%20Columbia%20(30%20sites)%3B%203500%20BCE%20-%201674%20CE"
        },
        {
            entities: ["Caribbean small states"],
            queryString: "~Caribbean%20small%20states"
        },
        {
            entities: ["North America"],
            queryString: "~North%20America"
        },
        {
            entities: [
                "Men and Women Ages 65+",
                "Australia & New Zealand + (Total)"
            ],
            queryString:
                "Men%20and%20Women%20Ages%2065%2B~Australia%20%26%20New%20Zealand%20%2B%20(Total)"
        }
    ]

    encodeTests.forEach(testCase => {
        it(`correctly encodes url strings`, () => {
            expect(
                EntityUrlBuilder.entitiesToQueryParam(testCase.entities)
            ).toEqual(testCase.queryString)
        })

        it(`correctly decodes url strings`, () => {
            expect(
                EntityUrlBuilder.queryParamToEntities(testCase.queryString)
            ).toEqual(testCase.entities)
        })
    })

    const legacyLinks = [
        {
            entities: ["North America", "DOM"],
            queryString: "North%20America+DOM"
        },
        { entities: ["USA", "GB"], queryString: "USA+GB" },
        { entities: ["YouTube", "Google+"], queryString: "YouTube+Google%2B" }
    ]

    legacyLinks.forEach(testCase => {
        it(`correctly decodes legacy url strings`, () => {
            expect(
                EntityUrlBuilder.queryParamToEntities(testCase.queryString)
            ).toEqual(testCase.entities)
        })
    })

    const facebookLinks = [
        {
            entities: ["Caribbean small states"],
            queryString: "Caribbean+small+states~"
        }
    ]

    facebookLinks.forEach(testCase => {
        it(`correctly decodes Facebook altered links`, () => {
            expect(
                EntityUrlBuilder.queryParamToEntities(testCase.queryString)
            ).toEqual(testCase.entities)
        })
    })
})
