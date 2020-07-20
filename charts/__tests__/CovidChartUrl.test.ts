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
        expect(params.dailyFreq).toEqual(true)
        expect(params.totalFreq).toEqual(false)
        expect(params.smoothing).toEqual(7)
        const constrainedParams = params.constrainedParams
        expect(constrainedParams.dailyFreq).toEqual(false)
        expect(constrainedParams.totalFreq).toEqual(true)
        expect(constrainedParams.smoothing).toEqual(0)
    })

    it("switches to 7-day smoothing param if on daily but daily is restricted", () => {
        const params = new CovidQueryParams(
            `positiveTestRate=true&dailyFreq=true`
        )
        expect(params.dailyFreq).toEqual(true)
        expect(params.totalFreq).toEqual(false)
        const constrainedParams = params.constrainedParams
        expect(constrainedParams.dailyFreq).toEqual(true)
        expect(constrainedParams.smoothing).toEqual(7)
        expect(constrainedParams.totalFreq).toEqual(false)
    })

    it("computes the correct source chart key given current params", () => {
        const params = new CovidQueryParams(
            `casesMetric=true&dailyFreq=true&perCapita=true`
        )
        expect(params.sourceChartKey).toEqual("cases_daily_per_capita")
    })
})
