import React from "react"
import classnames from "classnames"
import ReactDOM from "react-dom"
import { ChartView } from "charts/ChartView"
import { Bounds } from "charts/Bounds"
import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import {
    computed,
    action,
    observable,
    IReactionDisposer,
    observe,
    Lambda,
    reaction
} from "mobx"
import { observer } from "mobx-react"
import { bind } from "decko"
import { ChartDimension, DimensionSpec } from "../ChartDimension"
import * as urlBinding from "charts/UrlBinding"
import {
    difference,
    pick,
    lastOfNonEmptyArray,
    throttle,
    capitalize,
    mergeQueryStr,
    next,
    previous,
    startCase,
    flatten
} from "charts/Util"
import {
    CovidGrapherRow,
    IntervalOption,
    MetricKind,
    CovidCountryPickerMetric
} from "./CovidTypes"
import {
    ControlOption,
    ExplorerControlPanel,
    DropdownOption,
    ExplorerControlBar
} from "../ExplorerControls"
import {
    CovidQueryParams,
    CovidUrl,
    CovidConstrainedQueryParams
} from "./CovidChartUrl"
import { CountryPicker } from "../CountryPicker"
import {
    fetchAndParseData,
    fetchLastUpdatedTime,
    getLeastUsedColor,
    CovidExplorerTable,
    fetchCovidChartAndVariableMeta,
    buildColumnSlug,
    perCapitaDivisorByMetric
} from "./CovidExplorerTable"
import { BAKED_BASE_URL } from "settings"
import moment from "moment"
import {
    covidDashboardSlug,
    coronaDefaultView,
    covidDataPath,
    sourceCharts,
    metricLabels
} from "./CovidConstants"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ColorScheme, ColorSchemes, continentColors } from "charts/ColorSchemes"
import {
    GlobalEntitySelection,
    GlobalEntitySelectionModes
} from "site/client/global-entity/GlobalEntitySelection"
import { ColorScaleConfigProps } from "charts/ColorScaleConfig"
import * as Mousetrap from "mousetrap"
import { CommandPalette, Command } from "../CommandPalette"
import { TimeBoundValue } from "charts/TimeBounds"
import { Analytics } from "site/client/Analytics"
import { ChartDimensionWithOwidVariable } from "charts/ChartDimensionWithOwidVariable"

const abSeed = Math.random()

interface BootstrapProps {
    containerNode: HTMLElement
    isEmbed?: boolean
    queryStr?: string
    globalEntitySelection?: GlobalEntitySelection
    isExplorerPage?: boolean
}

