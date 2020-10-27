#! /usr/bin/env yarn jest
import { Grapher } from "grapher/core/Grapher"
import {
    ChartTypeName,
    DimensionProperty,
    EntitySelectionMode,
    GrapherTabOption,
    ScaleType,
} from "./GrapherConstants"
import {
    GrapherInterface,
    LegacyGrapherQueryParams,
    legacyQueryParamsToCurrentQueryParams,
} from "grapher/core/GrapherInterface"
import { TimeBoundValue, TimeBound, TimeBounds } from "grapher/utils/TimeBounds"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { orderBy } from "grapher/utils/Util"

const TestGrapherConfig = () => {
    const table = SynthesizeGDPTable({ entityCount: 10 })
    return {
        table,
        selection: table.sampleEntityName(5),
        dimensions: [
            {
                slug: SampleColumnSlugs.GDP,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.GDP as any,
            },
        ],
    }
}

it("regression fix: container options are not serialized", () => {
    const grapher = new Grapher({ xAxis: { min: 1 } })
    const obj = grapher.toObject().xAxis!
    expect(obj.max).toBe(undefined)
    expect((obj as any).containerOptions).toBe(undefined) // Regression test: should never be a containerOptions
})

it("can get dimension slots", () => {
    const grapher = new Grapher()
    expect(grapher.dimensionSlots.length).toBe(1)

    grapher.type = ChartTypeName.ScatterPlot
    expect(grapher.dimensionSlots.length).toBe(4)
})

it("an empty Grapher serializes to an empty object", () => {
    expect(new Grapher().toObject()).toEqual({})
})

it("does not preserve defaults in the object", () => {
    expect(new Grapher({ tab: GrapherTabOption.chart }).toObject()).toEqual({})
})

const unit = "% of children under 5"
const name = "Some display name"
const legacyConfig = {
    dimensions: [
        {
            variableId: 3512,
            property: DimensionProperty.y,
            display: {
                unit,
            },
        },
    ],
    owidDataset: {
        variables: {
            "3512": {
                years: [2000, 2010, 2010],
                entities: [207, 15, 207],
                values: [4, 20, 34],
                id: 3512,
                display: {
                    name,
                },
            },
        },
        entityKey: {
            "15": { name: "Afghanistan", id: 15, code: "AFG" },
            "207": { name: "Iceland", id: 207, code: "ISL" },
        },
    },
    selectedData: [
        { entityId: 207, index: 0 },
        { entityId: 15, index: 1 },
    ],
}

it("can apply legacy chart dimension settings", () => {
    const grapher = new Grapher(legacyConfig)
    const col = grapher.yColumns[0]!
    expect(col.unit).toEqual(unit)
    expect(col.displayName).toEqual(name)
})

it("can generate a url with country selection even if there is no entity code", () => {
    const config = {
        ...legacyConfig,
        selectedData: [],
    }
    const grapher = new Grapher(config)
    expect(grapher.queryStr).toBe("")
    grapher.selection.selectAll()
    expect(grapher.queryStr).toContain("AFG")

    const config2 = {
        ...legacyConfig,
        selectedData: [],
    }
    config2.owidDataset.entityKey[15].code = undefined as any
    const grapher2 = new Grapher(config2)
    expect(grapher2.queryStr).toBe("")
    grapher2.selection.selectAll()
    expect(grapher2.queryStr).toContain("Afghanistan")
})

it("stackedbars should not have timelines", () => {
    const grapher = new Grapher(legacyConfig)
    expect(grapher.hasTimeline).toBeTruthy()
    grapher.type = ChartTypeName.StackedBar
    expect(grapher.hasTimeline).toBeFalsy()
})

const getGrapher = () =>
    new Grapher({
        dimensions: [
            {
                variableId: 142609,
                property: DimensionProperty.y,
            },
        ],
        owidDataset: {
            variables: {
                "142609": {
                    years: [-1, 0, 1, 2],
                    entities: [1, 2, 1, 2],
                    values: [51, 52, 53, 54],
                    id: 142609,
                    display: { zeroDay: "2020-01-21", yearIsDay: true },
                },
            },
            entityKey: {
                "1": { name: "United Kingdom", code: "GBR", id: 1 },
                "2": { name: "Ireland", code: "IRL", id: 2 },
            },
        },
    })

function fromQueryParams(
    params: LegacyGrapherQueryParams,
    props?: Partial<GrapherInterface>
) {
    const grapher = new Grapher(props)
    grapher.populateFromQueryParams(
        legacyQueryParamsToCurrentQueryParams(params)
    )
    return grapher
}

function toQueryParams(props?: Partial<GrapherInterface>) {
    const grapher = new Grapher({
        minTime: -5000,
        maxTime: 5000,
        map: { time: 5000 },
    })
    if (props) grapher.updateFromObject(props)
    return grapher.params
}

