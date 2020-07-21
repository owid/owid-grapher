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
import {
    PerCapita,
    AlignedOption,
    SmoothingOption,
    colorScaleOption,
    MetricKind
} from "./CovidTypes"
import { CountryPickerMetric } from "./CovidCountryPickerMetric"
import { ChartTypeType } from "charts/ChartType"
import { trajectoryColumnSpecs } from "./CovidConstants"
import { buildColumnSlug } from "./CovidExplorerTable"
import { uniq, intersection } from "lodash"

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

    @observable totalFreq: boolean = false
    @observable dailyFreq: boolean = false
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

    allAvailableCombos(): string[] {
        const metrics = [
            "casesMetric",
            "deathsMetric",
            "cfrMetric",
            "testsMetric",
            "testsPerCaseMetric",
            "positiveTestRate"
        ]
        const timelines = ["totalFreq", 7, "dailyFreq"]
        const perCapita = [true, false]
        const aligned = [true, false]
        const yScale = ["log", "linear"] // todo
        const tab = ["map", "chart"] // todo
        const combos: any = []
        metrics.forEach(metric => {
            timelines.forEach(timeline => {
                perCapita.forEach(perCapita => {
                    aligned.forEach(aligned => {
                        const combo: any = {}
                        combo[metric] = true
                        if (timeline !== 7) combo[timeline] = true
                        else combo.smoothing = 7
                        combo.perCapita = perCapita
                        combo.aligned = aligned
                        combos.push(combo)
                    })
                })
            })
        })

        return uniq(
            combos.map((combo: any) =>
                new CovidQueryParams(
                    queryParamsToStr(combo)
                ).constrainedParams.toString()
            )
        )
    }

    setParamsFromQueryString(queryString: string) {
        const params = strToQueryParams(queryString)
        this.casesMetric = params.casesMetric === "true"
        this.totalFreq = params.totalFreq === "true"
        this.testsMetric = params.testsMetric === "true"
        this.testsPerCaseMetric = params.testsPerCaseMetric === "true"
        this.positiveTestRate = params.positiveTestRate === "true"
        this.deathsMetric = params.deathsMetric === "true"
        this.cfrMetric = params.cfrMetric === "true"
        this.dailyFreq = params.dailyFreq === "true"
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

    @computed get toParams(): QueryParams {
        const params: any = {}
        params.xColumn = this.xColumn ? this.xColumn : undefined
        params.yColumn = this.yColumn ? this.yColumn : undefined
        params.sizeColumn = this.sizeColumn ? this.sizeColumn : undefined
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
    @computed get chartType(): ChartTypeType {
        return this.aligned ? "ScatterPlot" : "LineChart"
    }

    @computed get colorStrategy(): colorScaleOption {
        if (this.colorScale) return this.colorScale

        if (this.chartType !== "ScatterPlot") return "none"

        if (this.casesMetric || this.testsMetric) return "ptr"

        return "continents"
    }

    @computed get yColumnSlug() {
        if (this.yColumn) return this.yColumn
        return buildColumnSlug(
            this.metricName,
            this.perCapitaDivisor,
            this.dailyFreq,
            this.smoothing
        )
    }

    @computed get xColumnSlug() {
        if (this.xColumn) return this.xColumn
        return this.chartType === "ScatterPlot"
            ? this.trajectoryColumnOption.slug
            : undefined
    }

    @computed get trajectoryColumnOption() {
        const key = this.casesMetric ? "cases" : "deaths"
        const config =
            trajectoryColumnSpecs[key][
                this.perCapita
                    ? "perCapita"
                    : this.dailyFreq
                    ? "daily"
                    : "total"
            ]
        const sourceSlug = buildColumnSlug(
            key,
            this.perCapita ? 1e6 : 1,
            this.dailyFreq,
            this.smoothing
        )
        return {
            ...config,
            slug: `daysSince${sourceSlug}Hit${config.threshold}`,
            sourceSlug
        }
    }

    @computed get constrainedParams() {
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

    setTimeline(option: "daily" | "total" | "smoothed") {
        this.totalFreq = false
        this.dailyFreq = false
        this.smoothing = 0
        if (option === "smoothed") {
            this.smoothing = 7
            this.dailyFreq = true
        } else if (option === "daily") this.dailyFreq = true
        else this.totalFreq = true
    }

    toString() {
        return queryParamsToStr(this.toParams)
    }

    @computed get sourceChartKey() {
        return [
            this.metricName,
            this.totalFreq ? "total" : "daily",
            this.perCapita ? "per_capita" : ""
        ]
            .filter(i => i)
            .join("_")
    }
}

export class CovidConstrainedQueryParams extends CovidQueryParams {
    constructor(queryString: string) {
        super(queryString)
        if (this.allowEverything) return this
        const available = this.available
        const defaults = new CovidQueryParams("")
        const wasDaily = this.dailyFreq

        Object.keys(available).forEach(key => {
            const typedKey = key as keyof typeof available
            // If the key is not available, set it to the default value (generally is false, but for smoothing is 0)
            if (!available[typedKey] && (this as any)[key])
                (this as any)[key] = defaults[key as keyof CovidQueryParams]
        })

        // We always need either total or daily freq
        if (!this.totalFreq && !this.dailyFreq) {
            // If daily is not available, we need to set totalFreq to true
            if (!available.dailyFreq && !available.smoothing)
                this.totalFreq = true
            // If it was daily, but only so that smoothing could happen, we need to set daily to true
            else if ((wasDaily || this.smoothing) && available.smoothing) {
                this.dailyFreq = true
                this.smoothing = 7
            } else this.totalFreq = true
        }

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
