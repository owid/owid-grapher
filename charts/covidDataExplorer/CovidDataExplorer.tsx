import {
    OwidVariablesAndEntityKey,
    OwidEntityKey
} from "../owidData/OwidVariableSet"
import React from "react"
import ReactDOM from "react-dom"
import { ChartView } from "charts/ChartView"
import { Bounds } from "charts/Bounds"
import { ChartConfig } from "charts/ChartConfig"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import {
    computed,
    action,
    observable,
    IReactionDisposer,
    observe,
    Lambda
} from "mobx"
import { ChartTypeType } from "charts/ChartType"
import { observer } from "mobx-react"
import { bind } from "decko"
import { ChartDimension } from "../ChartDimension"
import * as urlBinding from "charts/UrlBinding"
import {
    max,
    fetchText,
    difference,
    pick,
    lastOfNonEmptyArray,
    throttle,
    capitalize
} from "charts/Util"
import {
    SmoothingOption,
    TotalFrequencyOption,
    DailyFrequencyOption,
    MetricKind,
    ParsedCovidRow,
    CountryOption
} from "./CovidTypes"
import { ControlOption, ExplorerControl } from "./CovidExplorerControl"
import { CountryPicker } from "./CovidCountryPicker"
import { CovidQueryParams, CovidUrl } from "./CovidChartUrl"
import {
    fetchAndParseData,
    RowAccessor,
    buildCovidVariable,
    daysSinceVariable,
    continentsVariable,
    buildCovidVariableId,
    makeCountryOptions,
    covidDataPath,
    covidLastUpdatedPath,
    getTrajectoryOptions,
    getLeastUsedColor
} from "./CovidDataUtils"
import { scaleLinear } from "d3-scale"
import { BAKED_BASE_URL } from "settings"
import moment from "moment"
import {
    covidDashboardSlug,
    covidDataExplorerContainerId,
    coronaDefaultView
} from "./CovidConstants"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ColorScheme, ColorSchemes } from "charts/ColorSchemes"

const abSeed = Math.random()