it("can serialize scaleType if it changes", () => {
    expect(new Grapher().params.xScale).toEqual(undefined)
    const grapher = new Grapher({
        xAxis: { scaleType: ScaleType.linear },
    })
    expect(grapher.params.xScale).toEqual(undefined)
    grapher.xAxis.scaleType = ScaleType.log
    expect(grapher.params.xScale).toEqual(ScaleType.log)
})

describe("currentTitle", () => {
    it("shows the year of the selected data in the title", () => {
        const table = SynthesizeGDPTable(
            { entityCount: 2, timeRange: [2000, 2010] },
            1
        )
        const grapher = new Grapher({
            table,
            selectedEntityNames: table.availableEntityNames,
            dimensions: [
                {
                    slug: SampleColumnSlugs.GDP,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.GDP as any,
                },
            ],
        })

        grapher.timelineHandleTimeBounds = [2001, 2005]
        expect(grapher.currentTitle).toContain("2001")
        expect(grapher.currentTitle).toContain("2005")
        expect(grapher.currentTitle).not.toContain("Infinity")

        grapher.timelineHandleTimeBounds = [1900, 2020]
        expect(grapher.currentTitle).toContain("2000")
        expect(grapher.currentTitle).toContain("2009")

        grapher.timelineHandleTimeBounds = [-Infinity, Infinity]
        expect(grapher.currentTitle).toContain("2000")
        expect(grapher.currentTitle).toContain("2009")

        grapher.timelineHandleTimeBounds = [Infinity, Infinity]
        expect(grapher.currentTitle).not.toContain("2000")
        expect(grapher.currentTitle).toContain("2009")
    })
})

describe("authors can use maxTime", () => {
    it("can can create a discretebar chart with correct maxtime", () => {
        const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
        const grapher = new Grapher({
            table,
            type: ChartTypeName.DiscreteBar,
            selectedEntityNames: table.availableEntityNames,
            maxTime: 2005,
        })
        const chart = grapher.chartInstance
        expect(chart.failMessage).toBeFalsy()
    })
})

describe("line chart to bar chart and bar chart race", () => {
    const grapher = new Grapher(TestGrapherConfig())

    it("can create a new line chart with different start and end times", () => {
        expect(
            grapher.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart
        ).toEqual(ChartTypeName.LineChart)
        expect(grapher.endHandleTimeBound).toBeGreaterThan(
            grapher.startHandleTimeBound
        )
    })

    describe("switches from a line chart to a bar chart when there is only 1 year selected", () => {
        const grapher = new Grapher(TestGrapherConfig())
        const lineSeries = grapher.chartInstance.series

        expect(
            grapher.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart
        ).toEqual(ChartTypeName.LineChart)

        grapher.startHandleTimeBound = 2000
        grapher.endHandleTimeBound = 2000
        expect(
            grapher.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart
        ).toEqual(ChartTypeName.DiscreteBar)

        it("still has a timeline even though its now a bar chart", () => {
            expect(grapher.hasTimeline).toBe(true)
        })

        it("keeps same series colors when it switches from line chart to bar chart", () => {
            const barSeries = grapher.chartInstance.series
            const barColors = orderBy(barSeries, "seriesName").map(
                (series) => series.color
            )
            const linecolors = orderBy(lineSeries, "seriesName").map(
                (series) => series.color
            )
            expect(barColors).toEqual(linecolors)
        })
    })

    it("turns into a bar chart race when playing a line chart", () => {
        grapher.timelineController.play(1)
        expect(grapher.startHandleTimeBound).toEqual(grapher.endHandleTimeBound)
    })
})

describe("urls", () => {
    it("can change base url", () => {
        const url = new Grapher({
            isPublished: true,
            slug: "foo",
            bakedGrapherURL: "/grapher",
        })
        expect(url.baseUrl).toEqual("/grapher/foo")
    })

    it("does not include country param in url if unchanged", () => {
        const grapher = new Grapher(legacyConfig)
        grapher.isPublished = true
        expect(grapher.canonicalUrl?.includes("country")).toBeFalsy()
    })

    it("can upgrade legacy urls", () => {
        expect(
            legacyQueryParamsToCurrentQueryParams({ year: "2000" })
        ).toEqual({ time: "2000" })

        // Do not override time if set
        expect(
            legacyQueryParamsToCurrentQueryParams({
                year: "2000",
                time: "2001..2002",
            })
        ).toEqual({ time: "2001..2002" })
    })
})

