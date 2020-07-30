import { computed, observable, action } from "mobx"
import { ObservableUrl } from "../UrlBinding"
import { ChartUrl, EntityUrlBuilder } from "../ChartUrl"
import {
    QueryParams,
    strToQueryParams,
    queryParamsToStr
} from "utils/client/url"
import { SortOrder } from "charts/SortOrder"
import { omit, oneOf } from "../Util"
import {
    PerCapita,
    AlignedOption,
    SmoothingOption,
    colorScaleOption,
    MetricKind,
    IntervalOption,
    intervalOptions
} from "./CovidTypes"
import { CountryPickerMetric } from "./CovidCountryPickerMetric"
import { ChartTypeType } from "charts/ChartType"
import { trajectoryColumnSpecs } from "./CovidConstants"
import { buildColumnSlug } from "./CovidExplorerTable"
import { uniq, intersection } from "lodash"

// Previously the query string was a few booleans like dailyFreq=true. Now it is a single 'interval'.
// This method is for backward compat.
const legacyTimeToInterval = (
    totalFreq: boolean,
    dailyFreq: boolean,
    smoothing: boolean
): IntervalOption | undefined => {
    if (totalFreq) return "total"
    else if (smoothing) return "smoothed"
    else if (dailyFreq) return "daily"
    return undefined
}

export class CovidQueryParams {
    // Todo: in hindsight these 6 metrics should have been something like "yColumn". May want to switch to that and translate these
    // for back compat.
    @observable casesMetric: boolean = false
    @observable testsMetric: boolean = false
    @observable testsPerCaseMetric: boolean = false
    @observable positiveTestRate: boolean = false
    @observable deathsMetric: boolean = false
    @observable cfrMetric: boolean = false

    @observable yColumn?: string
    @observable xColumn?: string
    @observable sizeColumn?: string
    @observable chartType?: ChartTypeType

    @observable perCapita: PerCapita = false
    @observable aligned: AlignedOption = false
    @observable hideControls: boolean = false
    @observable smoothing: SmoothingOption = 0
    @observable colorScale?: colorScaleOption = undefined

    // Country picker params
    @observable selectedCountryCodes: Set<string> = new Set()
    @observable countryPickerMetric: CountryPickerMetric =
        CountryPickerMetric.location
    @observable countryPickerSort: SortOrder = SortOrder.asc

    @observable interval: IntervalOption = "daily"

    allAvailableCombos(): string[] {
        const metrics = [
            "casesMetric",
            "deathsMetric",
            "cfrMetric",
            "testsMetric",
            "testsPerCaseMetric",
            "positiveTestRate"
        ]
        const perCapita = [true, false]
        const aligned = [true, false]
        const yScale = ["log", "linear"] // todo
        const tab = ["map", "chart"] // todo
        const combos: any = []
        metrics.forEach(metric => {
            intervalOptions.forEach(interval => {
                perCapita.forEach(perCapita => {
                    aligned.forEach(aligned => {
                        const combo: any = {}
                        combo[metric] = true
                        combo.interval = interval
                        if (interval === "smoothed") combo.smoothing = 7
                        combo.perCapita = perCapita
                        combo.aligned = aligned
                        combos.push(combo)
                    })
                })
            })
        })

        return uniq(
            combos.map((combo: any) =>
                new CovidQueryParams(queryParamsToStr(combo))
                    .toConstrainedParams()
                    .toString()
            )
        )
    }

    @action.bound setParamsFromQueryString(queryString: string) {
        const params = strToQueryParams(queryString)
        this.interval =
            (params.interval as IntervalOption) ||
            legacyTimeToInterval(
                !!params.totalFreq,
                !!params.dailyFreq,
                !!params.smoothing
            )

        this.casesMetric = params.casesMetric === "true"
        this.testsMetric = params.testsMetric === "true"
        this.testsPerCaseMetric = params.testsPerCaseMetric === "true"
        this.positiveTestRate = params.positiveTestRate === "true"
        this.deathsMetric = params.deathsMetric === "true"
        this.cfrMetric = params.cfrMetric === "true"
        this.perCapita = params.perCapita === "true"
        this.hideControls = params.hideControls === "true"
        this.aligned = params.aligned === "true"

        this.smoothing = params.smoothing
            ? (parseInt(params.smoothing) as SmoothingOption)
            : 0

        if (params.country) {
            this.selectedCountryCodes.clear()
            EntityUrlBuilder.queryParamToEntities(
                params.country
            ).forEach(code => this.selectedCountryCodes.add(code))
        }

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

        this.yColumn = params.yColumn
        this.xColumn = params.xColumn
        this.sizeColumn = params.sizeColumn
        this.colorScale = params.colorScale as colorScaleOption
        this.chartType = params.chartType as ChartTypeType
    }

