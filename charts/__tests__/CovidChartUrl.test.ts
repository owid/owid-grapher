#! /usr/bin/env yarn jest

import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"

describe(CovidQueryParams, () => {
    it("parses params correctly", () => {
        const params = new CovidQueryParams(`cfrMetric=true&totalFreq=true`)
        expect(params.cfrMetric).toEqual(true)
    })

    it("can compute whether a covid param is set", () => {
        expect(CovidQueryParams.hasAnyCovidParam("")).toBeFalsy()
        expect(
            CovidQueryParams.hasAnyCovidParam("someTrackingId=3223")
        ).toBeFalsy()
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
        expect(params.interval).toEqual("smoothed")
        expect(params.smoothing).toEqual(7)
        const constrainedParams = params.toConstrainedParams()
        expect(constrainedParams.interval).toEqual("total")
        expect(constrainedParams.isDailyOrSmoothed).toEqual(false)
        expect(constrainedParams.smoothing).toEqual(0)
    })

    it("switches to 7-day smoothing param if on daily but daily is restricted", () => {
        const params = new CovidQueryParams(
            `positiveTestRate=true&dailyFreq=true`
        )
        expect(params.isDailyOrSmoothed).toEqual(true)
        expect(params.interval).toEqual("daily")
        const constrainedParams = params.constrainedParams
        expect(constrainedParams.interval).toEqual("smoothed")
        expect(constrainedParams.smoothing).toEqual(7)
    })

    it("computes the correct source chart key given current params", () => {
        const params = new CovidQueryParams(
            `casesMetric=true&dailyFreq=true&perCapita=true`
        )
        expect(params.sourceChartKey).toEqual("cases_daily_per_capita")
    })
})