describe("time domain tests", () => {
    const seed = 1
    const table = SynthesizeGDPTable(
        { entityCount: 2, timeRange: [2000, 2010] },
        seed
    ).replaceRandomCells(17, [SampleColumnSlugs.GDP], seed)
    const grapher = new Grapher({
        table,
        selectedEntityNames: table.availableEntityNames,
        dimensions: [
            {
                slug: SampleColumnSlugs.GDP,
                property: DimensionProperty.y,
                variableId: SampleColumnSlugs.GDP as any,
            },
        ],
    })

    it("get the default time domain from the primary dimensions", () => {
        expect(grapher.times).toEqual([2003, 2004, 2008])
        expect(grapher.startHandleTimeBound).toEqual(-Infinity)
        expect(grapher.endHandleTimeBound).toEqual(Infinity)
    })
})

describe("if a user sets a query param but dropUnchangedParams is false, do not delete the param even if it is a default", () => {
    const grapher = new Grapher({
        xAxis: {
            scaleType: ScaleType.linear,
            canChangeScaleType: true,
        },
        queryStr: "scaleType=linear",
    })
    expect(grapher.params.xScale).toEqual(undefined)
    grapher.dropUnchangedUrlParams = false
    expect(grapher.params.xScale).toEqual(ScaleType.linear)
})

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
                param: [-1500, -1500],
            },
            { name: "single year zero", query: "0", param: [0, 0] },
            {
                name: "single year latest",
                query: "latest",
                param: [
                    TimeBoundValue.positiveInfinity,
                    TimeBoundValue.positiveInfinity,
                ],
            },
            {
                name: "single year earliest",
                query: "earliest",
                param: [
                    TimeBoundValue.negativeInfinity,
                    TimeBoundValue.negativeInfinity,
                ],
            },
            { name: "two years", query: "2000..2005", param: [2000, 2005] },
            {
                name: "negative years",
                query: "-500..-1",
                param: [-500, -1],
            },
            {
                name: "right unbounded",
                query: "2000..latest",
                param: [2000, TimeBoundValue.positiveInfinity],
            },
            {
                name: "left unbounded",
                query: "earliest..2005",
                param: [TimeBoundValue.negativeInfinity, 2005],
            },
            {
                name: "left unbounded",
                query: "earliest..latest",
                param: [
                    TimeBoundValue.negativeInfinity,
                    TimeBoundValue.positiveInfinity,
                ],
            },

            // The queries below can be considered legacy and are no longer generated this way,
            // but we still want to support existing URLs of this form
            {
                name: "right unbounded [legacy]",
                query: "2000..",
                param: [2000, TimeBoundValue.positiveInfinity],
                irreversible: true,
            },
            {
                name: "left unbounded [legacy]",
                query: "..2005",
                param: [TimeBoundValue.negativeInfinity, 2005],
                irreversible: true,
            },
            {
                name: "both unbounded [legacy]",
                query: "..",
                param: [
                    TimeBoundValue.negativeInfinity,
                    TimeBoundValue.positiveInfinity,
                ],
                irreversible: true,
            },
        ]

        for (const test of tests) {
            it(`parse ${test.name}`, () => {
                const grapher = fromQueryParams({ time: test.query })
                const [start, end] = grapher.timelineHandleTimeBounds
                expect(start).toEqual(test.param[0])
                expect(end).toEqual(test.param[1])
            })
            if (!test.irreversible) {
                it(`encode ${test.name}`, () => {
                    const params = toQueryParams({
                        minTime: test.param[0],
                        maxTime: test.param[1],
                    })
                    expect(params.time).toEqual(test.query)
                })
            }
        }

        it("empty string doesn't change time", () => {
            const grapher = fromQueryParams(
                { time: "" },
                { minTime: 0, maxTime: 5 }
            )
            const [start, end] = grapher.timelineHandleTimeBounds
            expect(start).toEqual(0)
            expect(end).toEqual(5)
        })

        it("doesn't include URL param if it's identical to original config", () => {
            const grapher = new Grapher({
                minTime: 0,
                maxTime: 75,
            })
            expect(grapher.params.time).toEqual(undefined)
        })

        it("doesn't include URL param if unbounded is encoded as `undefined`", () => {
            const grapher = new Grapher({
                minTime: undefined,
                maxTime: 75,
            })
            expect(grapher.params.time).toEqual(undefined)
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
                param: [1, 1],
            },
            {
                name: "single day negative (date)",
                query: "2020-01-01",
                param: [-20, -20],
            },
            {
                name: "single day zero (date)",
                query: "2020-01-21",
                param: [0, 0],
            },
            {
                name: "single day latest",
                query: "latest",
                param: [
                    TimeBoundValue.positiveInfinity,
                    TimeBoundValue.positiveInfinity,
                ],
            },
            {
                name: "single day earliest",
                query: "earliest",
                param: [
                    TimeBoundValue.negativeInfinity,
                    TimeBoundValue.negativeInfinity,
                ],
            },
            {
                name: "two days",
                query: "2020-01-01..2020-02-01",
                param: [-20, 11],
            },
            {
                name: "left unbounded (date)",
                query: "earliest..2020-02-01",
                param: [TimeBoundValue.negativeInfinity, 11],
            },
            {
                name: "right unbounded (date)",
                query: "2020-01-01..latest",
                param: [-20, TimeBoundValue.positiveInfinity],
            },
            {
                name: "both unbounded (date)",
                query: "earliest..latest",
                param: [
                    TimeBoundValue.negativeInfinity,
                    TimeBoundValue.positiveInfinity,
                ],
            },

            // The queries below can be considered legacy and are no longer generated this way,
            // but we still want to support existing URLs of this form
            {
                name: "right unbounded (date) [legacy]",
                query: "2020-01-01..",
                param: [-20, TimeBoundValue.positiveInfinity],
                irreversible: true,
            },
            {
                name: "left unbounded (date) [legacy]",
                query: "..2020-01-01",
                param: [TimeBoundValue.negativeInfinity, -20],
                irreversible: true,
            },
            {
                name: "both unbounded [legacy]",
                query: "..",
                param: [
                    TimeBoundValue.negativeInfinity,
                    TimeBoundValue.positiveInfinity,
                ],
                irreversible: true,
            },

            {
                name: "single day (number)",
                query: "5",
                param: [5, 5],
                irreversible: true,
            },
            {
                name: "range (number)",
                query: "-5..5",
                param: [-5, 5],
                irreversible: true,
            },
            {
                name: "unbounded range (number)",
                query: "-500..",
                param: [-500, TimeBoundValue.positiveInfinity],
                irreversible: true,
            },
        ]

        for (const test of tests) {
            it(`parse ${test.name}`, () => {
                const grapher = getGrapher()
                grapher.populateFromQueryParams({ time: test.query })
                const [start, end] = grapher.timelineHandleTimeBounds
                expect(start).toEqual(test.param[0])
                expect(end).toEqual(test.param[1])
            })
            if (!test.irreversible) {
                it(`encode ${test.name}`, () => {
                    const grapher = getGrapher()
                    grapher.updateFromObject({
                        minTime: test.param[0],
                        maxTime: test.param[1],
                    })
                    const params = grapher.params
                    expect(params.time).toEqual(test.query)
                })
            }
        }
    })
})

