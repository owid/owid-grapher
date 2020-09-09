import React from "react"
import classnames from "classnames"
import ReactDOM from "react-dom"
import { GrapherView } from "grapher/core/GrapherView"
import { Bounds } from "grapher/utils/Bounds"
import { GrapherConfigInterface } from "grapher/core/GrapherConfig"
import { Grapher } from "grapher/core/Grapher"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import {
    computed,
    action,
    observable,
    IReactionDisposer,
    observe,
    Lambda,
    reaction,
} from "mobx"
import { observer } from "mobx-react"
import { bind } from "decko"
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
    flatten,
} from "grapher/utils/Util"
import {
    ControlOption,
    ExplorerControlPanel,
    DropdownOption,
    ExplorerControlBar,
} from "explorer/client/ExplorerControls"
import { CovidQueryParams, CovidConstrainedQueryParams } from "./CovidParams"
import { CountryPicker } from "grapher/controls/CountryPicker"
import {
    fetchAndParseData,
    fetchLastUpdatedTime,
    getLeastUsedColor,
    CovidExplorerTable,
    fetchCovidChartAndVariableMeta,
    buildColumnSlug,
    perCapitaDivisorByMetric,
} from "./CovidExplorerTable"
import { BAKED_BASE_URL } from "settings"
import moment from "moment"
import {
    CovidGrapherRow,
    IntervalOption,
    MetricKind,
    covidDashboardSlug,
    coronaDefaultView,
    covidDataPath,
    sourceCharts,
    metricLabels,
    metricPickerColumnSpecs,
    covidCsvColumnSlug,
    intervalSpecs,
    intervalsAvailableByMetric,
} from "./CovidConstants"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    ColorScheme,
    ColorSchemes,
    continentColors,
} from "grapher/color/ColorSchemes"
import {
    GlobalEntitySelection,
    GlobalEntitySelectionModes,
} from "site/globalEntityControl/GlobalEntitySelection"
import { ColorScaleConfigInterface } from "grapher/color/ColorScaleConfig"
import * as Mousetrap from "mousetrap"
import { CommandPalette, Command } from "grapher/controls/CommandPalette"
import { TimeBoundValue } from "grapher/utils/TimeBounds"
import {
    PersistableChartDimension,
    ChartDimension,
    ChartDimensionConfig,
} from "grapher/chart/ChartDimension"
import { BinningStrategy } from "grapher/color/BinningStrategies"
import { UrlBinder } from "grapher/utils/UrlBinder"
import { ExtendedGrapherUrl } from "grapher/core/GrapherUrl"
import { ScaleType } from "grapher/core/GrapherConstants"

interface BootstrapProps {
    containerNode: HTMLElement
    isEmbed?: boolean
    queryStr?: string
    globalEntitySelection?: GlobalEntitySelection
    isExplorerPage?: boolean
    bindToWindow?: boolean
}

