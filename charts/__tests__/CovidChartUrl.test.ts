#! /usr/bin/env yarn jest

import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"

describe(CovidQueryParams, () => {
    it("parses params correctly", () => {
        const params = new CovidQueryParams(`cfrMetric=true&totalFreq=true`)
        expect(params.cfrMetric).toEqual(true)
    })

    it("computes constrained params correctly", () => {
        const params = new CovidQueryParams(`cfrMetric=true&dailyFreq=true`)
        expect(params.dailyFreq).toEqual(true)
        expect(params.totalFreq).toEqual(false)
        const constrainedParams = params.constrainedParams
        expect(constrainedParams.dailyFreq).toEqual(false)
        expect(constrainedParams.totalFreq).toEqual(true)
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
})
