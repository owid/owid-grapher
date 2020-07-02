import { computed, observable } from "mobx"
import { ObservableUrl } from "../UrlBinding"
import { ChartUrl, EntityUrlBuilder } from "../ChartUrl"
import {
    QueryParams,
    strToQueryParams,
    queryParamsToStr
} from "utils/client/url"
import { SortOrder } from "charts/SortOrder"
import { omit, oneOf } from "../Util"
import { PerCapita, AlignedOption, SmoothingOption } from "./CovidTypes"
import { CountryPickerMetric } from "./CovidCountryPickerMetric"

export class CovidQueryParams {
    @observable testsMetric: boolean = false
    @observable testsPerCaseMetric: boolean = false
    @observable positiveTestRate: boolean = false
    @observable deathsMetric: boolean = false
    @observable casesMetric: boolean = false
    @observable cfrMetric: boolean = false
    @observable totalFreq: boolean = false
    @observable dailyFreq: boolean = false
    @observable perCapita: PerCapita = false
    @observable aligned: AlignedOption = false
    @observable hideControls: boolean = false
    @observable smoothing: SmoothingOption = 0

    // Country picker params
    @observable selectedCountryCodes: Set<string> = new Set()
    @observable countryPickerMetric: CountryPickerMetric =
        CountryPickerMetric.location
    @observable countryPickerSort: SortOrder = SortOrder.asc

    constructor(queryString: string) {
        const params = strToQueryParams(queryString)
        if (!Object.keys(params).length) this.setDefaults()
        else this.setFromQueryString(params)
    }

    private setFromQueryString(params: QueryParams) {
        if (params.testsMetric) this.testsMetric = true
        if (params.testsPerCaseMetric) this.testsPerCaseMetric = true
        if (params.positiveTestRate) this.positiveTestRate = true
        if (params.deathsMetric) this.deathsMetric = true
        if (params.casesMetric) this.casesMetric = true
        if (params.cfrMetric) this.cfrMetric = true
        if (params.totalFreq) this.totalFreq = true
        if (params.dailyFreq) this.dailyFreq = true
        if (params.perCapita) this.perCapita = true
        if (params.hideControls) this.hideControls = true
        if (params.aligned) this.aligned = true
        if (params.smoothing)
            this.smoothing = parseInt(params.smoothing) as SmoothingOption
        if (params.country) this.setCountrySelectionFromChartUrl(params.country)
        if (params.pickerMetric) {
            const metric = oneOf<CountryPickerMetric | undefined>(
                params.pickerMetric,
                Object.values(CountryPickerMetric),
                undefined
            )
            if (metric) this.countryPickerMetric = metric
        }
        if (params.pickerSort) {
            const sort = oneOf<SortOrder | undefined>(
                params.pickerSort,
                Object.values(SortOrder),
                undefined
            )
            if (sort) this.countryPickerSort = sort
        }
    }

    private setCountrySelectionFromChartUrl(chartCountries: string) {
        EntityUrlBuilder.queryParamToEntities(chartCountries).forEach(code =>
            this.selectedCountryCodes.add(code)
        )
    }

    private setDefaults() {
        this.testsMetric = false
        this.testsPerCaseMetric = false
        this.positiveTestRate = false
        this.deathsMetric = false
        this.casesMetric = true
        this.cfrMetric = false
        this.hideControls = false
        this.totalFreq = true
        "USA GBR CAN BRA AUS IND ESP DEU FRA"
            .split(" ")
            .forEach(code => this.selectedCountryCodes.add(code))
    }

    @computed get toParams(): QueryParams {
        const params: any = {}
        params.testsMetric = this.testsMetric ? true : undefined
        params.deathsMetric = this.deathsMetric ? true : undefined
        params.casesMetric = this.casesMetric ? true : undefined
        params.cfrMetric = this.cfrMetric ? true : undefined
        params.testsPerCaseMetric = this.testsPerCaseMetric ? true : undefined
        params.positiveTestRate = this.positiveTestRate ? true : undefined
        params.dailyFreq = this.dailyFreq ? true : undefined
        params.totalFreq = this.totalFreq ? true : undefined
        params.aligned = this.aligned ? true : undefined
        params.hideControls = this.hideControls ? true : undefined
        params.perCapita = this.perCapita ? true : undefined
        params.smoothing = this.smoothing
        params.country = EntityUrlBuilder.entitiesToQueryParams(
            Array.from(this.selectedCountryCodes)
        )
        params.pickerMetric = this.countryPickerMetric
        params.pickerSort = this.countryPickerSort
        return params as QueryParams
    }

    @computed get constrainedParams() {
        return new CovidConstrainedQueryParams(queryParamsToStr(this.toParams))
    }
}

export class CovidConstrainedQueryParams extends CovidQueryParams {
    constructor(queryString: string) {
        super(queryString)
        if (this.allowEverything) return this
        const available = this.available
        const wasDaily = this.dailyFreq
        Object.keys(available).forEach(key => {
            const typedKey = key as keyof typeof available
            if (!available[typedKey] && (this as any)[key])
                (this as any)[key] = false
        })

        // We always need either total or daily freq
        if (!this.totalFreq && !this.dailyFreq) {
            // If daily is not available, we need to set totalFreq to true
            if (!available.dailyFreq && !available.smoothing)
                this.totalFreq = true
            // If it was daily, but only so that smoothing could happen, we need to set daily to true
            else if (wasDaily && available.smoothing) {
                this.dailyFreq = true
                this.smoothing = 7
            }
        }
    }

    @computed get allowEverything() {
        return false
    }

    @computed get available() {
        const constraints = {
            perCapita: !this.isRate,
            aligned: !this.isRate,
            dailyFreq: !this.isRate,
            smoothing: !this.cfrMetric
        }

        if (this.allowEverything) {
            Object.keys(constraints).forEach(key => {
                constraints[key as keyof typeof constraints] = true
            })
        }

        return constraints
    }

    @computed private get isRate() {
        return (
            this.cfrMetric || this.testsPerCaseMetric || this.positiveTestRate
        )
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
        // Omit `country` from chart params, it will be managed by the explorer.
        const chartParams = omit(this.chartUrl.params, "country")
        const covidParams = this.covidQueryParams.toParams
        return { ...chartParams, ...covidParams }
    }

    @computed get debounceMode(): boolean {
        return this.chartUrl.debounceMode
    }
}