@observer
export class CovidDataExplorer extends React.Component<{
    data: ParsedCovidRow[]
    params: CovidQueryParams
    updated: string
}> {
    static async bootstrap(
        containerNode = document.getElementById(covidDataExplorerContainerId)
    ) {
        const typedData = await fetchAndParseData()
        const updated = await fetchText(covidLastUpdatedPath)
        const startingParams = new CovidQueryParams(
            window.location.search || coronaDefaultView
        )
        ReactDOM.render(
            <CovidDataExplorer
                data={typedData}
                updated={updated}
                params={startingParams}
            />,
            containerNode
        )
    }

    @observable private chartContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()

    private selectionChangeFromBuilder = false

    @action.bound clearSelectionCommand() {
        this.props.params.selectedCountryCodes.clear()
        this.updateChart()
    }

    setTotalFrequencyCommand(option: TotalFrequencyOption) {
        this.props.params.totalFreq = option
    }

    setDailyFrequencyCommand(option: DailyFrequencyOption) {
        this.props.params.dailyFreq = option
    }

    setSmoothingCommand(option: SmoothingOption) {
        this.props.params.smoothing = option
    }

    clearMetricsCommand() {
        this.props.params.casesMetric = false
        this.props.params.testsMetric = false
        this.props.params.deathsMetric = false
        this.props.params.cfrMetric = false
        this.props.params.testsPerCaseMetric = false
        this.props.params.positiveTestRate = false
    }

    private get metricPicker() {
        const options: ControlOption[] = [
            {
                available: true,
                label: "Confirmed cases",
                checked: this.constrainedParams.casesMetric,
                onChange: value => {
                    this.clearMetricsCommand()
                    this.props.params.casesMetric = true
                    this.updateChart()
                }
            },
            {
                available: true,
                label: "Confirmed deaths",
                checked: this.constrainedParams.deathsMetric,
                onChange: value => {
                    this.clearMetricsCommand()
                    this.props.params.deathsMetric = true
                    this.updateChart()
                }
            },

            {
                available: true,
                label: "Case fatality rate",
                checked: this.constrainedParams.cfrMetric,
                onChange: value => {
                    this.clearMetricsCommand()
                    this.props.params.cfrMetric = true
                    this.updateChart()
                }
            }
        ]

        const optionsColumn2: ControlOption[] = [
            {
                available: true,
                label: "Tests",
                checked: this.constrainedParams.testsMetric,
                onChange: value => {
                    this.clearMetricsCommand()
                    this.props.params.testsMetric = true
                    this.updateChart()
                }
            },
            {
                available: true,
                label: "Tests per confirmed case",
                checked: this.constrainedParams.testsPerCaseMetric,
                onChange: value => {
                    this.clearMetricsCommand()
                    this.props.params.testsPerCaseMetric = true
                    this.updateChart()
                }
            },
            {
                available: true,
                label: "Share of positive tests",
                checked: this.constrainedParams.positiveTestRate,
                onChange: value => {
                    this.clearMetricsCommand()
                    this.props.params.positiveTestRate = true
                    this.updateChart()
                }
            }
        ]
        return (
            <>
                <ExplorerControl
                    name="metric"
                    options={options}
                    isCheckbox={false}
                ></ExplorerControl>
                <ExplorerControl
                    hideLabel={true}
                    name="metric2"
                    options={optionsColumn2}
                    isCheckbox={false}
                ></ExplorerControl>
            </>
        )
    }

    private get frequencyPicker() {
        const options: ControlOption[] = [
            {
                available: true,
                label: "Cumulative",
                checked: this.constrainedParams.totalFreq,
                onChange: value => {
                    this.setTotalFrequencyCommand(value)
                    this.setDailyFrequencyCommand(false)
                    this.setSmoothingCommand(0)

                    this.updateChart()
                }
            },
            {
                available: this.constrainedParams.available.dailyFreq,
                label: "New per day",
                checked:
                    this.constrainedParams.dailyFreq &&
                    this.props.params.smoothing === 0,
                onChange: value => {
                    this.setDailyFrequencyCommand(value)
                    this.setTotalFrequencyCommand(false)
                    this.setSmoothingCommand(0)

                    this.updateChart()
                }
            },
            {
                available: this.constrainedParams.available.smoothing,
                label: "7-day rolling average",
                checked: this.constrainedParams.smoothing === 7,
                onChange: () => {
                    this.setSmoothingCommand(7)
                    this.updateChart()
                    this.setDailyFrequencyCommand(true)
                    this.setTotalFrequencyCommand(false)
                }
            }
        ]
        return (
            <ExplorerControl
                name="interval"
                options={options}
                isCheckbox={false}
            ></ExplorerControl>
        )
    }

    @computed private get constrainedParams() {
        return this.props.params.constrainedParams
    }

    @computed private get perCapitaPicker() {
        const options: ControlOption[] = [
            {
                available: this.constrainedParams.available.perCapita,
                label: capitalize(this.perCapitaOptions[this.perCapitaDivisor]),
                checked: this.constrainedParams.perCapita,
                onChange: value => {
                    this.props.params.perCapita = value
                    this.updateChart()
                }
            }
        ]
        return (
            <ExplorerControl
                name="count"
                isCheckbox={true}
                options={options}
            ></ExplorerControl>
        )
    }

    private get alignedPicker() {
        const options: ControlOption[] = [
            {
                available: this.constrainedParams.available.aligned,
                label: "Align outbreaks",
                checked: this.constrainedParams.aligned,
                onChange: value => {
                    this.props.params.aligned = value
                    this.updateChart()
                }
            }
        ]
        return (
            <ExplorerControl
                name="timeline"
                isCheckbox={true}
                options={options}
                comment={this.daysSinceOption.title}
            ></ExplorerControl>
        )
    }

    toggleSelectedCountry(code: string, value?: boolean) {
        if (value) {
            this.props.params.selectedCountryCodes.add(code)
        } else if (value === false) {
            this.props.params.selectedCountryCodes.delete(code)
        } else if (this.props.params.selectedCountryCodes.has(code)) {
            this.props.params.selectedCountryCodes.delete(code)
        } else {
            this.props.params.selectedCountryCodes.add(code)
        }
    }

    @action.bound toggleSelectedCountryCommand(code: string, value?: boolean) {
        this.toggleSelectedCountry(code, value)
        this.updateChart()
    }

    @computed get lastUpdated() {
        const time = moment.utc(this.props.updated)
        const formatString = "Do MMM, kk:mm [(GMT]Z[)]"
        return `Data last updated ${time.local().format(formatString)}`
    }

    @computed get howLongAgo() {
        return moment.utc(this.props.updated).fromNow()
    }

    @action.bound mobileToggleCustomizePopup() {
        this.showControlsPopup = !this.showControlsPopup
    }

    @observable showControlsPopup = false

    @action.bound onResize() {
        this.isMobile = this._isMobile()
        this.chartBounds = this.getChartBounds()
    }

    private _isMobile() {
        return (
            window.screen.width < 450 ||
            document.documentElement.clientWidth <= 680
        )
    }

    @observable isMobile: boolean = this._isMobile()
    @observable.ref chartBounds: Bounds | undefined = undefined

    // Todo: add better logic to maximize the size of the chart
    private getChartBounds(): Bounds | undefined {
        const chartContainer = this.chartContainerRef.current
        if (!chartContainer) return undefined
        return new Bounds(
            0,
            0,
            chartContainer.clientWidth,
            chartContainer.clientHeight
        )
    }

    render() {
        // A/B Test.
        const buttonLabel = abSeed > 0.5 ? `Customize chart` : `Change metric`
        const mobile = this.isMobile
        const customizeChartMobileButton = mobile ? (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.mobileToggleCustomizePopup}
                data-track-note="covid-customize-chart"
            >
                <FontAwesomeIcon icon={faChartLine} /> {buttonLabel}
            </a>
        ) : (
            undefined
        )
        const mobileDoneButton = mobile ? (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.mobileToggleCustomizePopup}
            >
                Done
            </a>
        ) : (
            undefined
        )

        const showMobileControls = mobile && this.showControlsPopup

        return (
            <div
                className={
                    `CovidDataExplorer` + (mobile ? " mobile-explorer" : "")
                }
            >
                <div className="CovidHeaderBox">
                    <div>Coronavirus Pandemic</div>
                    <div className="CovidTitle">Data Explorer</div>
                    <div className="CovidLastUpdated" title={this.howLongAgo}>
                        Download the complete <em>Our World in Data</em>{" "}
                        <a
                            href="https://github.com/owid/covid-19-data/tree/master/public/data"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            COVID-19 dataset.
                        </a>
                    </div>
                </div>
                <div
                    className={`CovidDataExplorerControlBar${
                        showMobileControls
                            ? ` show-controls-popup`
                            : mobile
                            ? ` hide-controls-popup`
                            : ""
                    }`}
                >
                    {this.metricPicker}
                    {this.frequencyPicker}
                    {this.perCapitaPicker}
                    {this.alignedPicker}
                    {mobileDoneButton}
                </div>
                <CountryPicker
                    covidDataExplorer={this}
                    toggleCountryCommand={this.toggleSelectedCountryCommand}
                    isDropdownMenu={mobile}
                ></CountryPicker>
                {customizeChartMobileButton}
                <div
                    className="CovidDataExplorerFigure"
                    ref={this.chartContainerRef}
                >
                    {this.chartBounds && (
                        <ChartView
                            bounds={this.chartBounds}
                            chart={this.chart}
                            isEmbed={true}
                        ></ChartView>
                    )}
                </div>
            </div>
        )
    }

    @computed get countryOptions(): CountryOption[] {
        return makeCountryOptions(this.props.data)
    }

    @computed get selectedCountryOptions(): CountryOption[] {
        return this.countryOptions.filter(option =>
            this.props.params.selectedCountryCodes.has(option.code)
        )
    }

    @computed private get availableEntities() {
        return this.countryOptions.map(country => country.name)
    }

    @computed get perCapitaDivisor() {
        if (this.constrainedParams.testsMetric) return 1000
        return 1000000
    }

    @computed private get perCapitaOptions() {
        return {
            1: "",
            1000: "per thousand people",
            1000000: "per million people"
        }
    }

    @computed private get perCapitaTitle() {
        return (
            " " +
            this.perCapitaOptions[
                this.constrainedParams.perCapita ? this.perCapitaDivisor : 1
            ]
        )
    }

    @computed get metricTitle() {
        const params = this.constrainedParams
        // Todo: if we no longer support multiple metrics, we could probably simplify this.
        const metrics = []
        if (params.deathsMetric) metrics.push("deaths")
        if (params.casesMetric) metrics.push("cases")
        if (params.testsMetric) metrics.push("tests")
        if (params.cfrMetric) metrics.push("case fatality rate")
        if (params.testsPerCaseMetric) metrics.push("tests per confirmed case")
        if (params.positiveTestRate) metrics.push("share of positive tests")
        return metrics.length > 2
            ? `${metrics.slice(1).join(", ")} and ${metrics[0]}`
            : metrics.length === 2
            ? `${metrics[0]} and ${metrics[1]}`
            : metrics[0]
    }

    @computed get smoothingTitle() {
        const smoothing = this.constrainedParams.smoothing
        if (smoothing > 0)
            return `Shown is the rolling ${smoothing}-day average. `
        return ""
    }

    @computed get title() {
        let title: string
        const params = this.constrainedParams
        if (params.cfrMetric)
            title = `Case fatality rate of the ongoing COVID-19 pandemic`
        else if (params.positiveTestRate)
            title = `The share of ${
                params.dailyFreq ? "daily " : ""
            }COVID-19 tests that are positive`
        else if (params.testsPerCaseMetric)
            title = `Tests conducted per new confirmed case of COVID-19`
        else {
            const freq = params.dailyFreq ? "Daily new" : "Total"
            title = `${freq} confirmed COVID-19 ${this.metricTitle}`
        }
        return title + this.perCapitaTitle
    }

    @computed get subtitle() {
        const parts: string[] = []
        const params = this.constrainedParams
        if (params.deathsMetric)
            parts.push(
                `Limited testing and challenges in the attribution of the cause of death means that the number of confirmed deaths may not be an accurate count of the true number of deaths from COVID-19.`
            )
        if (params.casesMetric)
            parts.push(
                `The number of confirmed cases is lower than the number of actual cases; the main reason for that is limited testing.`
            )
        if (params.cfrMetric)
            parts.push(
                `The Case Fatality Rate (CFR) is the ratio between confirmed deaths and confirmed cases. During an outbreak of a pandemic the CFR is a poor measure of the mortality risk of the disease. We explain this in detail at OurWorldInData.org/Coronavirus`
            )
        return `${this.smoothingTitle}` + parts.join("\n")
    }

    @computed get note() {
        const params = this.constrainedParams
        if (params.testsMetric)
            return "For testing figures, there are substantial differences across countries in terms of the units, whether or not all labs are included, the extent to which negative and pending tests are included and other aspects. Details for each country can be found on ourworldindata.org/covid-testing."
        return ""
    }

    @computed get selectedData() {
        const countryCodeMap = this.countryCodeMap
        return Array.from(this.props.params.selectedCountryCodes).map(code => {
            return {
                index: 0,
                entityId: countryCodeMap.get(code)!,
                color: this.countryCodeToColorMap[code]
            }
        })
    }

    @computed get countryMap() {
        const map = new Map<string, number>()
        this.countryOptions.forEach((country, index) => {
            map.set(country.name, index)
        })
        return map
    }

    @computed get countryCodeMap() {
        const map = new Map<string, number>()
        this.countryOptions.forEach((country, index) => {
            map.set(country.code, index)
        })
        return map
    }

    @computed get countryCodeToNameMap() {
        const map = new Map<string, string>()
        this.countryOptions.forEach((country, index) => {
            map.set(country.code, country.name)
        })
        return map
    }

    private _countryCodeToColorMapCache: {
        [key: string]: string | undefined
    } = {}

    @computed get countryCodeToColorMap(): {
        [key: string]: string | undefined
    } {
        const codes = this.selectedCountryOptions.map(country => country.code)
        // If there isn't a color for every country code, we need to update the color map
        if (!codes.every(code => code in this._countryCodeToColorMapCache)) {
            // Omit any unselected country codes from color map
            const newColorMap = pick(this._countryCodeToColorMapCache, codes)
            // Check for code *key* existence, not value.
            // `undefined` value means we want the color to be automatic, determined by the chart.
            const codesWithoutColor = codes.filter(
                code => !(code in newColorMap)
            )
            // For codes that don't have a color, assign one.
            codesWithoutColor.forEach(code => {
                const scheme = ColorSchemes["owid-distinct"] as ColorScheme
                const availableColors = lastOfNonEmptyArray(scheme.colorSets)
                const usedColors = Object.values(newColorMap).filter(
                    color => color !== undefined
                ) as string[]
                newColorMap[code] = getLeastUsedColor(
                    availableColors,
                    usedColors
                )
            })
            // Update the country color map cache
            this._countryCodeToColorMapCache = newColorMap
        }

        return this._countryCodeToColorMapCache
    }

    @computed get firstSelectedCountryName() {
        return this.countryCodeToNameMap.get(
            Array.from(this.props.params.selectedCountryCodes)[0]
        )
    }

    @computed get entityKey(): OwidEntityKey {
        const key: OwidEntityKey = {}
        this.countryOptions.forEach((country, index) => {
            key[index] = {
                name: country.name,
                code: country.code,
                id: index
            }
        })

        return key
    }

    // If someone selects "Align with..." we switch to a scatterplot chart type.
    @computed get chartType(): ChartTypeType {
        return this.constrainedParams.aligned ? "ScatterPlot" : "LineChart"
    }

    // Keep the barScale here for perf reasons
    @computed get barScale() {
        const allTestsPerCase = this.countryOptions
            .map(opt => opt.latestTotalTestsPerCase)
            .filter(d => d) as number[]
        const maxTestsPerCase = max(allTestsPerCase) ?? 1
        return scaleLinear()
            .domain([0, maxTestsPerCase])
            .range([0, 1])
    }

    private initVariableAndGetId(
        columnName: MetricKind,
        rowFn: RowAccessor,
        daily: boolean = false,
        perCapita = this.constrainedParams.perCapita ? this.perCapitaDivisor : 1
    ) {
        const params = this.constrainedParams
        const id = buildCovidVariableId(
            columnName,
            perCapita,
            params.smoothing,
            daily
        )

        // The 7 day test smoothing is already calculated, so for now just reuse that instead of
        // recalculating.
        const alreadySmoothed =
            (columnName === "tests" || columnName === "tests_per_case") &&
            params.smoothing === 7

        if (!this.owidVariableSet.variables[id]) {
            this.owidVariableSet.variables[id] = buildCovidVariable(
                id,
                columnName,
                this.countryMap,
                this.props.data,
                rowFn,
                perCapita,
                alreadySmoothed ? 1 : params.smoothing,
                daily,
                columnName === "tests" ? "" : " - " + this.lastUpdated
            )
        }
        return id
    }

    // We are computing variables clientside so they don't have a variable index. The variable index is used by Chart
    // in a number of places, so we still need a unique one per variable. The way our system works, changing things like
    // frequency or per capita would be in effect creating a new variable. So we need to generate unique variable ids
    // for all of these combinations.
    @computed get yVariableId() {
        const params = this.constrainedParams

        if (params.testsMetric && params.dailyFreq)
            return this.initVariableAndGetId(
                "tests",
                row => {
                    return params.smoothing === 7
                        ? row.new_tests_smoothed
                        : row.new_tests
                },
                true
            )
        if (params.testsMetric && params.totalFreq)
            return this.initVariableAndGetId("tests", row => row.total_tests)

        if (params.casesMetric && params.dailyFreq)
            return this.initVariableAndGetId(
                "cases",
                row => row.new_cases,
                true
            )
        if (params.casesMetric && params.totalFreq)
            return this.initVariableAndGetId("cases", row => row.total_cases)

        if (params.deathsMetric && params.dailyFreq)
            return this.initVariableAndGetId(
                "deaths",
                row => row.new_deaths,
                true
            )
        if (params.deathsMetric && params.totalFreq)
            return this.initVariableAndGetId("deaths", row => row.total_deaths)

        if (params.cfrMetric && params.dailyFreq)
            return this.initVariableAndGetId(
                "case_fatality_rate",
                row =>
                    row.total_cases < 100
                        ? undefined
                        : row.new_cases && row.new_deaths
                        ? (100 * row.new_deaths) / row.new_cases
                        : 0,
                true
            )
        if (params.cfrMetric && params.totalFreq)
            return this.initVariableAndGetId("case_fatality_rate", row =>
                row.total_cases < 100
                    ? undefined
                    : row.total_deaths && row.total_cases
                    ? (100 * row.total_deaths) / row.total_cases
                    : 0
            )

        if (params.testsPerCaseMetric && params.dailyFreq)
            return this.initVariableAndGetId(
                "tests_per_case",
                row => {
                    const value =
                        params.smoothing === 7
                            ? row.new_tests_smoothed
                            : row.new_tests
                    return value !== undefined && row.new_cases
                        ? value / row.new_cases
                        : undefined
                },
                true
            )
        if (params.testsPerCaseMetric && params.totalFreq)
            return this.initVariableAndGetId("tests_per_case", row =>
                row.total_tests !== undefined && row.total_cases
                    ? row.total_tests / row.total_cases
                    : undefined
            )

        if (params.positiveTestRate && params.dailyFreq)
            return this.initVariableAndGetId(
                "positive_test_rate",
                row => {
                    const value =
                        params.smoothing === 7
                            ? row.new_tests_smoothed
                            : row.new_tests

                    return value ? row.new_cases / value : undefined
                },
                true
            )
        if (params.positiveTestRate && params.totalFreq)
            return this.initVariableAndGetId("positive_test_rate", row =>
                row.total_cases !== undefined && row.total_tests
                    ? row.total_cases / row.total_tests
                    : undefined
            )

        console.log(`Error: no variable id generated.`)
        return 0
    }

    @computed get daysSinceVariableId() {
        const params = this.constrainedParams
        let sourceId = this.yVariableId
        // If we are using the cases metric, we use that for days since, else we use a formula
        // that uses the deaths metric.
        if (!params.casesMetric) {
            sourceId = params.dailyFreq
                ? this.initVariableAndGetId(
                      "deaths",
                      row => row.new_deaths,
                      true,
                      params.perCapita ? 1000000 : 1
                  )
                : this.initVariableAndGetId(
                      "deaths",
                      row => row.total_deaths,
                      false,
                      params.perCapita ? 1000000 : 1
                  )
        }

        const idParts = [456, sourceId]
        const id = parseInt(idParts.join(""))
        if (!this.owidVariableSet.variables[id]) {
            this.owidVariableSet.variables[id] = daysSinceVariable(
                this.owidVariableSet.variables[sourceId],
                this.daysSinceOption.threshold,
                this.daysSinceOption.title
            )
        }
        return id
    }

    @computed get daysSinceOption() {
        const params = this.constrainedParams
        const kind = params.casesMetric ? "cases" : "deaths"
        return getTrajectoryOptions(kind, params.dailyFreq, params.perCapita)
    }

    @observable.struct owidVariableSet: OwidVariablesAndEntityKey = {
        variables: {
            123: continentsVariable(this.countryOptions)
        },
        entityKey: this.entityKey
    }

    private continentsVariableId = 123

    updateChart() {
        // Generating the new chart may take a second so render the Data Explorer controls immediately then
        // update the chart view.
        setTimeout(() => {
            this.selectionChangeFromBuilder = true
            this._updateChart()
        }, 1)
    }

    @action.bound private async _updateChart() {
        // We can't create a new chart object with every radio change because the Chart component itself
        // maintains state (for example, which tab is currently active). Temporary workaround is just to
        // manually update the chart when the chart builderselections change.
        // todo: cleanup
        const chartProps = this.chart.props
        chartProps.title = this.title
        chartProps.subtitle = this.subtitle
        chartProps.note = this.note

        // If we switch to scatter, set zoomToSelection to true. I don't set it to true initially in the chart
        // config because then it won't appear in the URL.
        if (chartProps.type === "LineChart" && this.chartType === "ScatterPlot")
            chartProps.zoomToSelection = true

        chartProps.type = this.chartType

        // When dimensions changes, chart.variableIds change, which calls downloadData(), which reparses variableSet
        chartProps.dimensions = this.dimensions
        // Todo: perf improvements
        // We manually call this first, before doing the selection thing, because we cannot select data that is not there.
        await this.chart.downloadData()

        chartProps.map.variableId = this.yVariableId
        chartProps.map.colorScale.baseColorScheme = this.mapColorScheme

        if (this.constrainedParams.testsPerCaseMetric)
            Object.assign(chartProps.map, this.mapConfigs.tests_per_case)
        if (this.constrainedParams.positiveTestRate)
            Object.assign(chartProps.map, this.mapConfigs.positive_test_rate)

        chartProps.selectedData = this.selectedData
        this.chart.url.externallyProvidedParams = this.props.params.toParams
    }

    private mapConfigs = {
        // Sync with chart 4197
        tests_per_case: {
            timeTolerance: 10,
            baseColorScheme: "RdYlBu",
            colorSchemeValues: [5, 10, 20, 40, 100, 1000, 5000],
            isManualBuckets: true,
            equalSizeBins: true,
            customColorsActive: true,
            customNumericColors: [
                "#951009",
                "#d73027",
                "#f97953",
                "#fed390",
                "#7babc8",
                "#4575b4",
                "#1d4579"
            ]
        },
        // Sync with chart 4198
        positive_test_rate: {
            timeTolerance: 10,
            baseColorScheme: "RdYlBu",
            colorSchemeValues: [0.1, 1, 2, 5, 10, 20, 50],
            isManualBuckets: true,
            equalSizeBins: true,
            colorSchemeInvert: true,
            customColorsActive: true,
            customNumericColors: [
                "#24508b",
                "#4575b4",
                "#7fa9c3",
                "#f1c26d",
                "#fc8d59",
                "#d73027",
                "#91231e"
            ]
        }
    }

    componentDidMount() {
        this.bindToWindow()

        this.chart.hideEntityControls = true
        this.chart.externalCsvLink = covidDataPath
        this.chart.url.externalBaseUrl = `${BAKED_BASE_URL}/${covidDashboardSlug}`
        this._updateChart()

        this.observeChartEntitySelection()

        const win = window as any
        win.covidDataExplorer = this

        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)

        // call resize for the first time to initialize chart
        this.onResize()
    }

    componentWillUnmount() {
        if (this.onResizeThrottled) {
            window.removeEventListener("resize", this.onResizeThrottled)
        }
    }

    onResizeThrottled?: () => void

    private observeChartEntitySelection() {
        this.disposers.push(
            observe(this.chart.data, "selectedEntityCodes", change => {
                // Ignore the change if it was triggered by the chart builder,
                // but do not ignore subsequent changes.
                if (this.selectionChangeFromBuilder) {
                    this.selectionChangeFromBuilder = false
                    return
                }
                // Change can only be of 'update' type since we are observing an object property.
                if (change.type === "update") {
                    // We want to find the added/removed entities based on the chart selection, not
                    // taking the explorer selection into account. This is because there can be
                    // entities excluded in the chart selection because we have no data for them,
                    // but which may be selected in the explorer.
                    const newCodes = change.newValue
                    const oldCodes = change.oldValue ?? []
                    const added = difference(newCodes, oldCodes)
                    const removed = difference(oldCodes, newCodes)
                    added.forEach(code =>
                        this.toggleSelectedCountry(code, true)
                    )
                    removed.forEach(code =>
                        this.toggleSelectedCountry(code, false)
                    )
                    // Trigger an update in order to apply color changes
                    this.updateChart()
                }
            })
        )
    }

    bindToWindow() {
        const url = new CovidUrl(this.chart.url, this.props.params)
        urlBinding.bindUrlToWindow(url)
    }

    @computed get mapColorScheme() {
        return this.constrainedParams.testsMetric
            ? undefined
            : this.constrainedParams.casesMetric
            ? "YlOrBr"
            : "OrRd"
    }

    disposers: (IReactionDisposer | Lambda)[] = []

    @bind dispose() {
        this.disposers.forEach(dispose => dispose())
    }

    @computed get dimensions(): ChartDimension[] {
        if (this.chartType === "LineChart")
            return [
                {
                    property: "y",
                    variableId: this.yVariableId,
                    display: {
                        // Allow ± 1 day difference in data plotted on bar charts
                        // This is what we use for charts on the Grapher too
                        tolerance: 1
                    }
                }
            ]

        return [
            {
                property: "y",
                variableId: this.yVariableId,
                display: {
                    name: ""
                }
            },
            {
                property: "x",
                variableId: this.daysSinceVariableId,
                display: {
                    name: this.daysSinceOption.title
                }
            },
            {
                property: "color",
                variableId: this.continentsVariableId,
                display: {}
            }
        ]
    }

    get customCategoryColors() {
        const colors = lastOfNonEmptyArray(
            ColorSchemes["continents"]!.colorSets
        )
        return {
            Africa: colors[0],
            Antarctica: colors[1],
            Asia: colors[2],
            Europe: colors[3],
            "North America": colors[4],
            Oceania: colors[5],
            "South America": colors[6]
        }
    }

    @observable.ref chart = new ChartConfig(
        {
            slug: covidDashboardSlug,
            type: this.chartType,
            isExplorable: false,
            id: 4128,
            version: 9,
            title: this.title,
            subtitle: this.subtitle,
            note: this.note,
            hideTitleAnnotation: true,
            xAxis: {
                scaleType: "linear"
            },
            yAxis: {
                min: 0,
                scaleType: "linear",
                canChangeScaleType: true
            },
            owidDataset: this.owidVariableSet,
            selectedData: [],
            entitiesAreCountries: true,
            dimensions: this.dimensions,
            scatterPointLabelStrategy: "y",
            addCountryMode: "add-country",
            stackMode: "absolute",
            colorScale: {
                baseColorScheme: undefined,
                colorSchemeValues: [],
                colorSchemeLabels: [],
                customNumericColors: [],
                customCategoryColors: this.customCategoryColors,
                customCategoryLabels: {},
                customHiddenCategories: {}
            },
            hideRelativeToggle: true,
            hasChartTab: true,
            hasMapTab: true,
            tab: "chart",
            isPublished: true,
            map: {
                variableId: this.yVariableId,
                timeTolerance: 7,
                projection: "World",
                colorScale: {
                    baseColorScheme: this.mapColorScheme,
                    colorSchemeValues: [],
                    colorSchemeLabels: [],
                    customNumericColors: [],
                    customCategoryColors: {},
                    customCategoryLabels: {},
                    customHiddenCategories: {}
                }
            },
            data: {
                availableEntities: this.availableEntities
            }
        },
        {
            queryStr: window.location.search || coronaDefaultView
        }
    )
}
