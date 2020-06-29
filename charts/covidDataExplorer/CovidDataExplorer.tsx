import React from "react"
import classnames from "classnames"
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
    fetchText,
    difference,
    pick,
    lastOfNonEmptyArray,
    throttle,
    capitalize,
    intersection
} from "charts/Util"
import {
    SmoothingOption,
    TotalFrequencyOption,
    DailyFrequencyOption,
    MetricKind,
    CountryOption,
    CovidGrapherRow
} from "./CovidTypes"
import { ControlOption, ExplorerControl } from "./CovidExplorerControl"
import { CountryPicker } from "./CovidCountryPicker"
import { CovidQueryParams, CovidUrl } from "./CovidChartUrl"
import {
    fetchAndParseData,
    makeCountryOptions,
    covidDataPath,
    covidLastUpdatedPath,
    getTrajectoryOptions,
    getLeastUsedColor,
    addDaysSinceColumn
} from "./CovidDataUtils"
import { BAKED_BASE_URL } from "settings"
import moment from "moment"
import {
    covidDashboardSlug,
    covidDataExplorerContainerId,
    coronaDefaultView
} from "./CovidConstants"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ColorScheme, ColorSchemes } from "charts/ColorSchemes"
import { columnSpecs, buildColumnSpec } from "./CovidColumnSpecs"
import { RowToValueMapper } from "charts/owidData/OwidTable"

const abSeed = Math.random()