    constructor(queryString: string) {
        this.setParamsFromQueryString(queryString)
    }

    static hasAnyCovidParam(queryString: string) {
        return (
            intersection(
                Object.keys(new CovidQueryParams("")),
                Object.keys(strToQueryParams(queryString))
            ).length > 0
        )
    }

    @computed get metricName(): MetricKind {
        if (this.testsMetric) return "tests"
        if (this.casesMetric) return "cases"
        if (this.deathsMetric) return "deaths"
        if (this.cfrMetric) return "case_fatality_rate"
        if (this.testsPerCaseMetric) return "tests_per_case"
        return "positive_test_rate"
    }

    @computed get intervalTitle() {
        const titles: { [K in IntervalOption]: string } = {
            total: "Cumulative",
            daily: "Daily new",
            smoothed: "Daily new",
            weekly: "Weekly",
            biweekly: "Biweekly",
            weeklyChange: "Week by week change of",
            biweeklyChange: "Biweekly change of"
        }
        return titles[this.interval]
    }

    @computed get toParams(): QueryParams {
        const params: any = {}
        params.xColumn = this.xColumn ? this.xColumn : undefined
        params.yColumn = this.yColumn ? this.yColumn : undefined
        params.sizeColumn = this.sizeColumn ? this.sizeColumn : undefined
        params.chartType = this.chartType ? this.chartType : undefined
        params.testsMetric = this.testsMetric ? true : undefined
        params.deathsMetric = this.deathsMetric ? true : undefined
        params.casesMetric = this.casesMetric ? true : undefined
        params.cfrMetric = this.cfrMetric ? true : undefined
        params.testsPerCaseMetric = this.testsPerCaseMetric ? true : undefined
        params.positiveTestRate = this.positiveTestRate ? true : undefined
        params.interval = this.interval // or undefined?
        params.aligned = this.aligned ? true : undefined
        params.hideControls = this.hideControls ? true : undefined
        params.perCapita = this.perCapita ? true : undefined
        params.colorScale = this.colorScale || undefined
        params.smoothing = this.smoothing
        params.country = EntityUrlBuilder.entitiesToQueryParam(
            Array.from(this.selectedCountryCodes)
        )
        params.pickerMetric = this.countryPickerMetric
        params.pickerSort = this.countryPickerSort
        return params as QueryParams
    }

    get perCapitaDivisor() {
        return this.perCapita ? (this.testsMetric ? 1e3 : 1e6) : 1
    }

    // If someone selects "Align with..." we switch to a scatterplot chart type.
    @computed get type(): ChartTypeType {
        return this.chartType
            ? this.chartType
            : this.aligned
            ? "ScatterPlot"
            : "LineChart"
    }

    @computed get colorStrategy(): colorScaleOption {
        if (this.colorScale) return this.colorScale

        if (this.type !== "ScatterPlot") return "none"

        if (this.casesMetric || this.testsMetric) return "ptr"

        return "continents"
    }

    @computed get yColumnSlug() {
        if (this.yColumn) return this.yColumn
        return buildColumnSlug(
            this.metricName,
            this.perCapitaDivisor,
            this.interval,
            this.smoothing
        )
    }

    @computed get isDailyOrSmoothed() {
        return this.interval === "daily" || this.interval === "smoothed"
    }

    @computed get xColumnSlug() {
        if (this.xColumn) return this.xColumn
        return this.type === "ScatterPlot"
            ? this.trajectoryColumnOption.slug
            : undefined
    }

