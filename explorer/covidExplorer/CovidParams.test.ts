#! /usr/bin/env yarn jest

import {
    CovidQueryParams,
    makeColumnSpecFromParams,
} from "explorer/covidExplorer/CovidParams"
import { uniq } from "grapher/utils/Util"
import { IntervalOptions } from "./CovidConstants"

it("parses params correctly", () => {
    const params = new CovidQueryParams(`cfrMetric=true&totalFreq=true`)
    expect(params.cfrMetric).toEqual(true)
})

it("can compute whether a covid param is set", () => {
    expect(CovidQueryParams.hasAnyCovidParam("")).toBeFalsy()
    expect(CovidQueryParams.hasAnyCovidParam("someTrackingId=3223")).toBeFalsy()
    expect(
        CovidQueryParams.hasAnyCovidParam("hideControls=true&smoothing=0")
    ).toBeTruthy()
    expect(
        CovidQueryParams.hasAnyCovidParam(
            "testsMetric=true&smoothing=0&country=&pickerMetric=location&pickerSort=asc"
        )
    ).toBeTruthy()
})

it("computes constrained params correctly", () => {
    const params = new CovidQueryParams(
        `cfrMetric=true&dailyFreq=true&smoothing=7`
    )
    expect(params.isDailyOrSmoothed).toEqual(true)
    expect(params.interval).toEqual(IntervalOptions.smoothed)
    expect(params.smoothing).toEqual(7)
    const constrainedParams = params.toConstrainedParams()
    expect(constrainedParams.interval).toEqual(IntervalOptions.total)
    expect(constrainedParams.isDailyOrSmoothed).toEqual(false)
    expect(constrainedParams.smoothing).toEqual(0)
})

it("switches to 7-day smoothing param if on daily but daily is restricted", () => {
    const params = new CovidQueryParams(`positiveTestRate=true&dailyFreq=true`)
    expect(params.isDailyOrSmoothed).toEqual(true)
    expect(params.interval).toEqual(IntervalOptions.daily)
    const constrainedParams = params.constrainedParams
    expect(constrainedParams.interval).toEqual(IntervalOptions.smoothed)
    expect(constrainedParams.smoothing).toEqual(7)
})

it("converts legacy urls correctly", () => {
    const cases = [
        {
            str: `deathsMetric=true&dailyFreq=true&smoothing=0`,
            interval: IntervalOptions.daily,
            smoothing: 0,
        },
        {
            str: `deathsMetric=true&totalFreq=true&smoothing=0`,
            interval: IntervalOptions.total,
            smoothing: 0,
        },
        {
            str: `deathsMetric=true&dailyFreq=true&smoothing=7`,
            interval: IntervalOptions.smoothed,
            smoothing: 7,
        },
    ]

    cases.forEach((testCase) => {
        const params = new CovidQueryParams(testCase.str)
        expect(params.interval).toEqual(testCase.interval)
        expect(params.smoothing).toEqual(testCase.smoothing)
    })
})

it("computes the correct source chart key given current params", () => {
    const params = new CovidQueryParams(
        `casesMetric=true&dailyFreq=true&perCapita=true`
    )
    expect(params.sourceChartKey).toEqual("cases_daily_per_capita")
})

describe("column specs", () => {
    it("computes unique slugs", () => {
        expect(
            uniq(
                [
                    "testsMetric=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "casesMetric=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "positiveTestRate=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "casesMetric=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "testsMetric=true&dailyFreq=true&smoothing=3&perCapita=false",
                    "testsMetric=true&dailyFreq=true&smoothing=0&perCapita=true",
                    "testsMetric=true&totalFreq=true&smoothing=3&perCapita=true",
                ].map(
                    (queryStr) =>
                        makeColumnSpecFromParams(new CovidQueryParams(queryStr))
                            .slug
                )
            ).length
        ).toEqual(6)
    })
})