@observer
export class CovidDataExplorer extends React.Component<{
    data: CovidGrapherRow[]
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
                available: this.constrainedParams.available.smoothing,
                label: "7-day rolling average",
                checked: this.constrainedParams.smoothing === 7,
                onChange: () => {
                    this.setSmoothingCommand(7)
                    this.updateChart()
                    this.setDailyFrequencyCommand(true)
                    this.setTotalFrequencyCommand(false)
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
            document.documentElement.clientWidth <= 800
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

    get header() {
        return (
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
        )
    }

    get countryPicker() {
        return (
            <CountryPicker
                covidDataExplorer={this}
                toggleCountryCommand={this.toggleSelectedCountryCommand}
                isDropdownMenu={this.isMobile}
            ></CountryPicker>
        )
    }

    get controlBar() {
        const mobileDoneButton = this.isMobile ? (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.mobileToggleCustomizePopup}
            >
                Done
            </a>
        ) : (
            undefined
        )

        const showMobileControls = this.isMobile && this.showControlsPopup
        return (
            <div
                className={`CovidDataExplorerControlBar${
                    showMobileControls
                        ? ` show-controls-popup`
                        : this.isMobile
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
        )
    }

    get customizeChartMobileButton() {
        // A/B Test.
        const buttonLabel = abSeed > 0.5 ? `Customize chart` : `Change metric`
        return this.isMobile ? (
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
    }

    render() {
        const showControls = !this.props.params.hideControls
        return (
            <>
                <div
                    className={classnames([
                        `CovidDataExplorer`,
                        this.isMobile ? "mobile-explorer" : undefined,
                        showControls ? "" : "HideControls"
                    ])}
                >
                    {showControls && this.header}
                    {showControls && this.controlBar}
                    {showControls && this.countryPicker}
                    {showControls && this.customizeChartMobileButton}
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
            </>
        )
    }

    get controlsToggleElement() {
        return (
            <label>
                <input
                    type="checkbox"
                    checked={this.props.params.hideControls}
                    onChange={this.toggleControls}
                />{" "}
                Hide controls
            </label>
        )
    }

    @action.bound toggleControls() {
        this.props.params.hideControls = !this.props.params.hideControls
        this.chart.embedExplorerCheckbox = this.controlsToggleElement
        this._updateChart()
        requestAnimationFrame(() => this.onResize())
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
            1000: "per 1,000 people",
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

    @computed private get chartTitle() {
        let title = ""
        const params = this.constrainedParams
        const freq = params.dailyFreq ? "Daily new" : "Cumulative"
        if (params.cfrMetric)
            title = `Case fatality rate of the ongoing COVID-19 pandemic`
        else if (params.positiveTestRate)
            title = `The share of ${
                params.dailyFreq ? "daily " : ""
            }COVID-19 tests that are positive`
        else if (params.testsPerCaseMetric)
            title = `${
                params.totalFreq ? `Cumulative tests` : `Tests`
            } conducted per confirmed case of COVID-19`
        else if (params.testsMetric) title = `${freq} COVID-19 tests`
        else if (params.deathsMetric)
            title = `${freq} confirmed COVID-19 deaths`
        else if (params.casesMetric) title = `${freq} confirmed COVID-19 cases`

        return title + this.perCapitaTitle
    }

    @computed private get subtitle() {
        const smoothing = this.constrainedParams.smoothing
            ? `Shown is the rolling ${this.constrainedParams.smoothing}-day average. `
            : ""
        return `${smoothing}` + this.yColumn.description
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

    private availableCountriesCache: Map<string, Set<string>> = new Map()

    @computed get availableCountriesForMetric() {
        let key: string
        if (this.xVariableId && this.xColumn && this.yColumn) {
            key = this.xVariableId + "-" + this.currentYVarId
            if (!this.availableCountriesCache.get(key)) {
                const data = intersection(
                    Array.from(this.xColumn.entityNamesUniq.values()),
                    Array.from(this.yColumn.entityNamesUniq.values())
                )
                this.availableCountriesCache.set(key, new Set(data))
            }
        } else if (this.yColumn) {
            key = this.currentYVarId + ""
            if (!this.availableCountriesCache.get(key)) {
                this.availableCountriesCache.set(
                    key,
                    this.yColumn.entityNamesUniq
                )
            }
        } else {
            return new Set()
        }
        return this.availableCountriesCache.get(key)!
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

    // If someone selects "Align with..." we switch to a scatterplot chart type.
    @computed get chartType(): ChartTypeType {
        return this.constrainedParams.aligned ? "ScatterPlot" : "LineChart"
    }

    private initColumn(
        columnName: MetricKind,
        rowFn: RowToValueMapper,
        daily: boolean = false,
        perCapita = this.constrainedParams.perCapita ? this.perCapitaDivisor : 1
    ) {
        const smoothing = this.constrainedParams.smoothing
        const spec = buildColumnSpec(
            columnName,
            perCapita,
            daily,
            smoothing,
            columnName === "tests" ? "" : " - " + this.lastUpdated
        )

        const table = this.chart.table
        if (table.columnsBySlug.has(spec.slug)) return

        // The 7 day test smoothing is already calculated, so for now just reuse that instead of recalculating.
        const alreadySmoothed =
            (columnName === "tests" ||
                columnName === "tests_per_case" ||
                columnName === "positive_test_rate") &&
            smoothing === 7

        if (perCapita > 1) {
            const originalRowFn = rowFn
            rowFn = row => {
                const value = originalRowFn(row)
                if (value === undefined) return undefined
                const pop = row.population
                if (!pop) {
                    console.log(
                        `Warning: Missing population for ${row.location}. Excluding from perCapita`
                    )
                    return undefined
                }
                return perCapita * (value / pop)
            }
        }

        if (smoothing && !alreadySmoothed)
            table.addRollingAverageColumn(
                spec,
                smoothing,
                rowFn,
                "day",
                "entityName"
            )
        else table.addComputedColumn({ ...spec, fn: rowFn })
    }

    @computed get currentYVarId() {
        const params = this.constrainedParams
        return buildColumnSpec(
            this.metricName,
            params.perCapita ? this.perCapitaDivisor : 1,
            params.dailyFreq,
            params.smoothing
        ).owidVariableId!
    }

    private get metricName(): MetricKind {
        const params = this.constrainedParams
        if (params.testsMetric) return "tests"
        if (params.casesMetric) return "cases"
        if (params.deathsMetric) return "deaths"
        if (params.cfrMetric) return "case_fatality_rate"
        if (params.testsPerCaseMetric) return "tests_per_case"
        return "positive_test_rate"
    }

    initRequestedColumns() {
        const params = this.constrainedParams

        if (params.casesMetric && params.dailyFreq)
            this.initColumn(this.metricName, row => row.new_cases, true)
        if (params.casesMetric && params.totalFreq)
            this.initColumn(this.metricName, row => row.total_cases)

        const needsDeaths = params.testsMetric && params.aligned
        if ((params.deathsMetric && params.dailyFreq) || needsDeaths)
            this.initColumn("deaths", row => row.new_deaths, true)
        if ((params.deathsMetric && params.totalFreq) || needsDeaths)
            this.initColumn("deaths", row => row.total_deaths)

        if (params.testsMetric && params.dailyFreq)
            this.initColumn(
                this.metricName,
                row => {
                    return params.smoothing === 7
                        ? row.new_tests_smoothed
                        : row.new_tests
                },
                true
            )
        if (params.testsMetric && params.totalFreq)
            this.initColumn(this.metricName, row => row.total_tests)

        if (params.cfrMetric && params.dailyFreq)
            this.initColumn(
                this.metricName,
                row =>
                    row.total_cases < 100
                        ? undefined
                        : row.new_cases && row.new_deaths
                        ? (100 * row.new_deaths) / row.new_cases
                        : 0,
                true
            )
        if (params.cfrMetric && params.totalFreq)
            this.initColumn(this.metricName, row =>
                row.total_cases < 100
                    ? undefined
                    : row.total_deaths && row.total_cases
                    ? (100 * row.total_deaths) / row.total_cases
                    : 0
            )

        if (params.testsPerCaseMetric && params.dailyFreq) {
            if (params.smoothing) {
                const casesSlug = this.addNewCasesSmoothedColumn()
                this.initColumn(
                    this.metricName,
                    row => {
                        if (
                            row.new_tests_smoothed === undefined ||
                            !(row as any)[casesSlug]
                        )
                            return undefined
                        const tpc =
                            row.new_tests_smoothed / (row as any)[casesSlug]
                        return tpc >= 1 ? tpc : undefined
                    },
                    true
                )
            } else {
                this.initColumn(
                    this.metricName,
                    row => {
                        if (row.new_tests === undefined || row.new_cases)
                            return undefined
                        const tpc = row.new_tests / row.new_cases
                        return tpc >= 1 ? tpc : undefined
                    },
                    true
                )
            }
        }
        if (params.testsPerCaseMetric && params.totalFreq)
            this.initColumn(this.metricName, row => {
                if (row.total_tests === undefined || !row.total_cases)
                    return undefined
                const tpc = row.total_tests / row.total_cases
                return tpc >= 1 ? tpc : undefined
            })

        if (params.positiveTestRate && params.dailyFreq) {
            const casesSlug = this.addNewCasesSmoothedColumn()
            this.initColumn(
                this.metricName,
                row => {
                    const testCount =
                        params.smoothing === 7
                            ? row.new_tests_smoothed
                            : row.new_tests

                    const cases =
                        params.smoothing === 7
                            ? (row as any)[casesSlug]
                            : row.new_cases

                    if (!testCount) return undefined

                    const rate = cases / testCount
                    return rate >= 0 && rate <= 1 ? rate : undefined
                },
                true
            )
        }
        if (params.positiveTestRate && params.totalFreq)
            this.initColumn(this.metricName, row => {
                if (row.total_cases === undefined || !row.total_tests)
                    return undefined
                const rate = row.total_cases / row.total_tests
                return rate >= 0 && rate <= 1 ? rate : undefined
            })

        if (params.aligned) {
            const option = this.daysSinceOption
            addDaysSinceColumn(
                this.chart.table,
                option.sourceSlug,
                option.id,
                option.threshold,
                option.title
            )
        }
    }

    private addNewCasesSmoothedColumn() {
        const smoothing = this.constrainedParams.smoothing
        const slug = `new_cases_smoothed_${smoothing}day`
        if (this.chart.table.columnsBySlug.has(slug)) return slug
        this.chart.table.addRollingAverageColumn(
            {
                slug
            },
            smoothing,
            row => row.new_cases,
            "day",
            "entityName"
        )

        return slug
    }

    @computed get daysSinceOption() {
        const params = this.constrainedParams
        const kind = params.casesMetric ? "cases" : "deaths"
        const options = getTrajectoryOptions(
            kind,
            params.dailyFreq,
            params.perCapita,
            params.smoothing
        )
        return options
    }

    updateChart() {
        // Updating the chart may take a second so render the Data Explorer controls immediately then the chart.
        setTimeout(() => {
            this.selectionChangeFromBuilder = true
            this._updateChart()
        }, 1)
    }

    private initTable() {
        this.chart.table.addRowsAndDetectColumns(this.props.data)
        this.chart.table.addColumnSpec(columnSpecs.continents)
    }

    // We can't create a new chart object with every radio change because the Chart component itself
    // maintains state (for example, which tab is currently active). Temporary workaround is just to
    // manually update the chart when the chart builderselections change.
    // todo: cleanup
    @action.bound private _updateChart() {
        if (!this.chart.table.rows.length) this.initTable()
        this.initRequestedColumns()
        const chartProps = this.chart.props
        chartProps.title = this.chartTitle
        chartProps.subtitle = this.subtitle
        chartProps.note = this.note

        // If we switch to scatter, set zoomToSelection to true. I don't set it to true initially in the chart
        // config because then it won't appear in the URL.
        if (chartProps.type === "LineChart" && this.chartType === "ScatterPlot")
            chartProps.zoomToSelection = true

        chartProps.type = this.chartType

        // When dimensions changes, chart.variableIds change, which calls downloadData(), which reparses variableSet
        chartProps.dimensions = this.dimensions
        chartProps.map.variableId = this.currentYVarId
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
        const win = window as any
        win.covidDataExplorer = this // For debugging
        win.table = this.chart.table // For debugging

        this.bindToWindow()

        this.chart.hideEntityControls = true
        this.chart.externalCsvLink = covidDataPath
        this.chart.url.externalBaseUrl = `${BAKED_BASE_URL}/${covidDashboardSlug}`
        this._updateChart()

        this.observeChartEntitySelection()

        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)

        // call resize for the first time to initialize chart
        this.onResize()
        this.chart.embedExplorerCheckbox = this.controlsToggleElement
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
                    this._updateChart()
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

    @computed get yColumn() {
        return this.chart.table.columnsByOwidVarId.get(this.currentYVarId)!
    }

    @computed get xColumn() {
        return this.chart.table.columnsByOwidVarId.get(this.xVariableId!)!
    }

    @computed get dimensions(): ChartDimension[] {
        if (this.chartType === "LineChart")
            return [
                {
                    property: "y",
                    variableId: this.currentYVarId,
                    display: {
                        // Allow ± 1 day difference in data plotted on bar charts
                        // This is what we use for charts on the Grapher too
                        tolerance: 1,
                        name: this.chartTitle
                    }
                }
            ]

        return [
            {
                property: "y",
                variableId: this.currentYVarId,
                display: {
                    name: this.chartTitle
                }
            },
            {
                property: "x",
                variableId: this.xVariableId!,
                display: {
                    name: this.daysSinceOption.title
                }
            },
            {
                property: "color",
                variableId: 123,
                display: {}
            }
        ]
    }

    @computed private get xVariableId() {
        return this.chartType === "LineChart"
            ? undefined
            : this.daysSinceOption.id
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

    @observable.ref chart: ChartConfig = new ChartConfig(
        {
            slug: covidDashboardSlug,
            type: this.chartType,
            isExplorable: false,
            id: 4128,
            version: 9,
            title: "",
            subtitle: "",
            note: this.note,
            hideTitleAnnotation: true,
            xAxis: {
                scaleType: "linear"
            },
            yAxis: {
                min: 0,
                scaleType: "linear",
                canChangeScaleType: true,
                label: ""
            },
            selectedData: [],
            entitiesAreCountries: true,
            dimensions: [],
            scatterPointLabelStrategy: "y",
            addCountryMode: "add-country",
            stackMode: "absolute",
            useV2: true,
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
                variableId: 123,
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