@observer
export class CovidExplorer extends React.Component<{
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
    bindToWindow?: boolean
}> {
    static async bootstrap(props: BootstrapProps) {
        const [typedData, updated, covidMeta] = await Promise.all([
            fetchAndParseData(),
            fetchLastUpdatedTime(),
            fetchCovidChartAndVariableMeta(),
        ])
        const queryStr =
            props.queryStr && CovidQueryParams.hasAnyCovidParam(props.queryStr)
                ? props.queryStr
                : coronaDefaultView
        const startingParams = new CovidQueryParams(queryStr)
        return ReactDOM.render(
            <CovidExplorer
                data={typedData}
                updated={updated}
                params={startingParams}
                covidChartAndVariableMeta={covidMeta}
                queryStr={queryStr}
                isEmbed={props.isEmbed}
                isExplorerPage={props.isExplorerPage}
                globalEntitySelection={props.globalEntitySelection}
                enableKeyboardShortcuts={true}
                bindToWindow={props.bindToWindow}
            />,
            props.containerNode
        )
    }

    private uniqId = Math.random().toString(36).substr(2, 8)

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
        return CovidExplorer.bootstrap({
            ...props,
            queryStr,
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
        const codeMap = this.grapher.table.entityNameToCodeMap
        this.grapher.table.availableEntities.forEach((option) =>
            this.props.params.selectedCountryCodes.add(codeMap.get(option)!)
        )
        this.selectionChangeFromBuilder = true
        this.renderControlsThenUpdateChart()
    }

    private get metricPicker() {
        const options: ControlOption[] = [
            {
                available: true,
                label: metricLabels.cases,
                checked: this.constrainedParams.casesMetric,
                value: "cases",
            },
            {
                available: true,
                label: metricLabels.deaths,
                checked: this.constrainedParams.deathsMetric,
                value: "deaths",
            },

            {
                available: true,
                label: metricLabels.case_fatality_rate,
                checked: this.constrainedParams.cfrMetric,
                value: "case_fatality_rate",
            },
        ]

        const optionsColumn2: ControlOption[] = [
            {
                available: true,
                label: metricLabels.tests,
                checked: this.constrainedParams.testsMetric,
                value: "tests",
            },
            {
                available: true,
                label: metricLabels.tests_per_case,
                checked: this.constrainedParams.testsPerCaseMetric,
                value: "tests_per_case",
            },
            {
                available: true,
                label: metricLabels.positive_test_rate,
                checked: this.constrainedParams.positiveTestRate,
                value: "positive_test_rate",
            },
        ]
        return (
            <>
                <ExplorerControlPanel
                    title="Metric"
                    explorerSlug="covid"
                    name={this.getScopedName("metric")}
                    options={options}
                    onChange={this.changeMetric}
                    isCheckbox={false}
                />
                <ExplorerControlPanel
                    title="Metric"
                    explorerSlug="covid"
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
                label: intervalSpecs.total.label,
                value: "total",
            },
            {
                available: available.smoothed,
                label: intervalSpecs.smoothed.label,
                value: "smoothed",
            },
            {
                available: available.daily,
                label: intervalSpecs.daily.label,
                value: "daily",
            },
            {
                available: available.weekly,
                label: intervalSpecs.weekly.label,
                value: "weekly",
            },
            {
                available: available.weekly,
                label: intervalSpecs.weeklyChange.label,
                value: "weeklyChange",
            },
            {
                available: available.weekly,
                label: intervalSpecs.biweekly.label,
                value: "biweekly",
            },
            {
                available: available.weekly,
                label: intervalSpecs.biweeklyChange.label,
                value: "biweeklyChange",
            },
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
                explorerSlug="covid"
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
                value: "true",
            },
        ]
        return (
            <ExplorerControlPanel
                title="Count"
                name={this.getScopedName("count")}
                isCheckbox={true}
                options={options}
                explorerSlug="covid"
                onChange={(value) => {
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
                value: "true",
            },
        ]
        return (
            <ExplorerControlPanel
                title="Timeline"
                name={this.getScopedName("timeline")}
                isCheckbox={true}
                options={options}
                onChange={(value) => {
                    this.props.params.aligned = value === "true"
                    this.renderControlsThenUpdateChart()
                }}
                comment={this.constrainedParams.trajectoryColumnOption.name}
                explorerSlug="covid"
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
        const codeMap = this.grapher.table.entityNameToCodeMap
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
            <div className="ExplorerHeaderBox">
                <div>Coronavirus Pandemic</div>
                <div className="ExplorerTitle">Data Explorer</div>
                <div className="ExplorerSubtitle" title={this.howLongAgo}>
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
                explorerSlug="Covid"
                table={this.grapher.table}
                pickerColumnSlugs={
                    new Set(Object.keys(metricPickerColumnSpecs))
                }
                isDropdownMenu={this.isMobile}
                optionColorMap={this.countryNameToColorMap}
                selectedEntities={this.selectedEntityNames}
                availableEntities={
                    this.covidExplorerTable.table.availableEntities
                }
                userState={this.props.params}
                countriesMustHaveColumns={this.activeColumnSlugs}
                clearSelectionCommand={this.clearSelectionCommand}
                toggleCountryCommand={this.toggleSelectedCountryCommand}
            ></CountryPicker>
        )
    }

    @computed get activeColumnSlugs(): string[] {
        return [this.xColumn?.slug, this.yColumn?.slug].filter(
            (i) => i
        ) as string[]
    }

    @action.bound changePickerMetric(metric: covidCsvColumnSlug) {
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
        return this.isMobile ? (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.toggleMobileControls}
                data-track-note="covid-customize-chart"
            >
                <FontAwesomeIcon icon={faChartLine} /> Customize chart
            </a>
        ) : undefined
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
                        CovidExplorer: true,
                        "mobile-explorer": this.isMobile,
                        HideControls: !this.showExplorerControls,
                        "is-embed": this.props.isEmbed,
                    })}
                >
                    {this.showExplorerControls && this.header}
                    {this.showExplorerControls && this.controlBar}
                    {this.showExplorerControls && this.countryPicker}
                    {this.showExplorerControls &&
                        this.customizeChartMobileButton}
                    <div
                        className="CovidExplorerFigure"
                        ref={this.chartContainerRef}
                    >
                        {this.chartBounds && (
                            <GrapherView
                                bounds={this.chartBounds}
                                grapher={this.grapher}
                                isEmbed={true}
                            ></GrapherView>
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
        this.grapher.embedExplorerCheckbox = this.controlsToggleElement
        this._updateChart()
        requestAnimationFrame(() => this.onResize())
    }

    @computed get showExplorerControls() {
        return !this.props.params.hideControls || !this.props.isEmbed
    }

    @computed get selectedCountryOptions(): string[] {
        const codeMap = this.grapher.table.entityNameToCodeMap
        return this.grapher.table.availableEntities.filter((option) =>
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
            1e6: "per million people",
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
        const countryCodeMap = this.grapher.table.entityCodeToNameMap
        const entityIdMap = this.grapher.table.entityNameToIdMap
        return Array.from(this.props.params.selectedCountryCodes)
            .map((code) => countryCodeMap.get(code))
            .filter((i) => i)
            .map((countryOption) => {
                return {
                    index: 0,
                    entityId: countryOption
                        ? entityIdMap.get(countryOption)!
                        : 0,
                    color: this.countryNameToColorMap[countryOption!],
                }
            })
    }

    private _countryNameToColorMapCache: {
        [key: string]: string | undefined
    } = {}

    @computed get countryNameToColorMap(): {
        [key: string]: string | undefined
    } {
        const names = this.selectedCountryOptions.map((country) => country)
        // If there isn't a color for every country name, we need to update the color map
        if (!names.every((name) => name in this._countryNameToColorMapCache)) {
            // Omit any unselected country names from color map
            const newColorMap = pick(this._countryNameToColorMapCache, names)
            // Check for name *key* existence, not value.
            // `undefined` value means we want the color to be automatic, determined by the chart.
            const namesWithoutColor = names.filter(
                (name) => !(name in newColorMap)
            )
            // For names that don't have a color, assign one.
            namesWithoutColor.forEach((name) => {
                const scheme = ColorSchemes["owid-distinct"] as ColorScheme
                const availableColors = lastOfNonEmptyArray(scheme.colorSets)
                const usedColors = Object.values(newColorMap).filter(
                    (color) => color !== undefined
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
                this.grapher.table,
                this.props.data,
                this.props.covidChartAndVariableMeta.variables,
                this.props.isExplorerPage
            )
        }
        return this._covidExplorerTable
    }

    componentWillMount() {
        this.covidExplorerTable // init table.
    }

    @computed get selectedEntityNames(): string[] {
        const entityCodeMap = this.grapher.table.entityCodeToNameMap
        return Array.from(this.props.params.selectedCountryCodes.values())
            .map((code) => entityCodeMap.get(code))
            .filter((i) => i) as string[]
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

        const chartProps = this.grapher
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
            this.switchBackToLog = chartProps.yAxis.scaleType === ScaleType.log
            chartProps.yAxis.scaleType = ScaleType.linear
            chartProps.yAxis.canChangeScaleType = undefined
        } else {
            chartProps.yAxis.canChangeScaleType = true
            if (this.switchBackToLog) {
                chartProps.yAxis.scaleType = ScaleType.log
                this.switchBackToLog = false
            }
        }

        chartProps.yAxis.min = params.intervalChange ? undefined : 0

        // When dimensions changes, chart.variableIds change, which calls downloadData(), which reparses variableSet
        chartProps.dimensions = this.dimensionSpecs.map(
            (spec) => new PersistableChartDimension(spec)
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
        if (
            params.type === "ScatterPlot" &&
            this.grapher.currentTab === "chart"
        )
            covidExplorerTable.addGroupFilterColumn()
        else covidExplorerTable.removeGroupFilterColumn()

        this._updateMap()
        this._updateColorScale()

        chartProps.id = this.sourceChartId
        chartProps.selectedData = this.selectedData
        this.grapher.url.externallyProvidedParams = this.props.params.toQueryParams
    }

    private _updateColorScale() {
        this.grapher.colorScale.updateFromObject(
            this.colorScales[this.constrainedParams.colorStrategy]
        )
    }

    @computed get sourceChartId(): number {
        return (sourceCharts as any)[this.constrainedParams.sourceChartKey]
    }

    @computed get sourceChart(): GrapherConfigInterface | undefined {
        return this.props.covidChartAndVariableMeta.charts[this.sourceChartId]
    }

    private _updateMap() {
        const map = this.grapher.map
        const region = map.projection

        Object.assign(map, this.sourceChart?.map || this.defaultMapConfig)

        map.targetYear = undefined
        map.columnSlug = this.yColumn.spec.owidVariableId?.toString()

        // Preserve region
        if (region) map.projection = region
    }

    componentDidMount() {
        if (this.props.bindToWindow) this.bindToWindow()
        // Show 'Add country' & 'Select countries' controls if the explorer controls are hidden.
        this.grapher.hideEntityControls = this.showExplorerControls
        this.grapher.externalCsvLink = covidDataPath
        this.grapher.url.externalBaseUrl = `${BAKED_BASE_URL}/${covidDashboardSlug}`
        this._updateChart()

        this.observeChartEntitySelection()
        this.observeGlobalEntitySelection()

        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)

        // call resize for the first time to initialize chart
        this.onResize()
        this.grapher.embedExplorerCheckbox = this.controlsToggleElement
        ;(window as any).covidDataExplorer = this

        if (this.props.enableKeyboardShortcuts)
            this.keyboardShortcuts.forEach((shortcut) => {
                Mousetrap.bind(shortcut.combo, () => {
                    shortcut.fn()
                    this.grapher.analytics.logKeyboardShortcut(
                        shortcut.title,
                        shortcut.combo
                    )
                })
            })
    }

    @action.bound playDefaultViewCommand() {
        // todo: Should  just be "coronaDefaultView"
        const props = this.grapher
        props.tab = "chart"
        this.grapher.xAxis.scaleType = ScaleType.linear
        this.grapher.yAxis.scaleType = ScaleType.log
        this.grapher.timeDomain = [
            TimeBoundValue.unboundedLeft,
            TimeBoundValue.unboundedRight,
        ]
        this.props.params.setParamsFromQueryString(coronaDefaultView)
        this.renderControlsThenUpdateChart()
    }

    @action.bound toggleTabCommand() {
        this.grapher.tab = next(["chart", "map", "table"], this.grapher.tab)
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
                category: "Browse",
            },
            {
                combo: "right",
                fn: () => this.playIndexCommand(++this.currentIndex),
                title: "Next view",
                category: "Browse",
            },
            {
                combo: "left",
                fn: () => this.playIndexCommand(--this.currentIndex),
                title: "Previous view",
                category: "Browse",
            },
            {
                combo: "t",
                fn: () => this.toggleTabCommand(),
                title: "Toggle tab",
                category: "Navigation",
            },
            {
                combo: "?",
                fn: () => this.toggleKeyboardHelpCommand(),
                title: "Toggle Help",
                category: "Navigation",
            },
            {
                combo: "a",
                fn: () =>
                    this.selectedData.length
                        ? this.clearSelectionCommand()
                        : this.selectAllCommand(),
                title: "Select/Deselect all",
                category: "Selection",
            },
            {
                combo: "f",
                fn: () => this.toggleFilterAllCommand(),
                title: "Hide unselected",
                category: "Selection",
            },
            {
                combo: "c",
                fn: () => this.toggleColorStrategyCommand(),
                title: "Change line colors",
                category: "Chart",
            },
            {
                combo: "l",
                fn: () => this.toggleYScaleTypeCommand(),
                title: "Toggle Y log/linear",
                category: "Chart",
            },
            {
                combo: "z",
                fn: () => this.toggleTimelineCommand(),
                title: "Latest/Earliest/All period",
                category: "Timeline",
            },
            {
                combo: "p",
                fn: () => this.togglePlayingCommand(),
                title: "Play/Pause",
                category: "Timeline",
            },
        ]
    }

    @action.bound toggleYScaleTypeCommand() {
        this.grapher.yAxis.scaleType = next(
            [ScaleType.linear, ScaleType.log],
            this.grapher.yAxis.scaleType
        )
    }

    @action.bound toggleTimelineCommand() {
        // Todo: add tests for this
        this.grapher.setTimeFromTimeQueryParam(
            next(["latest", "earliest", ".."], this.grapher.url.timeParam!)
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
        this.grapher.minPopulationFilter =
            this.grapher.minPopulationFilter === 2e9 ? undefined : 2e9
        this.renderControlsThenUpdateChart()
    }

    @action.bound togglePlayingCommand() {
        this.grapher.isPlaying = !this.grapher.isPlaying
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
            observe(this.grapher, "selectedEntityCodes", (change) => {
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
                added.forEach((code) => this.toggleSelectedCountry(code, true))
                removed.forEach((code) =>
                    this.toggleSelectedCountry(code, false)
                )
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
                        globalEntitySelection.selectedEntities,
                    ],
                    () => {
                        const { mode, selectedEntities } = globalEntitySelection
                        if (mode === GlobalEntitySelectionModes.override) {
                            this.props.params.selectedCountryCodes = new Set(
                                selectedEntities.map((entity) => entity.code)
                            )
                            this.renderControlsThenUpdateChart()
                        }
                    },
                    { fireImmediately: true }
                )
            )
        }
    }

    bindToWindow() {
        new UrlBinder().bindToWindow(
            new ExtendedGrapherUrl(this.grapher.url, [this.props.params])
        )
    }

    disposers: (IReactionDisposer | Lambda)[] = []

    @bind dispose() {
        this.disposers.forEach((dispose) => dispose())
    }

    @computed private get yColumn() {
        return this.grapher.table.columnsBySlug.get(
            this.constrainedParams.yColumnSlug
        )!
    }

    @computed private get xColumn() {
        return this.constrainedParams.xColumnSlug
            ? this.grapher.table.columnsBySlug.get(
                  this.constrainedParams.xColumnSlug!
              )!
            : undefined
    }

    @computed private get sizeColumn() {
        return this.constrainedParams.sizeColumn
            ? this.grapher.table.columnsBySlug.get(
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
            intervalSpecs[interval].smoothing
        )

        const column = this.grapher.table.columnsBySlug.get(colSlug)

        if (!column) throw Error(`${colSlug} does not exist!`)
        return {
            property: "table",
            variableId: column?.spec.owidVariableId,
            display: {
                tolerance: 2,
                name:
                    metricLabels[metric] +
                    (isCountMetric(metric) ? this.perCapitaTitle(metric) : ""),
                unit: intervalSpecs[interval].label,
                shortUnit:
                    (interval === "weeklyChange" ||
                        interval === "biweeklyChange") &&
                    "%",
                tableDisplay: column?.display.tableDisplay,
            },
        } as ChartDimensionConfig
    }

    @computed private get dataTableOnlyDimensions(): ChartDimensionConfig[] {
        const params = this.constrainedParams
        return flatten(
            params.tableMetrics?.map((metric) => {
                const specs = [
                    this._buildDataTableOnlyDimensionSpec(metric, "total"),
                ]

                if (
                    isCountMetric(metric) &&
                    params.interval !== "total" &&
                    intervalsAvailableByMetric.get(metric)?.has(params.interval)
                ) {
                    // add intervals column
                    specs.push(
                        this._buildDataTableOnlyDimensionSpec(
                            metric,
                            params.interval
                        )
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

        params.tableMetrics?.forEach((metric) => {
            dataTableParams.setMetric(metric)
            dataTableParams.interval = "total"
            dataTableParams.smoothing = 0
            dataTableParams.perCapita = false
            if (isCountMetric(metric)) {
                dataTableParams.perCapita = params.perCapita
                covidExplorerTable.initRequestedColumns(dataTableParams)
                if (
                    params.interval !== "total" &&
                    intervalsAvailableByMetric.get(metric)?.has(params.interval)
                ) {
                    dataTableParams.interval = params.interval
                    dataTableParams.smoothing =
                        intervalSpecs[params.interval].smoothing
                }
            }

            covidExplorerTable.initRequestedColumns(dataTableParams)
        })
    }

    @action private _addDataTableOnlyDimensionsToChart() {
        this.grapher.dataTableOnlyDimensions = this.dataTableOnlyDimensions.map(
            (dimSpec, index) =>
                new ChartDimension(
                    dimSpec,
                    index,
                    this.grapher.table.columnsByOwidVarId.get(
                        dimSpec.variableId
                    )!
                )
        )
    }

    @computed private get yDimension(): ChartDimensionConfig {
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
                tableDisplay: yColumn.display.tableDisplay,
            },
        }
    }

    @computed private get xDimension(): ChartDimensionConfig {
        const xColumn = this.xColumn!
        return {
            property: "x",
            variableId: xColumn.spec.owidVariableId!,
            display: {
                name: xColumn.spec.name,
                tableDisplay: xColumn.display.tableDisplay,
            },
        }
    }

    @computed private get dimensionSpecs(): ChartDimensionConfig[] {
        if (this.constrainedParams.type !== "ScatterPlot")
            return [this.yDimension]

        const dimensions = [this.yDimension, this.xDimension]

        if (this.constrainedParams.colorStrategy !== "none")
            dimensions.push(this.colorDimension)
        if (this.sizeColumn) dimensions.push(this.sizeDimension)
        return dimensions
    }

    @computed private get sizeDimension(): ChartDimensionConfig {
        return {
            property: "size",
            variableId: this.sizeColumn!.spec.owidVariableId!,
        }
    }

    private shortTermPositivityRateVarId: number = 0
    @computed private get colorDimension(): ChartDimensionConfig {
        const variableId =
            this.constrainedParams.colorStrategy === "continents"
                ? 123
                : this.shortTermPositivityRateVarId

        return {
            property: "color",
            variableId,
            display: {
                tolerance: 10,
            },
        }
    }

    @computed private get colorScales(): {
        [name: string]: ColorScaleConfigInterface
    } {
        return {
            ptr: this.props.covidChartAndVariableMeta.charts[sourceCharts.epi]
                ?.colorScale as any,
            continents: {
                binningStrategy: BinningStrategy.manual,
                legendDescription: "Continent",
                baseColorScheme: undefined,
                customNumericValues: [],
                customNumericLabels: [],
                customNumericColors: [],
                customCategoryColors: continentColors,
                customCategoryLabels: {
                    "No data": "Other",
                },
                customHiddenCategories: {},
            },
            none: {
                binningStrategy: BinningStrategy.manual,
                legendDescription: "",
                baseColorScheme: undefined,
                customNumericValues: [],
                customNumericLabels: [],
                customNumericColors: [],
                customCategoryColors: continentColors,
                customCategoryLabels: {
                    "No data": "",
                },
                customHiddenCategories: {},
            },
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
                customHiddenCategories: {},
            },
        }
    }

    @computed private get yAxisLabel() {
        return this.constrainedParams.yColumn
            ? this.constrainedParams.yColumnSlug
            : ""
    }

    @observable.ref grapher: Grapher = new Grapher(
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
                scaleType: ScaleType.linear,
            },
            yAxis: {
                min: 0,
                removePointsOutsideDomain: true,
                scaleType: ScaleType.linear,
                canChangeScaleType: true,
                label: this.yAxisLabel,
            },
            selectedData: [],
            dimensions: [],
            scatterPointLabelStrategy: "y",
            addCountryMode: "add-country",
            stackMode: "absolute",
            manuallyProvideData: true,
            colorScale: this.colorScales.continents,
            hideRelativeToggle: true,
            hasChartTab: true,
            hasMapTab: true,
            tab: "chart",
            isPublished: true,
            map: this.defaultMapConfig as any,
        },
        {
            queryStr: this.props.queryStr,
        }
    )
}

function isCountMetric(metric: MetricKind) {
    return metric === "deaths" || metric === "cases" || metric === "tests"
}