    @computed get trajectoryColumnOption() {
        const key = this.casesMetric ? "cases" : "deaths"
        const config =
            trajectoryColumnSpecs[key][
                this.perCapita
                    ? "perCapita"
                    : this.isDailyOrSmoothed
                    ? "daily"
                    : "total"
            ]
        const sourceSlug = buildColumnSlug(
            key,
            this.perCapita ? 1e6 : 1,
            this.interval,
            this.smoothing
        )
        return {
            ...config,
            slug: `daysSince${sourceSlug}Hit${config.threshold}`,
            sourceSlug
        }
    }

    @computed get constrainedParams() {
        return this.toConstrainedParams()
    }

    toConstrainedParams() {
        return new CovidConstrainedQueryParams(this.toString())
    }

    setMetric(option: MetricKind) {
        this.casesMetric = option === "cases"
        this.testsMetric = option === "tests"
        this.deathsMetric = option === "deaths"
        this.cfrMetric = option === "case_fatality_rate"
        this.testsPerCaseMetric = option === "tests_per_case"
        this.positiveTestRate = option === "positive_test_rate"
    }

    setTimeline(option: IntervalOption) {
        this.interval = option
        this.smoothing = option === "smoothed" ? 7 : 0
    }

    toString() {
        return queryParamsToStr(this.toParams)
    }

    get isWeekly() {
        return this.interval === "weekly" || this.interval === "weeklyChange"
    }

    get isBiweekly() {
        return (
            this.interval === "biweekly" || this.interval === "biweeklyChange"
        )
    }

    @computed get sourceChartKey() {
        let interval: string = this.interval
        if (interval === "smoothed") interval = "daily"
        if (this.isWeekly || this.isBiweekly) interval = "weeklys"
        return [
            this.metricName,
            interval,
            this.perCapita ? "per_capita" : "",
            this.intervalChange ? "change" : ""
        ]
            .filter(i => i)
            .join("_")
    }

    get intervalChange() {
        if (this.interval === "weeklyChange") return 7
        else if (this.interval === "biweeklyChange") return 14
        return undefined
    }
}

export class CovidConstrainedQueryParams extends CovidQueryParams {
    constructor(queryString: string) {
        super(queryString)
        if (this.allowEverything) return this

        const available = this.available

        if (this.perCapita && !available.perCapita) this.perCapita = false
        if (this.aligned && !available.aligned) this.aligned = false

        if ((this.isWeekly || this.isBiweekly) && !available.weekly)
            this.interval = "total"

        if (this.smoothing && !available.smoothed) {
            this.smoothing = 0
            if (this.interval === "smoothed") this.interval = "total"
        }

        if (this.interval === "daily" && !available.daily) {
            if (available.smoothed) {
                this.interval = "smoothed"
                this.smoothing = 7
            } else {
                this.interval = "total"
            }
        }

        if (!this.interval)
            this.interval =
                this.smoothing && available.smoothed ? "smoothed" : "total"

        if (this.isWeekly) this.smoothing = 7
        if (this.isBiweekly) this.smoothing = 14

        // Ensure there is always a metric
        const hasMetric = [
            this.cfrMetric,
            this.casesMetric,
            this.deathsMetric,
            this.testsMetric,
            this.testsPerCaseMetric,
            this.positiveTestRate
        ].some(i => i)
        if (!hasMetric) this.casesMetric = true
    }

    get allowEverything() {
        return false
    }

    get rollingMultiplier() {
        if (this.isWeekly) return 7
        else if (this.isBiweekly) return 14
        return 1
    }

    get isWeeklyOrBiweeklyChange() {
        return (
            this.interval === "biweeklyChange" ||
            this.interval === "weeklyChange"
        )
    }

    get available() {
        const weekly = this.casesMetric || this.deathsMetric
        const isWeekly = (this.isWeekly || this.isBiweekly) && weekly // If weekly is set AND available
        const constraints = {
            perCapita: !this.isRate && !isWeekly,
            aligned: !this.isRate && !isWeekly,
            daily: !this.isRate,
            smoothed: !this.cfrMetric,
            weekly
        }

        if (this.allowEverything) {
            Object.keys(constraints).forEach(key => {
                constraints[key as keyof typeof constraints] = true
            })
        }

        return constraints
    }

    private get isRate() {
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
