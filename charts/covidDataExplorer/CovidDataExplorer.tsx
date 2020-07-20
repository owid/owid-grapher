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
    chartToExplorerQueryStr
} from "charts/Util"
import { CountryOption, CovidGrapherRow } from "./CovidTypes"
import { ControlOption, ExplorerControl } from "./CovidExplorerControl"
import { CountryPicker } from "./CovidCountryPicker"
import { CovidQueryParams, CovidUrl } from "./CovidChartUrl"
import {
    fetchAndParseData,
    fetchLastUpdatedTime,
    getLeastUsedColor,
    CovidExplorerTable,
    fetchCovidChartAndVariableMeta
} from "./CovidExplorerTable"
import { BAKED_BASE_URL } from "settings"
import moment from "moment"
import {
    covidDashboardSlug,
    coronaDefaultView,
    covidDataPath,
    sourceCharts
} from "./CovidConstants"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ColorScheme, ColorSchemes, continentColors } from "charts/ColorSchemes"
import {
    GlobalEntitySelection,
    GlobalEntitySelectionModes
} from "site/client/global-entity/GlobalEntitySelection"
import { entityCode } from "charts/owidData/OwidTable"
import { ColorScaleConfigProps } from "charts/ColorScaleConfig"
import * as Mousetrap from "mousetrap"

const abSeed = Math.random()

