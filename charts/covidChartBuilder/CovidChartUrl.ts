import { computed, observable } from "mobx"

import { ObservableUrl } from "../UrlBinding"
import { ChartUrl } from "../ChartUrl"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { extend } from "../Util"
import { CountOption, TimelineOption, SmoothingOption } from "./CovidTypes"

export class CovidQueryParams {
    @observable testsMetric: boolean = false
    @observable deathsMetric: boolean = false
    @observable casesMetric: boolean = false
    @observable totalFreq: boolean = false
    @observable dailyFreq: boolean = false
    @observable count: CountOption = "total"
    @observable timeline: TimelineOption = "normal"
    @observable smoothing: SmoothingOption = 0
    @observable selectedCountryCodes: Set<string> = new Set()

    constructor(queryString: string) {
        const params = strToQueryParams(queryString)
        if (!Object.keys(params).length) this.setDefaults()
        else this.setFromQueryString(params)
    }

    private setFromQueryString(params: QueryParams) {
        if (params.testsMetric) this.testsMetric = true
        if (params.deathsMetric) this.deathsMetric = true
        if (params.casesMetric) this.casesMetric = true
        if (params.totalFreq) this.totalFreq = true
        if (params.dailyFreq) this.dailyFreq = true
        if (params.count) this.count = params.count as CountOption
        if (params.timeline) this.timeline = params.timeline as TimelineOption
        if (params.smoothing)
            this.smoothing = parseInt(params.smoothing) as SmoothingOption
        if (params.locations)
            params.locations
                .split("+")
                .forEach(code => this.selectedCountryCodes.add(code))
    }

    private setDefaults() {
        this.testsMetric = true
        this.deathsMetric = true
        this.casesMetric = true
        this.totalFreq = true
        this.selectedCountryCodes.add("USA")
    }

    @computed get toParams(): QueryParams {
        const params: any = {}
        params.testsMetric = this.testsMetric ? true : undefined
        params.deathsMetric = this.deathsMetric ? true : undefined
        params.casesMetric = this.casesMetric ? true : undefined
        params.dailyFreq = this.dailyFreq ? true : undefined
        params.totalFreq = this.totalFreq ? true : undefined
        params.count = this.count
        params.smoothing = this.smoothing

        const locations = Array.from(this.selectedCountryCodes)

        if (locations.length) params.locations = locations.join("+")
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
}
