import { computed, observable, action } from "mobx"
import {
    QueryParams,
    strToQueryParams,
    queryParamsToStr,
} from "utils/client/url"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { SortOrder, ColumnTypeNames } from "coreTable/CoreTableConstants"
import { oneOf, uniq, intersection } from "grapher/utils/Util"
import {
    trajectoryColumnThresholds,
    CovidColumnSlug,
    SmoothingOption,
    ColorScaleOptions,
    IntervalOptions,
    MetricOptions,
    sourceVariablesForColumnDefTemplates,
} from "./CovidConstants"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"
import { perCapitaDivisorByMetric } from "./CovidExplorerUtils"
import {
    OwidColumnDef,
    EntityCode,
    OwidTableSlugs,
} from "coreTable/OwidTableConstants"
import { CountryPickerManager } from "grapher/controls/countryPicker/CountryPickerConstants"
import { CovidAnnotationColumnSlugs } from "./CovidAnnotations"

// Previously the query string was a few booleans like dailyFreq=true. Now it is a single 'interval'.
// This method is for backward compat.
const legacyTimeToInterval = (
    totalFreq: boolean,
    dailyFreq: boolean,
    smoothing: boolean
): IntervalOptions | undefined => {
    if (totalFreq) return IntervalOptions.total
    else if (smoothing) return IntervalOptions.smoothed
    else if (dailyFreq) return IntervalOptions.daily
    return undefined
}

/**
 * CovidQueryParams is what the user entered and CovidConstrainedParams is a valid
 * state derived from that. Code that reads params should always read from
 * constrainedParams and code that writes should always write to the params.
 */

export class CovidQueryParams implements CountryPickerManager {
    // Todo: in hindsight these 6 metrics should have been something like "yColumn". May want to switch to that and translate these
    // for back compat.
    @observable casesMetric = false
    @observable testsMetric = false
    @observable testsPerCaseMetric = false
    @observable positiveTestRate = false
    @observable deathsMetric = false
    @observable cfrMetric = false

    @observable yColumn?: string
    @observable xColumn?: string
    @observable sizeColumn?: string
    @observable chartType?: ChartTypeName

    @observable perCapita = false
    @observable aligned = false
    @observable hideControls = false
    @observable smoothing: SmoothingOption = 0
    @observable colorScale?: ColorScaleOptions = undefined

    @observable tableMetrics?: MetricOptions[] = []

    // Country picker params
    @observable selectedCountryCodes = new Set<EntityCode>()
    @observable countryPickerMetric: CovidColumnSlug = OwidTableSlugs.entityName
    @observable countryPickerSort = SortOrder.asc

    @observable interval = IntervalOptions.daily

    @observable everythingAvailable = false

    constructor(queryString: string) {
        this.setParamsFromQueryString(queryString)
    }