interface BootstrapProps {
    containerNode: HTMLElement
    isEmbed?: boolean
    queryStr?: string
    globalEntitySelection?: GlobalEntitySelection
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
    globalEntitySelection?: GlobalEntitySelection
}> {
    static async bootstrap(props: BootstrapProps) {
        const [typedData, updated, covidMeta] = await Promise.all([
            fetchAndParseData(),
            fetchLastUpdatedTime(),
            fetchCovidChartAndVariableMeta()
        ])
        const queryStr = props.queryStr || coronaDefaultView
        const startingParams = new CovidQueryParams(queryStr)
        return ReactDOM.render(
            <CovidDataExplorer
                data={typedData}
                updated={updated}
                params={startingParams}
                covidChartAndVariableMeta={covidMeta}
                queryStr={queryStr}
                isEmbed={props.isEmbed}
                globalEntitySelection={props.globalEntitySelection}
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
        const queryStr = chartToExplorerQueryStr(
            explorerQueryStr,
            props.queryStr
        )
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
        this.countryOptions.forEach(option =>
            this.props.params.selectedCountryCodes.add(option.code)
        )
    }

    private get metricPicker() {
        const params = this.props.params
        const options: ControlOption[] = [
            {
                available: true,
                label: "Confirmed cases",
                checked: this.constrainedParams.casesMetric,
                onChange: value => {
                    params.setMetric("cases")
                    this.renderControlsThenUpdateChart()
                }
            },
            {
                available: true,
                label: "Confirmed deaths",
                checked: this.constrainedParams.deathsMetric,
                onChange: value => {
                    params.setMetric("deaths")
                    this.renderControlsThenUpdateChart()
                }
            },

            {
                available: true,
                label: "Case fatality rate",
                checked: this.constrainedParams.cfrMetric,
                onChange: value => {
                    params.setMetric("case_fatality_rate")
                    this.renderControlsThenUpdateChart()
                }
            }
        ]

        const optionsColumn2: ControlOption[] = [
            {
                available: true,
                label: "Tests",
                checked: this.constrainedParams.testsMetric,
                onChange: value => {
                    params.setMetric("tests")
                    this.renderControlsThenUpdateChart()
                }
            },
            {
                available: true,
                label: "Tests per confirmed case",
                checked: this.constrainedParams.testsPerCaseMetric,
                onChange: value => {
                    params.setMetric("tests_per_case")
                    this.renderControlsThenUpdateChart()
                }
            },
            {
                available: true,
                label: "Share of positive tests",
                checked: this.constrainedParams.positiveTestRate,
                onChange: value => {
                    params.setMetric("positive_test_rate")
                    this.renderControlsThenUpdateChart()
                }
            }
        ]
        return (
            <>
                <ExplorerControl
                    title="Metric"
                    name={this.getScopedName("metric")}
                    options={options}
                    isCheckbox={false}
                ></ExplorerControl>
                <ExplorerControl
                    title="Metric"
                    hideTitle={true}
                    name={this.getScopedName("metric")}
                    options={optionsColumn2}
                    isCheckbox={false}
                ></ExplorerControl>
            </>
        )
    }

    private get frequencyPicker() {
        const params = this.props.params
        const options: ControlOption[] = [
            {
                available: true,
                label: "Cumulative",
                checked: this.constrainedParams.totalFreq,
                onChange: () => {
                    params.setTimeline("total")
                    this.renderControlsThenUpdateChart()
                }
            },
            {
                available: this.constrainedParams.available.smoothing,
                label: "7-day rolling average",
                checked: this.constrainedParams.smoothing === 7,
                onChange: () => {
                    params.setTimeline("smoothed")
                    this.renderControlsThenUpdateChart()
                }
            },
            {
                available: this.constrainedParams.available.dailyFreq,
                label: "New per day",
                checked:
                    this.constrainedParams.dailyFreq &&
                    this.constrainedParams.smoothing === 0,
                onChange: () => {
                    params.setTimeline("daily")
                    this.renderControlsThenUpdateChart()
                }
            }
        ]
        return (
            <ExplorerControl
                title="Interval"
                name={this.getScopedName("interval")}
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
                    this.renderControlsThenUpdateChart()
                }
            }
        ]
        return (
            <ExplorerControl
                title="Count"
                name={this.getScopedName("count")}
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
                    this.renderControlsThenUpdateChart()
                }
            }
        ]
        return (
            <ExplorerControl
                title="Timeline"
                name={this.getScopedName("timeline")}
                isCheckbox={true}
                options={options}
                comment={this.constrainedParams.trajectoryColumnOption.name}
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
        this.selectionChangeFromBuilder = true
        this.renderControlsThenUpdateChart()
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
        const showControls =
            !this.props.params.hideControls || !this.props.isEmbed
        return (
            <>
                <div
                    className={classnames({
                        CovidDataExplorer: true,
                        "mobile-explorer": this.isMobile,
                        HideControls: !showControls,
                        "is-embed": this.props.isEmbed
                    })}
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
        return CovidExplorerTable.makeCountryOptions(this.props.data)
    }

    @computed get selectedCountryOptions(): CountryOption[] {
        return this.countryOptions.filter(option =>
            this.props.params.selectedCountryCodes.has(option.code)
        )
    }

    @computed private get availableEntities() {
        return this.countryOptions.map(country => country.name)
    }

    @computed private get perCapitaDivisor() {
        if (this.constrainedParams.testsMetric) return 1e3
        return 1e6
    }

    @computed private get perCapitaOptions() {
        return {
            1: "",
            1e3: "per 1,000 people",
            1e6: "per million people"
        }
    }

    @computed private get perCapitaTitle() {
        return this.constrainedParams.perCapita
            ? " " + this.perCapitaOptions[this.perCapitaDivisor]
            : ""
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
        return `${smoothing}${this.yColumn?.description || ""}`
    }

    @computed get note() {
        const params = this.constrainedParams
        if (params.testsMetric)
            return "For testing figures, there are substantial differences across countries in terms of the units, whether or not all labs are included, the extent to which negative and pending tests are included and other aspects. Details for each country can be found on ourworldindata.org/covid-testing."
        return ""
    }

    @computed private get selectedData() {
        const countryCodeMap = this.countryCodeToCountryOptionMap
        return Array.from(this.props.params.selectedCountryCodes).map(code => {
            const countryOption = countryCodeMap.get(code)
            return {
                index: 0,
                entityId: countryOption ? countryOption.entityId : 0,
                color: this.countryCodeToColorMap[code]
            }
        })
    }

    @computed private get countryCodeToCountryOptionMap() {
        const countryCodeMap = new Map<entityCode, CountryOption>()
        this.countryOptions.forEach(country => {
            countryCodeMap.set(country.code, country)
        })
        return countryCodeMap
    }

    @computed get availableCountriesForMetric() {
        if (this.xColumn && this.yColumn)
            return new Set(
                [...this.xColumn.entityNamesUniq].filter(entityName =>
                    this.yColumn.entityNamesUniq.has(entityName)
                )
            )
        else if (this.yColumn) return this.yColumn.entityNamesUniq
        return new Set()
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

    private selectionChangeFromBuilder = false
    private renderControlsThenUpdateChart() {
        // Updating the chart may take a second so render the Data Explorer controls immediately then the chart.
        setTimeout(() => {
            this.selectionChangeFromBuilder = true
            this._updateChart()
        }, 1)
    }

    private _covidExplorerTable?: CovidExplorerTable
    @computed get covidExplorerTable() {
        if (!this._covidExplorerTable)
            this._covidExplorerTable = new CovidExplorerTable(
                this.chart.table,
                this.props.data,
                this.props.covidChartAndVariableMeta.variables
            )
        return this._covidExplorerTable
    }

    private getSelectedEntityNames() {
        return Array.from(this.props.params.selectedCountryCodes.values())
            .map(code => this.countryCodeToCountryOptionMap.get(code))
            .filter(i => i)
            .map(option => option!.name)
    }

    // We can't create a new chart object with every radio change because the Chart component itself
    // maintains state (for example, which tab is currently active). Temporary workaround is just to
    // manually update the chart when the chart builderselections change.
    // todo: cleanup
    @action.bound private _updateChart() {
        const params = this.constrainedParams
        const { covidExplorerTable } = this
        covidExplorerTable.initRequestedColumns(params)
        const chartProps = this.chart.props
        chartProps.title = this.chartTitle
        chartProps.subtitle = this.subtitle
        chartProps.note = this.note

        // If we switch to scatter, set zoomToSelection to true. I don't set it to true initially in the chart
        // config because then it won't appear in the URL.
        if (
            chartProps.type === "LineChart" &&
            params.chartType === "ScatterPlot"
        )
            chartProps.zoomToSelection = true

        chartProps.type = params.chartType

        // When dimensions changes, chart.variableIds change, which calls downloadData(), which reparses variableSet
        chartProps.dimensions = this.dimensionSpecs.map(
            spec => new ChartDimension(spec)
        )

        covidExplorerTable.table.setSelectedEntities(
            this.getSelectedEntityNames()
        )

        if ((params.casesMetric || params.deathsMetric) && !params.totalFreq)
            covidExplorerTable.addNegativeFilterColumn(params.yColumnSlug)
        else covidExplorerTable.removeNegativeFilterColumn()

        // Do not show unselected groups on scatterplots
        if (params.chartType === "ScatterPlot")
            covidExplorerTable.addGroupFilterColumn()
        else covidExplorerTable.removeGroupFilterColumn()

        this._updateMap()
        this._updateColorScale()

        chartProps.selectedData = this.selectedData
        this.chart.url.externallyProvidedParams = this.props.params.toParams
    }

    private _updateColorScale() {
        const chartProps = this.chart.props
        const params = this.constrainedParams
        const useEpiColors =
            (params.chartType === "ScatterPlot" &&
                (params.casesMetric || params.testsMetric) &&
                params.colorScale !== "continents") ||
            params.colorScale === "ptr"
        if (useEpiColors) {
            chartProps.dimensions[2].variableId = this.covidExplorerTable.getShortTermPositivityRateVarId()!
            chartProps.colorScale = this.colorScales.epi
        } else if (chartProps.dimensions[2]) {
            chartProps.dimensions[2].variableId = 123
            chartProps.colorScale = this.colorScales.continents
        }
    }

    private _updateMap() {
        const chartProps = this.chart.props
        const sourceChartId = (sourceCharts as any)[
            this.constrainedParams.sourceChartKey
        ]

        Object.assign(
            chartProps.map,
            this.props.covidChartAndVariableMeta.charts[sourceChartId]?.map ||
                this.defaultMapConfig
        )

        chartProps.map.targetYear = undefined
        chartProps.map.variableId = this.yColumn.spec.owidVariableId
    }

    componentDidMount() {
        this.chart.hideEntityControls = true
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
        Mousetrap.bind("right", () => this.playNextCommand())
        Mousetrap.bind("left", () => this.playPreviousCommand())
    }

    componentWillUnmount() {
        if (this.onResizeThrottled) {
            window.removeEventListener("resize", this.onResizeThrottled)
        }
    }

    private currentIndex = -1
    playNextCommand() {
        this.playIndex(++this.currentIndex)
    }

    playPreviousCommand() {
        this.playIndex(--this.currentIndex)
    }

    playIndex(index: number) {
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

    @computed private get dimensionSpecs(): DimensionSpec[] {
        const yColumn = this.yColumn
        if (this.constrainedParams.chartType === "LineChart")
            return [
                {
                    property: "y",
                    variableId: yColumn.spec.owidVariableId!,
                    display: {
                        // Allow ± 1 day difference in data plotted on bar charts
                        // This is what we use for charts on the Grapher too
                        tolerance: 1,
                        name: this.chartTitle
                    }
                }
            ]

        const xColumn = this.xColumn!

        return [
            {
                property: "y",
                variableId: yColumn.spec.owidVariableId!,
                display: {
                    name: this.chartTitle
                }
            },
            {
                property: "x",
                variableId: xColumn.spec.owidVariableId!,
                display: {
                    name: xColumn.spec.name
                }
            },
            {
                property: "color",
                variableId: 123,
                display: {
                    tolerance: 10
                }
            }
        ]
    }

    @computed private get colorScales(): {
        [name: string]: ColorScaleConfigProps
    } {
        return {
            epi: this.props.covidChartAndVariableMeta.charts[sourceCharts.epi]
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

    @observable.ref chart: ChartConfig = new ChartConfig(
        {
            slug: covidDashboardSlug,
            type: this.constrainedParams.chartType,
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
                label: ""
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
                availableEntities: this.availableEntities
            }
        },
        {
            queryStr: this.props.queryStr
        }
    )
}