it("canChangeEntity reflects all available entities before transforms", () => {
    const table = SynthesizeGDPTable()
    const grapher = new Grapher({
        addCountryMode: EntitySelectionMode.SingleEntity,
        table,
        selectedEntityNames: table.sampleEntityName(1),
    })
    expect(grapher.canChangeEntity).toBe(true)
})

describe.skip("year parameter", () => {
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
                param: -1500,
            },
            { name: "single year zero", query: "0", param: 0 },
            {
                name: "single year latest",
                query: "latest",
                param: TimeBoundValue.positiveInfinity,
            },
            {
                name: "single year earliest",
                query: "earliest",
                param: TimeBoundValue.negativeInfinity,
            },
        ]

        for (const test of tests) {
            it(`parse ${test.name}`, () => {
                const grapher = fromQueryParams({ year: test.query })
                expect(grapher.timelineHandleTimeBounds[1]).toEqual(test.param)
            })
            it(`encode ${test.name}`, () => {
                const params = toQueryParams({
                    map: { time: test.param },
                })
                expect(params.time).toEqual(test.query)
            })
        }

        it("empty string doesn't change time", () => {
            const grapher = fromQueryParams({ year: "", time: "2015" })
            expect(grapher.timelineHandleTimeBounds[1]).toEqual(2015)
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
                param: -20,
            },
            { name: "single day zero", query: "2020-01-21", param: 0 },
            {
                name: "single day latest",
                query: "latest",
                param: TimeBoundValue.positiveInfinity,
            },
            {
                name: "single day earliest",
                query: "earliest",
                param: TimeBoundValue.negativeInfinity,
            },
            {
                name: "single day (number)",
                query: "0",
                param: 0,
                irreversible: true,
            },
        ]

        for (const test of tests) {
            describe(`parse ${test.name}`, () => {
                const grapher = getGrapher()
                grapher.populateFromQueryParams(
                    legacyQueryParamsToCurrentQueryParams({
                        year: test.query,
                    })
                )
                expect(grapher.timelineHandleTimeBounds).toEqual([
                    test.param,
                    test.param,
                ])

                it("can clear query params", () => {
                    expect(grapher.queryStr).toBeTruthy()
                    grapher.clearQueryParams()
                    expect(grapher.queryStr).toBeFalsy()
                })
            })
            if (!test.irreversible) {
                it(`encode ${test.name}`, () => {
                    const grapher = getGrapher()
                    grapher.updateFromObject({
                        map: { time: test.param },
                    })
                    const params = grapher.params
                    expect(params.time).toEqual(test.query)
                })
            }
        }
    })
})