    allAvailableQueryStringCombos(): string[] {
        const metrics = [
            "casesMetric",
            "deathsMetric",
            "cfrMetric",
            "testsMetric",
            "testsPerCaseMetric",
            "positiveTestRate",
        ]
        const perCapita = [true, false]
        const aligned = [true, false]
        const combos: any = []
        metrics.forEach((metric) => {
            Object.values(IntervalOptions).forEach((interval) => {
                perCapita.forEach((perCapita) => {
                    aligned.forEach((aligned) => {
                        const combo: any = {}
                        combo[metric] = true
                        combo.interval = interval
                        if (interval === IntervalOptions.smoothed)
                            combo.smoothing = 7
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
            (params.interval as IntervalOptions) ||
            legacyTimeToInterval(
                params.totalFreq === "true",
                params.dailyFreq === "true",
                params.smoothing === "3" || params.smoothing === "7" // Support the 2 old smoothing options
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
        this.everythingAvailable = params.everythingAvailable === "true"

        this.tableMetrics = params.tableMetrics
            ? params.tableMetrics
                  .split("~")
                  .map((metric) => metric as MetricOptions)
            : undefined

        this.smoothing = params.smoothing
            ? (parseInt(params.smoothing) as SmoothingOption)
            : 0

        if (params.country) {
            this.selectedCountryCodes.clear()
            EntityUrlBuilder.queryParamToEntities(
                params.country
            ).forEach((code) => this.selectedCountryCodes.add(code))
        }

        if (params.pickerMetric)
            // todo: validate
            this.countryPickerMetric = params.pickerMetric as any

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
        this.colorScale = params.colorScale as ColorScaleOptions
        this.chartType = params.chartType as ChartTypeName
    }

    static hasAnyCovidParam(queryString: string) {
        return (
            intersection(
                Object.keys(new CovidQueryParams("")),
                Object.keys(strToQueryParams(queryString))
            ).length > 0
        )
    }

    @computed get metricName(): MetricOptions {
        if (this.testsMetric) return MetricOptions.tests
        if (this.casesMetric) return MetricOptions.cases
        if (this.deathsMetric) return MetricOptions.deaths
        if (this.cfrMetric) return MetricOptions.case_fatality_rate
        if (this.testsPerCaseMetric) return MetricOptions.tests_per_case
        return MetricOptions.positive_test_rate
    }

    @computed get intervalTitle() {
        const titles: { [K in IntervalOptions]: string } = {
            total: "Cumulative",
            daily: "Daily new",
            smoothed: "Daily new",
            weekly: "Weekly",
            biweekly: "Biweekly",
            weeklyChange: "Week by week change of",
            biweeklyChange: "Biweekly change of",
        }
        return titles[this.interval]
    }

    @computed get toQueryParams(): QueryParams {
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
        params.everythingAvailable = this.everythingAvailable || undefined
        params.smoothing = this.smoothing
        params.country = EntityUrlBuilder.entitiesToQueryParam(
            Array.from(this.selectedCountryCodes)
        )
        params.pickerMetric = this.countryPickerMetric
        params.pickerSort = this.countryPickerSort
        params.tableMetrics = this.tableMetrics?.join("~")
        return params as QueryParams
    }

    /** If perCapita is enabled, will return size of divisor i.e. 1000, else 1 */
    @computed get perCapitaAdjustment() {
        return this.perCapita ? perCapitaDivisorByMetric(this.metricName) : 1
    }

    // If someone selects "Align with..." we switch to a scatterplot chart type.
    @computed get type(): ChartTypeName {
        return this.chartType
            ? this.chartType
            : this.aligned
            ? ChartTypeName.ScatterPlot
            : ChartTypeName.LineChart
    }

    @computed get colorStrategy(): ColorScaleOptions {
        if (this.colorScale) return this.colorScale

        if (this.type !== ChartTypeName.ScatterPlot)
            return ColorScaleOptions.none

        if (this.casesMetric || this.testsMetric) return ColorScaleOptions.ptr

        return ColorScaleOptions.continents
    }

    @computed get yColumnSlug() {
        if (this.yColumn) return this.yColumn
        return buildColumnSlugFromParams(
            this.metricName,
            this.perCapitaAdjustment,
            this.interval,
            this.smoothing
        )
    }

    @computed get isDailyOrSmoothed() {
        return (
            this.interval === IntervalOptions.daily ||
            this.interval === IntervalOptions.smoothed
        )
    }

    @computed get xColumnSlug() {
        if (this.xColumn) return this.xColumn
        return this.type === ChartTypeName.ScatterPlot
            ? this.trajectoryColumnOption.slug
            : undefined
    }

    @computed get trajectoryColumnOption() {
        const key = this.casesMetric
            ? MetricOptions.cases
            : MetricOptions.deaths
        const config =
            trajectoryColumnThresholds[key][
                this.perCapita
                    ? "perCapita"
                    : this.isDailyOrSmoothed
                    ? IntervalOptions.daily
                    : IntervalOptions.total
            ]
        const sourceSlug = buildColumnSlugFromParams(
            key,
            this.perCapita ? 1e6 : 1,
            this.interval,
            this.smoothing
        )
        return {
            ...config,
            slug: `daysSince${sourceSlug}Hit${config.threshold}`,
            sourceSlug,
        }
    }

    @computed get constrainedParams() {
        return this.toConstrainedParams()
    }

    toConstrainedParams() {
        return new CovidConstrainedQueryParams(this.toString())
    }

    setMetric(option: MetricOptions) {
        this.casesMetric = option === MetricOptions.cases
        this.testsMetric = option === MetricOptions.tests_per_case
        this.deathsMetric = option === MetricOptions.deaths
        this.cfrMetric = option === MetricOptions.case_fatality_rate
        this.testsPerCaseMetric = option === MetricOptions.tests_per_case
        this.positiveTestRate = option === MetricOptions.positive_test_rate
    }

    setTimeline(option: IntervalOptions) {
        this.interval = option
        this.smoothing = option === IntervalOptions.smoothed ? 7 : 0
    }

    toString() {
        return queryParamsToStr(this.toQueryParams)
    }

    get isWeekly() {
        return (
            this.interval === IntervalOptions.weekly ||
            this.interval === IntervalOptions.weeklyChange
        )
    }

    get isBiweekly() {
        return (
            this.interval === IntervalOptions.biweekly ||
            this.interval === IntervalOptions.biweeklyChange
        )
    }

    @computed get sourceChartKey() {
        let interval: string = this.interval
        if (interval === IntervalOptions.smoothed)
            interval = IntervalOptions.daily
        if (this.isWeekly || this.isBiweekly) interval = IntervalOptions.weekly
        return [
            this.metricName,
            interval,
            this.perCapita ? "per_capita" : "",
            this.intervalChange ? "change" : "",
        ]
            .filter((i) => i)
            .join("_")
    }

    get intervalChange() {
        if (this.interval === IntervalOptions.weeklyChange) return 7
        else if (this.interval === IntervalOptions.biweeklyChange) return 14
        return undefined
    }
}

export class CovidConstrainedQueryParams extends CovidQueryParams {
    constructor(queryString: string) {
        super(queryString)

        // Ensure there is always a metric
        const hasMetric = [
            this.cfrMetric,
            this.casesMetric,
            this.deathsMetric,
            this.testsMetric,
            this.testsPerCaseMetric,
            this.positiveTestRate,
        ].some((i) => i)
        if (!hasMetric) this.casesMetric = true

        const available = this.available

        if (this.perCapita && !available.perCapita) this.perCapita = false
        if (this.aligned && !available.aligned) this.aligned = false

        if ((this.isWeekly || this.isBiweekly) && !available.weekly)
            this.interval = IntervalOptions.total

        if (this.smoothing && !available.smoothed) {
            this.smoothing = 0
            if (this.interval === IntervalOptions.smoothed)
                this.interval = IntervalOptions.total
        }

        if (this.interval === IntervalOptions.daily && !available.daily) {
            if (available.smoothed) {
                this.interval = IntervalOptions.smoothed
                this.smoothing = 7
            } else {
                this.interval = IntervalOptions.total
            }
        }

        if (!this.interval)
            this.interval =
                this.smoothing && available.smoothed
                    ? IntervalOptions.smoothed
                    : IntervalOptions.total

        if (this.isWeekly) this.smoothing = 7
        if (this.isBiweekly) this.smoothing = 14
    }

    get isWeeklyOrBiweeklyChange() {
        return (
            this.interval === IntervalOptions.biweeklyChange ||
            this.interval === IntervalOptions.weeklyChange
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
            weekly,
        }

        if (this.everythingAvailable) {
            Object.keys(constraints).forEach((key) => {
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

export const makeColumnDefFromParams = (
    params: CovidQueryParams,
    defTemplates = makeColumnDefTemplates()
) => {
    const { metricName, perCapitaAdjustment, interval, smoothing } = params
    const def = defTemplates[metricName]
    def.slug = buildColumnSlugFromParams(
        metricName,
        perCapitaAdjustment,
        interval,
        smoothing
    )

    const perCapitaMessages: { [index: number]: string } = {
        1: "",
        1e3: " per thousand people",
        1e6: " per million people",
    }

    const display = def.display || {}
    display.name = `${params.intervalTitle} ${def.name ?? display.name}${
        perCapitaMessages[perCapitaAdjustment]
    }`
    def.display = display

    // Show decimal places for rolling average & per capita variables
    if (perCapitaAdjustment > 1) def.type = ColumnTypeNames.Ratio
    else if (
        metricName === MetricOptions.positive_test_rate ||
        metricName === MetricOptions.case_fatality_rate ||
        (smoothing && smoothing > 1)
    )
        def.type = ColumnTypeNames.Percentage

    return def
}

const buildColumnSlugFromParams = (
    name: MetricOptions,
    perCapita: number,
    interval: IntervalOptions,
    rollingAverage?: number
) =>
    [
        name,
        perCapita === 1e3
            ? "perThousand"
            : perCapita === 1e6
            ? "perMil"
            : undefined,
        interval,
        rollingAverage ? `${rollingAverage}DayAvg` : undefined,
    ]
        .filter((i) => i)
        .join("-")

// Ideally we would just have 1 set of column specs. Currently however we have some hard coded here, some coming from the Grapher backend, and some
// generated on the fly. These "template specs" are used to generate specs on the fly. Todo: cleanup.

export type CovidColumnDefObjectMap = { [key: string]: OwidColumnDef }

export const makeColumnDefTemplates = (
    columnDefsFromGrapherBackend: CovidColumnDefObjectMap = {}
): CovidColumnDefObjectMap => {
    const templates: CovidColumnDefObjectMap = {
        positive_test_rate: {
            ...columnDefsFromGrapherBackend[
                sourceVariablesForColumnDefTemplates.positive_test_rate
            ],
            isDailyMeasurement: true,
            type: ColumnTypeNames.Percentage,
            description:
                "The number of confirmed cases divided by the number of tests, expressed as a percentage. Tests may refer to the number of tests performed or the number of people tested – depending on which is reported by the particular country.",
        },
        tests_per_case: {
            ...columnDefsFromGrapherBackend[
                sourceVariablesForColumnDefTemplates.tests_per_case
            ],
            isDailyMeasurement: true,
            type: ColumnTypeNames.Ratio,
            description:
                "The number of tests divided by the number of confirmed cases. Not all countries report testing data on a daily basis.",
        },
        case_fatality_rate: {
            ...columnDefsFromGrapherBackend[
                sourceVariablesForColumnDefTemplates.case_fatality_rate
            ],
            annotationsColumnSlug:
                CovidAnnotationColumnSlugs.case_fatality_rate_series_annotations,
            isDailyMeasurement: true,
            type: ColumnTypeNames.Percentage,
            description: `The Case Fatality Rate (CFR) is the ratio between confirmed deaths and confirmed cases. During an outbreak of a pandemic the CFR is a poor measure of the mortality risk of the disease. We explain this in detail at OurWorldInData.org/Coronavirus`,
        },
        cases: {
            ...columnDefsFromGrapherBackend[
                sourceVariablesForColumnDefTemplates.cases
            ],
            isDailyMeasurement: true,
            annotationsColumnSlug:
                CovidAnnotationColumnSlugs.cases_series_annotations,
            name: "Confirmed cases of COVID-19",
            type: ColumnTypeNames.Integer,
            description: `The number of confirmed cases is lower than the number of actual cases; the main reason for that is limited testing.`,
        },
        deaths: {
            ...columnDefsFromGrapherBackend[
                sourceVariablesForColumnDefTemplates.deaths
            ],
            isDailyMeasurement: true,
            type: ColumnTypeNames.Integer,
            annotationsColumnSlug:
                CovidAnnotationColumnSlugs.deaths_series_annotations,
            name: "Confirmed deaths due to COVID-19",
            description: `Limited testing and challenges in the attribution of the cause of death means that the number of confirmed deaths may not be an accurate count of the true number of deaths from COVID-19.`,
        },
        tests: {
            ...columnDefsFromGrapherBackend[
                sourceVariablesForColumnDefTemplates.tests
            ],
            isDailyMeasurement: true,
            type: ColumnTypeNames.Integer,
            description: "",
            name: "tests",
            annotationsColumnSlug: "tests_units",
        },
        days_since: {
            ...columnDefsFromGrapherBackend[
                sourceVariablesForColumnDefTemplates.days_since
            ],
            isDailyMeasurement: true,
            type: ColumnTypeNames.Integer,
            description: "",
            name: "days_since",
        },
        continents: {
            ...columnDefsFromGrapherBackend[
                sourceVariablesForColumnDefTemplates.continents
            ],
            description: "",
            name: "continent",
            slug: "continent",
            type: ColumnTypeNames.Continent,
        },
    }

    // Todo: move to the grapher backend?
    const ptrDisplay = templates.positive_test_rate.display
    if (ptrDisplay)
        ptrDisplay.tableDisplay = {
            hideRelativeChange: true,
        }

    const cfrDisplay = templates.case_fatality_rate.display
    if (cfrDisplay)
        cfrDisplay.tableDisplay = {
            hideRelativeChange: true,
        }

    return templates
}