@observer
export class CovidDataExplorer extends React.Component<{
    data: CovidGrapherRow[]
    params: CovidQueryParams
    covidChartAndVariableMeta: {
        charts: any
        variables: any
    }
    updated: string
    queryStr?: string
    isEmbed?: boolean
    isExplorerPage?: boolean
    globalEntitySelection?: GlobalEntitySelection
    enableKeyboardShortcuts?: boolean
}> {
    static async bootstrap(props: BootstrapProps) {
        const [typedData, updated, covidMeta] = await Promise.all([
            fetchAndParseData(),
            fetchLastUpdatedTime(),
            fetchCovidChartAndVariableMeta()
        ])
        const queryStr =
            props.queryStr && CovidQueryParams.hasAnyCovidParam(props.queryStr)
                ? props.queryStr
                : coronaDefaultView
        const startingParams = new CovidQueryParams(queryStr)
        return ReactDOM.render(
            <CovidDataExplorer
                data={typedData}
                updated={updated}
                params={startingParams}
                covidChartAndVariableMeta={covidMeta}
                queryStr={queryStr}
                isEmbed={props.isEmbed}
                isExplorerPage={props.isExplorerPage}
                globalEntitySelection={props.globalEntitySelection}
                enableKeyboardShortcuts={true}
            />,
            props.containerNode
        )
    }

    private uniqId = Math.random()
        .toString(36)
        .substr(2, 8)

    // Since there can be multiple explorers embedded on a page, we need to use distinct names when
    // creating radio button groups, etc.
    private getScopedName(name: string) {
        return `${name}_${this.uniqId}`
    }

    static async replaceStateAndBootstrap(
        explorerQueryStr: string,
        props: BootstrapProps
    ) {
        const queryStr = mergeQueryStr(explorerQueryStr, props.queryStr)
        window.history.replaceState(
            null,
            document.title,
            `${BAKED_BASE_URL}/${covidDashboardSlug}${queryStr}`
        )
        return CovidDataExplorer.bootstrap({
            ...props,
            queryStr
        })
    }

    @observable private chartContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()

    @action.bound clearSelectionCommand() {
        this.props.params.selectedCountryCodes.clear()
        this.selectionChangeFromBuilder = true
        this.renderControlsThenUpdateChart()
    }

    @action.bound selectAllCommand() {
        const codeMap = this.chart.table.entityNameToCodeMap
        this.countryOptions.forEach(option =>
            this.props.params.selectedCountryCodes.add(codeMap.get(option)!)
        )
        this.selectionChangeFromBuilder = true
        this.renderControlsThenUpdateChart()
    }

    private get metricPicker() {
        const params = this.props.params
        const options: ControlOption[] = [
            {
                available: true,
                label: metricLabels.cases,
                checked: this.constrainedParams.casesMetric,
                value: "cases"
            },
            {
                available: true,
                label: metricLabels.deaths,
                checked: this.constrainedParams.deathsMetric,
                value: "deaths"
            },

            {
                available: true,
                label: metricLabels.case_fatality_rate,
                checked: this.constrainedParams.cfrMetric,
                value: "case_fatality_rate"
            }
        ]

        const optionsColumn2: ControlOption[] = [
            {
                available: true,
                label: metricLabels.tests,
                checked: this.constrainedParams.testsMetric,
                value: "tests"
            },
            {
                available: true,
                label: metricLabels.tests_per_case,
                checked: this.constrainedParams.testsPerCaseMetric,
                value: "tests_per_case"
            },
            {
                available: true,
                label: metricLabels.positive_test_rate,
                checked: this.constrainedParams.positiveTestRate,
                value: "positive_test_rate"
            }
        ]
        return (
            <>
                <ExplorerControlPanel
                    title="Metric"
                    explorerName="covid"
                    name={this.getScopedName("metric")}
                    options={options}
                    onChange={this.changeMetric}
                    isCheckbox={false}
                />
                <ExplorerControlPanel
                    title="Metric"
                    explorerName="covid"
                    hideTitle={true}
                    name={this.getScopedName("metric")}
                    onChange={this.changeMetric}
                    options={optionsColumn2}
                    isCheckbox={false}
                />
            </>
        )
    }

    @action.bound changeMetric(value: string) {
        this.props.params.setMetric(value as MetricKind)
        this.renderControlsThenUpdateChart()
    }

    private get frequencyPicker() {
        const writeableParams = this.props.params
        const { available } = this.constrainedParams
        const options: DropdownOption[] = [
            {
                available: true,
                label: "Cumulative",
                value: "total"
            },
            {
                available: available.smoothed,
                label: "7-day rolling average",
                value: "smoothed"
            },
            {
                available: available.daily,
                label: "New per day",
                value: "daily"
            },
            {
                available: available.weekly,
                label: "Weekly",
                value: "weekly"
            },
            {
                available: available.weekly,
                label: "Weekly change",
                value: "weeklyChange"
            },
            {
                available: available.weekly,
                label: "Biweekly",
                value: "biweekly"
            },
            {
                available: available.weekly,
                label: "Biweekly Change",
                value: "biweeklyChange"
            }
        ]
        return (
            <ExplorerControlPanel
                title="Interval"
                name={this.getScopedName("interval")}
                dropdownOptions={options}
                value={this.constrainedParams.interval}
                options={[]}
                onChange={(value: string) => {
                    writeableParams.setTimeline(value as IntervalOption)
                    this.renderControlsThenUpdateChart()
                }}
                explorerName="covid"
            />
        )
    }

    @computed private get constrainedParams() {
        return this.props.params.constrainedParams
    }

    @computed private get perCapitaPicker() {
        const { available } = this.constrainedParams
        const options: ControlOption[] = [
            {
                available: available.perCapita,
                label: capitalize(this.perCapitaOptions[this.perCapitaDivisor]),
                checked: this.constrainedParams.perCapita,
                value: "true"
            }
        ]
        return (
            <ExplorerControlPanel
                title="Count"
                name={this.getScopedName("count")}
                isCheckbox={true}
                options={options}
                explorerName="covid"
                onChange={value => {
                    this.props.params.perCapita = value === "true"
                    this.renderControlsThenUpdateChart()
                }}
            />
        )
    }

    @computed private get alignedPicker() {
        const { available } = this.constrainedParams
        const options: ControlOption[] = [
            {
                available: available.aligned,
                label: "Align outbreaks",
                checked: this.constrainedParams.aligned,
                value: "true"
            }
        ]
        return (
            <ExplorerControlPanel
                title="Timeline"
                name={this.getScopedName("timeline")}
                isCheckbox={true}
                options={options}
                onChange={value => {
                    this.props.params.aligned = value === "true"
                    this.renderControlsThenUpdateChart()
                }}
                comment={this.constrainedParams.trajectoryColumnOption.name}
                explorerName="covid"
            />
        )
    }

    @action.bound toggleSelectedCountry(code: string, value?: boolean) {
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

    @action.bound toggleSelectedCountryCommand(
        countryName: string,
        value?: boolean
    ) {
        const codeMap = this.chart.table.entityNameToCodeMap
        this.toggleSelectedCountry(codeMap.get(countryName)!, value)
        this.selectionChangeFromBuilder = true
        this.renderControlsThenUpdateChart()
    }

    @computed get howLongAgo() {
        return moment.utc(this.props.updated).fromNow()
    }

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
                explorerName="Covid"
                table={this.chart.table}
                pickerColumns={new Set(Object.keys(CovidCountryPickerMetric))}
                isDropdownMenu={this.isMobile}
                optionColorMap={this.countryNameToColorMap}
                selectedCountries={this.selectedEntityNames}
                userState={this.props.params}
                activeColumnSlugs={this.activeColumnSlugs}
                clearSelectionCommand={this.clearSelectionCommand}
                toggleCountryCommand={this.toggleSelectedCountryCommand}
            ></CountryPicker>
        )
    }

    @computed get activeColumnSlugs(): string[] {
        return [this.xColumn?.slug, this.yColumn?.slug].filter(
            i => i
        ) as string[]
    }

    @action.bound changePickerMetric(metric: CovidCountryPickerMetric) {
        this.props.params.countryPickerMetric = metric
    }

    get controlBar() {
        return (
            <ExplorerControlBar
                isMobile={this.isMobile}
                showControls={this.showMobileControlsPopup}
                closeControls={this.closeControls}
            >
                {this.metricPicker}
                {this.frequencyPicker}
                {this.perCapitaPicker}
                {this.alignedPicker}
            </ExplorerControlBar>
        )
    }

    @action.bound closeControls() {
        this.showMobileControlsPopup = false
    }

    @action.bound toggleMobileControls() {
        this.showMobileControlsPopup = !this.showMobileControlsPopup
    }

    @observable showMobileControlsPopup = false

    get customizeChartMobileButton() {
        // A/B Test.
        const buttonLabel = abSeed > 0.5 ? `Customize chart` : `Change metric`
        return this.isMobile ? (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.toggleMobileControls}
                data-track-note="covid-customize-chart"
            >
                <FontAwesomeIcon icon={faChartLine} /> {buttonLabel}
            </a>
        ) : (
            undefined
        )
    }

    render() {
        return (
            <>
                <CommandPalette
                    commands={this.keyboardShortcuts}
                    display="none"
                />
                <div
                    className={classnames({
                        CovidDataExplorer: true,
                        "mobile-explorer": this.isMobile,
                        HideControls: !this.showExplorerControls,
                        "is-embed": this.props.isEmbed
                    })}
                >
                    {this.showExplorerControls && this.header}
                    {this.showExplorerControls && this.controlBar}
                    {this.showExplorerControls && this.countryPicker}
                    {this.showExplorerControls &&
                        this.customizeChartMobileButton}
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

    @computed get showExplorerControls() {
        return !this.props.params.hideControls || !this.props.isEmbed
    }

    @computed get countryOptions(): string[] {
        return this.chart.table.availableEntities
    }

    @computed get selectedCountryOptions(): string[] {
        const codeMap = this.chart.table.entityNameToCodeMap
        return this.countryOptions.filter(option =>
            this.props.params.selectedCountryCodes.has(codeMap.get(option)!)
        )
    }

    @computed private get perCapitaDivisor() {
        return perCapitaDivisorByMetric(this.constrainedParams.metricName)
    }

    @computed private get perCapitaOptions() {
        return {
            1: "",
            1e3: "per 1,000 people",
            1e6: "per million people"
        }
    }

    private perCapitaTitle(metric: MetricKind) {
        return this.constrainedParams.perCapita
            ? " " + this.perCapitaOptions[perCapitaDivisorByMetric(metric)]
            : ""
    }

    @computed private get chartTitle() {
        let title = ""
        const params = this.constrainedParams
        const interval = params.interval

        if (params.yColumn || params.xColumn)
            return startCase(`${this.yColumn.name} by ${this.xColumn?.name}`)

        const isCumulative = interval === "total"
        const freq = params.intervalTitle
        if (params.cfrMetric)
            title = `Case fatality rate of the ongoing COVID-19 pandemic`
        else if (params.positiveTestRate)
            title = `The share of ${
                isCumulative ? "" : "daily "
            }COVID-19 tests that are positive`
        else if (params.testsPerCaseMetric)
            title = `${
                isCumulative ? `Cumulative tests` : `Tests`
            } conducted per confirmed case of COVID-19`
        else if (params.testsMetric) title = `${freq} COVID-19 tests`
        else if (params.deathsMetric)
            title = `${freq} confirmed COVID-19 deaths`
        else if (params.casesMetric) title = `${freq} confirmed COVID-19 cases`

        return title + this.perCapitaTitle(params.metricName)
    }

    @computed private get weekSubtitle() {
        const params = this.constrainedParams
        const metric = params.deathsMetric ? "deaths" : "cases"

        if (params.interval === "weekly")
            return `Weekly confirmed ${metric} refer to the cumulative number of confirmed ${metric} over the previous week.`
        if (params.interval === "biweekly")
            return `Biweekly confirmed ${metric} refer to the cumulative number of confirmed ${metric} over the previous two weeks.`
        if (params.interval === "weeklyChange")
            return `The weekly growth rate on any given date measures the percentage change in number of confirmed ${metric} over the last seven days relative to the number in the previous seven days.`
        if (params.interval === "biweeklyChange")
            return `The biweekly growth rate on any given date measures the percentage change in the number of new confirmed ${metric} over the last 14 days relative to the number in the previous 14 days.`

        console.log("Error generating subtitle")
        return ""
    }

    @computed private get subtitle() {
        const params = this.constrainedParams
        if (params.yColumn || params.xColumn) return ""

        if (params.isWeekly || params.isBiweekly) return this.weekSubtitle

        const smoothing = params.smoothing
            ? `Shown is the rolling ${params.smoothing}-day average. `
            : ""
        return `${smoothing}${this.yColumn?.description || ""}`
    }

    @computed get note() {
        const params = this.constrainedParams

        if (params.yColumn || params.xColumn) return ""

        if (params.testsMetric)
            return "For testing figures, there are substantial differences across countries in terms of the units, whether or not all labs are included, the extent to which negative and pending tests are included and other aspects. Details for each country can be found on ourworldindata.org/covid-testing."
        return ""
    }

    @computed private get selectedData() {
        const countryCodeMap = this.chart.table.entityCodeToNameMap
        const entityIdMap = this.chart.table.entityNameToIdMap
        return Array.from(this.props.params.selectedCountryCodes)
            .map(code => countryCodeMap.get(code))
            .filter(i => i)
            .map(countryOption => {
                return {
                    index: 0,
                    entityId: countryOption
                        ? entityIdMap.get(countryOption)!
                        : 0,
                    color: this.countryNameToColorMap[countryOption!]
                }
            })
    }

    private _countryNameToColorMapCache: {
        [key: string]: string | undefined
    } = {}

    @computed get countryNameToColorMap(): {
        [key: string]: string | undefined
    } {
        const names = this.selectedCountryOptions.map(country => country)
        // If there isn't a color for every country name, we need to update the color map
        if (!names.every(name => name in this._countryNameToColorMapCache)) {
            // Omit any unselected country names from color map
            const newColorMap = pick(this._countryNameToColorMapCache, names)
            // Check for name *key* existence, not value.
            // `undefined` value means we want the color to be automatic, determined by the chart.
            const namesWithoutColor = names.filter(
                name => !(name in newColorMap)
            )
            // For names that don't have a color, assign one.
            namesWithoutColor.forEach(name => {
                const scheme = ColorSchemes["owid-distinct"] as ColorScheme
                const availableColors = lastOfNonEmptyArray(scheme.colorSets)
                const usedColors = Object.values(newColorMap).filter(
                    color => color !== undefined
                ) as string[]
                newColorMap[name] = getLeastUsedColor(
                    availableColors,
                    usedColors
                )
            })
            // Update the country color map cache
            this._countryNameToColorMapCache = newColorMap
        }

        return this._countryNameToColorMapCache
    }

    private selectionChangeFromBuilder = false
    private renderControlsThenUpdateChart() {
        // Updating the chart may take a second so render the Data Explorer controls immediately then the chart.
        setTimeout(() => {
            this.selectionChangeFromBuilder = true
            this._updateChart()
        }, 1)
    }

    private _covidExplorerTable?: CovidExplorerTable
    get covidExplorerTable() {
        if (!this._covidExplorerTable) {
            this._covidExplorerTable = new CovidExplorerTable(
                this.chart.table,
                this.props.data,
                this.props.covidChartAndVariableMeta.variables,
                this.props.isExplorerPage
            )
        }
        return this._covidExplorerTable
    }

    @computed get selectedEntityNames(): string[] {
        const entityCodeMap = this.chart.table.entityCodeToNameMap
        return Array.from(this.props.params.selectedCountryCodes.values())
            .map(code => entityCodeMap.get(code))
            .filter(i => i) as string[]
    }

    @computed get canDoLogScale() {
        if (
            this.constrainedParams.positiveTestRate ||
            this.constrainedParams.cfrMetric ||
            (this.constrainedParams.intervalChange &&
                this.constrainedParams.intervalChange > 1)
        )
            return false
        return true
    }

    private switchBackToLog = false

    // We can't create a new chart object with every radio change because the Chart component itself
    // maintains state (for example, which tab is currently active). Temporary workaround is just to
    // manually update the chart when the chart builderselections change.
    // todo: cleanup
    @action.bound private _updateChart() {
        const params = this.constrainedParams
        const { covidExplorerTable } = this

        covidExplorerTable.initRequestedColumns(params)

        // Init column for epi color strategy if needed
        if (params.colorStrategy === "ptr")
            this.shortTermPositivityRateVarId = this.covidExplorerTable.initAndGetShortTermPositivityRateVarId()

        const chartProps = this.chart.props
        chartProps.title = this.chartTitle
        chartProps.subtitle = this.subtitle
        chartProps.note = this.note

        // If we switch to scatter, set zoomToSelection to true. I don't set it to true initially in the chart
        // config because then it won't appear in the URL.
        if (chartProps.type === "LineChart" && params.type === "ScatterPlot")
            chartProps.zoomToSelection = true

        chartProps.type = params.type
        chartProps.yAxis.label = this.yAxisLabel

        if (!this.canDoLogScale) {
            this.switchBackToLog = chartProps.yAxis.scaleType === "log"
            chartProps.yAxis.scaleType = "linear"
            chartProps.yAxis.canChangeScaleType = undefined
        } else {
            chartProps.yAxis.canChangeScaleType = true
            if (this.switchBackToLog) {
                chartProps.yAxis.scaleType = "log"
                this.switchBackToLog = false
            }
        }

        chartProps.yAxis.min = params.intervalChange ? undefined : 0

        // When dimensions changes, chart.variableIds change, which calls downloadData(), which reparses variableSet
        chartProps.dimensions = this.dimensionSpecs.map(
            spec => new ChartDimension(spec)
        )

        // multimetric table
        if (this.constrainedParams.tableMetrics) {
            this._generateDataTableColumnsInTable()
            this._addDataTableOnlyDimensionsToChart()
        }

        covidExplorerTable.table.setSelectedEntities(this.selectedEntityNames)

        if (
            (params.casesMetric || params.deathsMetric) &&
            !(params.interval === "total") &&
            !params.intervalChange
        )
            covidExplorerTable.addNegativeFilterColumn(params.yColumnSlug)
        else covidExplorerTable.removeNegativeFilterColumn()

        // Do not show unselected groups on scatterplots
        if (params.type === "ScatterPlot")
            covidExplorerTable.addGroupFilterColumn()
        else covidExplorerTable.removeGroupFilterColumn()

        this._updateMap()
        this._updateColorScale()

        chartProps.id = this.sourceChartId
        chartProps.selectedData = this.selectedData
        this.chart.url.externallyProvidedParams = this.props.params.toParams
    }

    private _updateColorScale() {
        const chartProps = this.chart.props
        chartProps.colorScale = this.colorScales[
            this.constrainedParams.colorStrategy
        ]
    }

    @computed get sourceChartId(): number {
        return (sourceCharts as any)[this.constrainedParams.sourceChartKey]
    }

    @computed get sourceChart(): ChartConfigProps | undefined {
        return this.props.covidChartAndVariableMeta.charts[this.sourceChartId]
    }

    private _updateMap() {
        const chartProps = this.chart.props

        Object.assign(
            chartProps.map,
            this.sourceChart?.map || this.defaultMapConfig
        )

        chartProps.map.targetYear = undefined
        chartProps.map.variableId = this.yColumn.spec.owidVariableId
    }

    componentDidMount() {
        // Show 'Add country' & 'Select countries' controls if the explorer controls are hidden.
        this.chart.hideEntityControls = this.showExplorerControls
        this.chart.externalCsvLink = covidDataPath
        this.chart.url.externalBaseUrl = `${BAKED_BASE_URL}/${covidDashboardSlug}`
        this._updateChart()

        this.observeChartEntitySelection()
        this.observeGlobalEntitySelection()

        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)

        // call resize for the first time to initialize chart
        this.onResize()
        this.chart.embedExplorerCheckbox = this.controlsToggleElement
        ;(window as any).covidDataExplorer = this

        if (this.props.enableKeyboardShortcuts)
            this.keyboardShortcuts.forEach(shortcut => {
                Mousetrap.bind(shortcut.combo, () => {
                    shortcut.fn()
                    Analytics.logKeyboardShortcut(
                        shortcut.title,
                        shortcut.combo
                    )
                })
            })
    }

    @action.bound playDefaultViewCommand() {
        const props = this.chart.props
        props.tab = "chart"
        props.xAxis.scaleType = "linear"
        props.yAxis.scaleType = "log"
        this.chart.timeDomain = [
            TimeBoundValue.unboundedLeft,
            TimeBoundValue.unboundedRight
        ]
        this.props.params.setParamsFromQueryString(coronaDefaultView)
        this.renderControlsThenUpdateChart()
    }

    @action.bound toggleTabCommand() {
        this.chart.props.tab = next(
            ["chart", "map", "table"],
            this.chart.props.tab
        )
    }

    @action.bound toggleKeyboardHelpCommand() {
        const element = document.getElementsByClassName(
            "CommandPalette"
        )[0] as HTMLElement
        element.style.display =
            element.style.display === "none" ? "block" : "none"
    }

    get keyboardShortcuts(): Command[] {
        return [
            {
                combo: "h",
                fn: () => this.playDefaultViewCommand(),
                title: "Default view",
                category: "Browse"
            },
            {
                combo: "right",
                fn: () => this.playIndexCommand(++this.currentIndex),
                title: "Next view",
                category: "Browse"
            },
            {
                combo: "left",
                fn: () => this.playIndexCommand(--this.currentIndex),
                title: "Previous view",
                category: "Browse"
            },
            {
                combo: "t",
                fn: () => this.toggleTabCommand(),
                title: "Toggle tab",
                category: "Navigation"
            },
            {
                combo: "?",
                fn: () => this.toggleKeyboardHelpCommand(),
                title: "Toggle Help",
                category: "Navigation"
            },
            {
                combo: "a",
                fn: () =>
                    this.selectedData.length
                        ? this.clearSelectionCommand()
                        : this.selectAllCommand(),
                title: "Select/Deselect all",
                category: "Selection"
            },
            {
                combo: "f",
                fn: () => this.toggleFilterAllCommand(),
                title: "Hide unselected",
                category: "Selection"
            },
            {
                combo: "c",
                fn: () => this.toggleColorStrategyCommand(),
                title: "Change line colors",
                category: "Chart"
            },
            {
                combo: "l",
                fn: () => this.toggleYScaleTypeCommand(),
                title: "Toggle Y log/linear",
                category: "Chart"
            },
            {
                combo: "z",
                fn: () => this.toggleTimelineCommand(),
                title: "Latest/Earliest/All period",
                category: "Timeline"
            },
            {
                combo: "p",
                fn: () => this.togglePlayingCommand(),
                title: "Play/Pause",
                category: "Timeline"
            }
        ]
    }

    @action.bound toggleYScaleTypeCommand() {
        this.chart.props.yAxis.scaleType = next(
            ["linear", "log"],
            this.chart.props.yAxis.scaleType
        )
    }

    @action.bound toggleTimelineCommand() {
        // Todo: add tests for this
        this.chart.url.setTimeFromTimeQueryParam(
            next(["latest", "earliest", ".."], this.chart.url.timeParam!)
        )
        this.renderControlsThenUpdateChart()
    }

    @action.bound toggleColorStrategyCommand() {
        this.props.params.colorScale = next(
            ["continents", "ptr", "none"],
            this.props.params.colorScale
        )
        this.renderControlsThenUpdateChart()
    }

    @action.bound toggleFilterAllCommand() {
        this.chart.props.minPopulationFilter =
            this.chart.props.minPopulationFilter === 2e9 ? undefined : 2e9
        this.renderControlsThenUpdateChart()
    }

    @action.bound togglePlayingCommand() {
        this.chart.isPlaying = !this.chart.isPlaying
    }

    @action.bound toggleDimensionColumnCommand(
        axis: "y" | "x" | "size",
        backwards = false
    ) {
        const key = `${axis}Column`
        const params = this.props.params as any
        const fn = backwards ? previous : next
        params[key] = fn(
            this.covidExplorerTable.table.numericColumnSlugs,
            params[key]
        )
        this.renderControlsThenUpdateChart()
    }

    componentWillUnmount() {
        if (this.onResizeThrottled) {
            window.removeEventListener("resize", this.onResizeThrottled)
        }
    }

    private currentIndex = -1
    @action.bound playIndexCommand(index: number) {
        const combos = this.constrainedParams.allAvailableCombos()
        index = index >= combos.length ? index - combos.length : index
        index = index < 0 ? combos.length + index : index
        const combo = combos[index]
        this.props.params.setParamsFromQueryString(combo)
        this.renderControlsThenUpdateChart()
    }

    onResizeThrottled?: () => void

    // todo: remove
    private observeChartEntitySelection() {
        this.disposers.push(
            observe(this.chart.data, "selectedEntityCodes", change => {
                // Ignore the change if it was triggered by the chart builder,
                // but do not ignore subsequent changes.
                if (this.selectionChangeFromBuilder) {
                    this.selectionChangeFromBuilder = false
                    return
                }
                const newCodes = change.newValue
                const oldCodes = change.oldValue ?? []

                if (newCodes.join(" ") === oldCodes.join(" ")) return

                // We want to find the added/removed entities based on the chart selection, not
                // taking the explorer selection into account. This is because there can be
                // entities excluded in the chart selection because we have no data for them,
                // but which may be selected in the explorer.
                const added = difference(newCodes, oldCodes)
                const removed = difference(oldCodes, newCodes)
                added.forEach(code => this.toggleSelectedCountry(code, true))
                removed.forEach(code => this.toggleSelectedCountry(code, false))
                // Trigger an update in order to apply color changes
                this._updateChart()
            })
        )
    }

    private observeGlobalEntitySelection() {
        const { globalEntitySelection } = this.props
        if (globalEntitySelection) {
            this.disposers.push(
                reaction(
                    () => [
                        globalEntitySelection.mode,
                        globalEntitySelection.selectedEntities
                    ],
                    () => {
                        const { mode, selectedEntities } = globalEntitySelection
                        if (mode === GlobalEntitySelectionModes.override) {
                            this.props.params.selectedCountryCodes = new Set(
                                selectedEntities.map(entity => entity.code)
                            )
                            this.renderControlsThenUpdateChart()
                        }
                    },
                    { fireImmediately: true }
                )
            )
        }
    }

    // Binds chart properties to global window title and URL. This should only
    // ever be invoked from top-level JavaScript.
    bindToWindow() {
        const url = new CovidUrl(this.chart.url, this.props.params)
        urlBinding.bindUrlToWindow(url)
    }

    disposers: (IReactionDisposer | Lambda)[] = []

    @bind dispose() {
        this.disposers.forEach(dispose => dispose())
    }

    @computed private get yColumn() {
        return this.chart.table.columnsBySlug.get(
            this.constrainedParams.yColumnSlug
        )!
    }

    @computed private get xColumn() {
        return this.constrainedParams.xColumnSlug
            ? this.chart.table.columnsBySlug.get(
                  this.constrainedParams.xColumnSlug!
              )!
            : undefined
    }

    @computed private get sizeColumn() {
        return this.constrainedParams.sizeColumn
            ? this.chart.table.columnsBySlug.get(
                  this.constrainedParams.sizeColumn!
              )!
            : undefined
    }

    private _buildDataTableOnlyDimensionSpec = (
        metric: MetricKind,
        interval: IntervalOption
    ) => {
        const colSlug = buildColumnSlug(
            metric,
            this.constrainedParams.perCapita && isCountMetric(metric)
                ? perCapitaDivisorByMetric(metric)
                : 1,
            interval,
            0
        )

        const column = this.chart.table.columnsBySlug.get(colSlug)
        return {
            property: "table",
            variableId: column?.spec.owidVariableId,
            display: {
                tolerance: 2,
                name:
                    metricLabels[metric] +
                    (isCountMetric(metric) ? this.perCapitaTitle(metric) : ""),
                unit: interval === "daily" ? "daily new" : "cumulative",
                tableDisplay: column?.display.tableDisplay
            }
        } as DimensionSpec
    }

    @computed private get dataTableOnlyDimensions(): DimensionSpec[] {
        const params = this.constrainedParams
        return flatten(
            params.tableMetrics?.map(metric => {
                const specs = [
                    this._buildDataTableOnlyDimensionSpec(metric, "total")
                ]

                if (isCountMetric(metric)) {
                    // add daily column
                    specs.push(
                        this._buildDataTableOnlyDimensionSpec(metric, "daily")
                    )
                }

                return specs
            })
        )
    }

    @action private _generateDataTableColumnsInTable() {
        const params = this.constrainedParams
        const { covidExplorerTable } = this

        const dataTableParams = new CovidConstrainedQueryParams("")

        params.tableMetrics?.forEach(metric => {
            dataTableParams.setMetric(metric)
            dataTableParams.interval = "total"
            dataTableParams.perCapita = false
            if (isCountMetric(metric)) {
                dataTableParams.perCapita = params.perCapita
                covidExplorerTable.initRequestedColumns(dataTableParams)
                // generate daily columns too
                dataTableParams.interval = "daily"
            }

            covidExplorerTable.initRequestedColumns(dataTableParams)
        })
    }

    @action private _addDataTableOnlyDimensionsToChart() {
        this.chart.dataTableOnlyDimensions = this.dataTableOnlyDimensions.map(
            (dimSpec, index) =>
                new ChartDimensionWithOwidVariable(
                    index,
                    new ChartDimension(dimSpec),
                    this.chart.table.columnsByOwidVarId.get(dimSpec.variableId)!
                )
        )
    }

    @computed private get yDimension(): DimensionSpec {
        const yColumn = this.yColumn
        const unit = this.constrainedParams.isWeeklyOrBiweeklyChange
            ? "%"
            : undefined

        return {
            property: "y",
            variableId: yColumn.spec.owidVariableId!,
            display: {
                // Allow ± 1 day difference in data plotted on bar charts
                // This is what we use for charts on the Grapher too
                tolerance: 1,
                unit,
                name: this.chartTitle,
                tableDisplay: yColumn.display.tableDisplay
            }
        }
    }

    @computed private get xDimension(): DimensionSpec {
        const xColumn = this.xColumn!
        return {
            property: "x",
            variableId: xColumn.spec.owidVariableId!,
            display: {
                name: xColumn.spec.name,
                tableDisplay: xColumn.display.tableDisplay
            }
        }
    }

    @computed private get dimensionSpecs(): DimensionSpec[] {
        if (this.constrainedParams.type !== "ScatterPlot")
            return [this.yDimension]

        const dimensions = [this.yDimension, this.xDimension]

        if (this.constrainedParams.colorStrategy !== "none")
            dimensions.push(this.colorDimension)
        if (this.sizeColumn) dimensions.push(this.sizeDimension)
        return dimensions
    }

    @computed private get sizeDimension(): DimensionSpec {
        return {
            property: "size",
            variableId: this.sizeColumn?.spec.owidVariableId!
        }
    }

    private shortTermPositivityRateVarId: number = 0
    @computed private get colorDimension(): DimensionSpec {
        const variableId =
            this.constrainedParams.colorStrategy === "continents"
                ? 123
                : this.shortTermPositivityRateVarId

        return {
            property: "color",
            variableId,
            display: {
                tolerance: 10
            }
        }
    }

    @computed private get colorScales(): {
        [name: string]: ColorScaleConfigProps
    } {
        return {
            ptr: this.props.covidChartAndVariableMeta.charts[sourceCharts.epi]
                ?.colorScale as any,
            continents: {
                legendDescription: "Continent",
                baseColorScheme: undefined,
                colorSchemeValues: [],
                colorSchemeLabels: [],
                customNumericColors: [],
                customCategoryColors: continentColors,
                customCategoryLabels: {
                    "No data": "Other"
                },
                customHiddenCategories: {}
            },
            none: {
                legendDescription: "",
                baseColorScheme: undefined,
                colorSchemeValues: [],
                colorSchemeLabels: [],
                customNumericColors: [],
                customCategoryColors: continentColors,
                customCategoryLabels: {
                    "No data": ""
                },
                customHiddenCategories: {}
            }
        }
    }

    private defaultMapConfig() {
        return {
            variableId: 123,
            timeTolerance: 7,
            projection: "World",
            colorScale: {
                colorSchemeValues: [],
                colorSchemeLabels: [],
                customNumericColors: [],
                customCategoryColors: {},
                customCategoryLabels: {},
                customHiddenCategories: {}
            }
        }
    }

    @computed private get yAxisLabel() {
        return this.constrainedParams.yColumn
            ? this.constrainedParams.yColumnSlug
            : ""
    }

    @observable.ref chart: ChartConfig = new ChartConfig(
        {
            slug: covidDashboardSlug,
            type: this.constrainedParams.type,
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
                removePointsOutsideDomain: true,
                scaleType: "linear",
                canChangeScaleType: true,
                label: this.yAxisLabel
            },
            selectedData: [],
            dimensions: [],
            scatterPointLabelStrategy: "y",
            addCountryMode: "add-country",
            stackMode: "absolute",
            useV2: true,
            colorScale: this.colorScales.continents,
            hideRelativeToggle: true,
            hasChartTab: true,
            hasMapTab: true,
            tab: "chart",
            isPublished: true,
            map: this.defaultMapConfig as any,
            data: {
                availableEntities: this.countryOptions
            }
        },
        {
            queryStr: this.props.queryStr
        }
    )
}

function isCountMetric(metric: MetricKind) {
    return metric === "deaths" || metric === "cases" || metric === "tests"
}
