import { computed, observable } from "mobx"

import { ObservableUrl } from "../UrlBinding"
import { ChartUrl } from "../ChartUrl"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { extend } from "../Util"
import { CountOption, TimelineOption, SmoothingOption } from "./CovidTypes"

export class CovidQueryParams {
    @observable.ref testsMetric: boolean = false
    @observable.ref deathsMetric: boolean = true
    @observable.ref casesMetric: boolean = false
    @observable.ref totalFreq: boolean = true
    @observable.ref dailyFreq: boolean = false
    @observable.ref count: CountOption = "total"
    @observable.ref timeline: TimelineOption = "normal"
    @observable.ref smoothing: SmoothingOption = "normal"
    @observable selectedCountryCodes: Set<string> = new Set(["CAN"])

    constructor(queryString: string) {
        const params = strToQueryParams(queryString)
        if (params.testsMetric) this.testsMetric = true
        if (params.deathsMetric) this.deathsMetric = true
        if (params.casesMetric) this.casesMetric = true
        if (params.totalFreq) this.totalFreq = true
        if (params.dailyFreq) this.dailyFreq = true
        if (params.count) this.count = params.count as CountOption
        if (params.timeline) this.timeline = params.count as TimelineOption
        if (params.smoothing) this.smoothing = params.count as SmoothingOption
        if (params.country)
            this.selectedCountryCodes = new Set(params.country.split("+"))
    }

    @computed get toParams(): QueryParams {
        const params: any = {}
        params.testsMetric = this.testsMetric ? true : undefined
        params.deathsMetric = this.deathsMetric ? true : undefined
        params.casesMetric = this.casesMetric ? true : undefined
        params.dailyFreq = this.dailyFreq ? true : undefined
        params.totalFreq = this.totalFreq ? true : undefined

        if (this.selectedCountryCodes.values.length)
            params.selectedCountryCodes = Array.from(
                this.selectedCountryCodes
            ).join(",")
        return params as QueryParams
    }
}

export class CovidUrl implements ObservableUrl {
    chartUrl: ChartUrl
    covidQueryParams: CovidQueryParams

    constructor(chartUrl: ChartUrl, covidQueryParams: CovidQueryParams) {
        this.chartUrl = chartUrl
        this.covidQueryParams = covidQueryParams
    }

    @computed get params(): QueryParams {
        return extend({}, this.chartUrl.params, this.covidQueryParams.toParams)
    }

    @computed get debounceMode(): boolean {
        return this.chartUrl.debounceMode
    }

    // populateFromQueryStr(queryStr?: string) {
    //     if (queryStr === undefined) return
    //     this.populateFromQueryParams(strToQueryParams(queryStr))
    // }

    // populateFromQueryParams(params: ExploreQueryParams) {
    //     const { model } = this

    //     const chartType = params.type
    //     if (chartType) {
    //         model.chartType = chartType as ExplorerChartType
    //     }

    //     if (params.indicator) {
    //         const id = parseInt(params.indicator)
    //         model.indicatorId = isNaN(id) ? undefined : id
    //     }

    //     this.chartUrl.populateFromQueryParams(params)
    // }
}
