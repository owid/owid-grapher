import { OwidVariableSet, OwidEntityKey } from "../owidData/OwidVariableSet"
import React from "react"
import ReactDOM from "react-dom"
import { ChartView } from "charts/ChartView"
import { Bounds } from "charts/Bounds"
import { ChartConfig } from "charts/ChartConfig"
import { computed, action, observable, reaction, IReactionDisposer } from "mobx"
import { ChartTypeType } from "charts/ChartType"
import { observer } from "mobx-react"
import { OwidVariable } from "../owidData/OwidVariable"
import { bind } from "decko"
import { ChartDimension } from "../ChartDimension"
import * as urlBinding from "charts/UrlBinding"
import { max } from "charts/Util"
import {
    SmoothingOption,
    TotalFrequencyOption,
    CasesMetricOption,
    TestsMetricOption,
    DailyFrequencyOption,
    DeathsMetricOption,
    MetricKind,
    ParsedCovidRow,
    CountryOption,
    CountryOptionWithSelection
} from "./CovidTypes"
import {
    RadioOption as InputOption,
    CovidRadioControl as CovidInputControl
} from "./CovidRadioControl"
import { CountryPicker } from "./CovidCountryPicker"
import { CovidQueryParams, CovidUrl } from "./CovidChartUrl"
import {
    fetchAndParseData,
    RowAccessor,
    buildCovidVariable,
    daysSinceVariable,
    continentsVariable,
    buildCovidVariableId,
    makeCountryOptions
} from "./CovidDataUtils"
import { variablePartials } from "./CovidVariablePartials"
import { isEqual } from "charts/Util"
import { scaleLinear } from "d3"

@observer
export class CovidDataExplorer extends React.Component<{
    data: ParsedCovidRow[]
    params: CovidQueryParams
}> {
    static async bootstrap() {
        const containerNode = document.getElementById("covidDataExplorer")
        ReactDOM.render(
            <div className="LoadingCovidDataExplorer"></div>,
            containerNode
        )
        const typedData = await fetchAndParseData()
        const startingParams = new CovidQueryParams(window.location.search)
        ReactDOM.render(
            <CovidDataExplorer data={typedData} params={startingParams} />,
            containerNode
        )
    }

    setDeathsMetricCommand(value: DeathsMetricOption) {
        this.props.params.deathsMetric = value
    }

    private selectionChangeFromBuilder = false

    @action.bound clearSelectionCommand() {
        this.selectionChangeFromBuilder = true
        this.props.params.selectedCountryCodes.clear()
        this.updateChart()
    }

    // If the user does something like click a country on the map, we need to pull that selection out into the covidDataExplorer
    // Ideally we would not be duplicating selection code here, but it's a little tricky with the current chart code.
    setCountrySelectionsFromChart() {
        if (this.selectionChangeFromBuilder) {
            this.selectionChangeFromBuilder = false
            return
        }
        // Do not clear country selection if the chart selection is empty. That may happen if there are
        // no metrics selected.
        if (!this.chart.data.selectedEntityCodes.length) return
        const chartSet = new Set(this.chart.data.selectedEntityCodes)
        if (isEqual(chartSet, this.props.params.selectedCountryCodes)) return
        this.props.params.selectedCountryCodes.clear()
        this.chart.data.selectedEntityCodes.forEach(code => {
            this.toggleSelectedCountry(code, true)
        })
    }

    setCasesMetricCommand(value: CasesMetricOption) {
        this.props.params.casesMetric = value
    }

    setTestsMetricCommand(value: TestsMetricOption) {
        this.props.params.testsMetric = value
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

    private get metricPicker() {
        const options: InputOption[] = [
            {
                label: "Confirmed Deaths",
                checked: this.props.params.deathsMetric,
                onChange: value => {
                    this.setDeathsMetricCommand(value)
                    if (value) {
                        this.setCasesMetricCommand(false)
                        this.setTestsMetricCommand(false)
                    }
                    this.updateChart()
                }
            },
            {
                label: "Confirmed Cases",
                checked: this.props.params.casesMetric,
                onChange: value => {
                    this.setCasesMetricCommand(value)
                    if (value) {
                        this.setTestsMetricCommand(false)
                        this.setDeathsMetricCommand(false)
                    }
                    this.updateChart()
                }
            },
            {
                label: "Tests",
                checked: this.props.params.testsMetric,
                onChange: value => {
                    this.setTestsMetricCommand(value)
                    if (value) {
                        this.setCasesMetricCommand(false)
                        this.setDeathsMetricCommand(false)
                    }
                    this.updateChart()
                }
            }
        ]
        return (
            <CovidInputControl
                name="metric"
                options={options}
                isCheckbox={false}
            ></CovidInputControl>
        )
    }

    private get frequencyPicker() {
        const options: InputOption[] = [
            {
                label: "Total",
                checked: this.props.params.totalFreq,
                onChange: value => {
                    this.setTotalFrequencyCommand(value)
                    if (value) this.setDailyFrequencyCommand(false)

                    this.updateChart()
                }
            },
            {
                label: "Daily",
                checked: this.props.params.dailyFreq,
                onChange: value => {
                    this.setDailyFrequencyCommand(value)
                    if (value) this.setTotalFrequencyCommand(false)

                    this.updateChart()
                }
            }
        ]
        return (
            <CovidInputControl
                name="frequency"
                options={options}
                isCheckbox={false}
            ></CovidInputControl>
        )
    }

    @computed private get perCapitaPicker() {
        const options: InputOption[] = [
            {
                label: "Per capita",
                checked: this.props.params.perCapita,
                onChange: value => {
                    this.props.params.perCapita = value
                    this.updateChart()
                }
            }
        ]
        return (
            <CovidInputControl
                name="count"
                isCheckbox={true}
                options={options}
            ></CovidInputControl>
        )
    }

    private get alignedPicker() {
        const options: InputOption[] = [
            {
                label: "Align with start of pandemic",
                checked: this.props.params.aligned,
                onChange: value => {
                    this.props.params.aligned = value
                    this.updateChart()
                }
            }
        ]
        return (
            <CovidInputControl
                name="timeline"
                isCheckbox={true}
                options={options}
            ></CovidInputControl>
        )
    }

    private get smoothingPicker() {
        const options: InputOption[] = [
            {
                label: "Daily Figures",
                checked: this.props.params.smoothing === 0,
                onChange: () => {
                    this.setSmoothingCommand(0)
                    this.updateChart()
                }
            },
            {
                label: "3 Day Rolling Average",
                checked: this.props.params.smoothing === 3,
                onChange: () => {
                    this.setSmoothingCommand(3)
                    this.updateChart()
                }
            },
            {
                label: "7 Day Rolling Average",
                checked: this.props.params.smoothing === 7,
                onChange: () => {
                    this.setSmoothingCommand(7)
                    this.updateChart()
                }
            }
        ]
        return (
            <CovidInputControl
                name="smoothing"
                options={options}
            ></CovidInputControl>
        )
    }

    @computed get areMultipleCountriesSelected() {
        return Array.from(this.props.params.selectedCountryCodes).length > 1
    }

    toggleSelectedCountry(code: string, value?: boolean) {
        if (value) this.props.params.selectedCountryCodes.add(code)
        else if (value === false)
            this.props.params.selectedCountryCodes.delete(code)
        else if (this.props.params.selectedCountryCodes.has(code))
            this.props.params.selectedCountryCodes.delete(code)
        else this.props.params.selectedCountryCodes.add(code)
    }

    @action.bound toggleSelectedCountryCommand(code: string, value?: boolean) {
        this.selectionChangeFromBuilder = true
        this.toggleSelectedCountry(code, value)
        this.updateChart()
    }

    render() {
        const bounds = new Bounds(0, 0, 1000, (1000 * 680) / 480)

        return (
            <div className="CovidDataExplorer">
                <div className="CovidDataExplorerSideBar">
                    <div className="CovidHeaderBox">
                        <div className="CovidTitle">Covid-19 Data Explorer</div>
                        <div className="CovidLastUpdated">
                            Updated {this.lastUpdated}
                        </div>
                    </div>
                    <CountryPicker
                        covidDataExplorer={this}
                        toggleCountryCommand={this.toggleSelectedCountryCommand}
                    ></CountryPicker>
                </div>
                <div className="CovidDataExplorerMain">
                    <div className="CovidDataExplorerTopBar">
                        {this.metricPicker}
                        {this.frequencyPicker}
                        {this.perCapitaPicker}
                        {this.alignedPicker}
                        {this.smoothingPicker}
                    </div>
                    <div className="CovidDataExplorerFigure">
                        <ChartView
                            bounds={bounds}
                            chart={this.chart}
                        ></ChartView>
                    </div>
                </div>
            </div>
        )
    }

    @computed
    get countryOptionsWithSelectionStatus(): CountryOptionWithSelection[] {
        return this.countryOptions.map(option => {
            ;(option as any).selected = this.props.params.selectedCountryCodes.has(
                option.code
            )
            return option as CountryOptionWithSelection
        })
    }

    @computed get countryOptions(): CountryOption[] {
        return makeCountryOptions(this.props.data)
    }

    @computed private get availableEntities() {
        return this.countryOptions.map(country => country.name)
    }

    @computed get lastUpdated() {
        const rows = this.countryOptions[this.countryMap.get("World")!].rows
        return rows[rows.length - 1].date
    }

    @computed get frequencyTitle() {
        if (this.props.params.dailyFreq && this.props.params.totalFreq)
            return "Total and daily"
        else if (this.props.params.dailyFreq) return "Daily"
        return "Total"
    }

    @computed get perCapitaDivisor() {
        const { params } = this.props
        if (!params.perCapita) return 1
        if (params.testsMetric && !params.deathsMetric && !params.casesMetric)
            return 1000
        return 1000000
    }

    @computed get perCapitaTitle() {
        const options = {
            1: "",
            1000: " per thousand people",
            1000000: " per million people"
        }

        return options[this.perCapitaDivisor]
    }

    @computed get metricTitle() {
        const metrics = []
        if (this.props.params.deathsMetric) metrics.push("deaths")
        if (this.props.params.casesMetric) metrics.push("cases")
        if (this.props.params.testsMetric) metrics.push("tests")
        return metrics.length === 3
            ? "deaths, cases and tests"
            : metrics.length === 2
            ? `${metrics[0]} and ${metrics[1]}`
            : metrics[0]
    }

    @computed get smoothingTitle() {
        if (this.props.params.smoothing > 0)
            return `Shown is the rolling ${this.props.params.smoothing}-day average. `
        return ""
    }

    @computed get title() {
        return `${this.frequencyTitle} Confirmed COVID-19 ${this.metricTitle}${this.perCapitaTitle}`
    }

    @computed get subtitle() {
        const parts: string[] = []
        if (this.props.params.deathsMetric)
            parts.push(
                `Limited testing and challenges in the attribution of the cause of death means that the number of confirmed deaths may not be an accurate count of the true number of deaths from COVID-19.`
            )
        if (this.props.params.casesMetric)
            parts.push(
                `The number of confirmed cases is lower than the number of total cases. The main reason for this is limited testing.`
            )
        return `${this.smoothingTitle}` + parts.join("\n")
    }

    @computed get note() {
        if (this.props.params.testsMetric)
            return "Note: For testing figures, there are substantial differences across countries in terms of the units, whether or not all labs are included, the extent to which negative and pending tests are included and other aspects. Details for each country can be found at the linked page."
        return ""
    }

    @computed get selectedData() {
        const countryCodeMap = this.countryCodeMap
        return Array.from(this.props.params.selectedCountryCodes).map(code => {
            return {
                index: 0,
                entityId: countryCodeMap.get(code)!
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
        return this.props.params.aligned ? "ScatterPlot" : "LineChart"
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

    // We are computing variables clientside so they don't have a variable index. The variable index is used by Chart
    // in a number of places, so we still need a unique one per variable. The way our system works, changing things like
    // frequency or per capita would be in effect creating a new variable. So we need to generate unique variable ids
    // for all of these combinations.
    @computed get yVariableIndices(): number[] {
        const params = this.props.params
        const indices: number[] = []

        const setVariable = (
            columnName: MetricKind,
            rowFn: RowAccessor,
            daily: boolean = false
        ) => {
            const id = buildCovidVariableId(
                columnName,
                this.perCapitaDivisor,
                this.props.params.smoothing,
                daily
            )
            indices.push(id)

            if (!this.owidVariableSet.variables[id]) {
                this.owidVariableSet.variables[id] = buildCovidVariable(
                    id,
                    columnName,
                    this.countryMap,
                    this.props.data,
                    rowFn,
                    this.perCapitaDivisor,
                    this.props.params.smoothing,
                    daily
                )
            }
        }

        if (params.testsMetric && params.dailyFreq)
            setVariable("tests", row => row.new_tests, true)
        if (params.testsMetric && params.totalFreq)
            setVariable("tests", row => row.total_tests)

        if (params.casesMetric && params.dailyFreq)
            setVariable("cases", row => row.new_cases, true)
        if (params.casesMetric && params.totalFreq)
            setVariable("cases", row => row.total_cases)

        if (params.deathsMetric && params.dailyFreq)
            setVariable("deaths", row => row.new_deaths, true)
        if (params.deathsMetric && params.totalFreq)
            setVariable("deaths", row => row.total_deaths)

        return indices
    }

    @observable.struct owidVariableSet: OwidVariableSet = {
        variables: {
            99999: daysSinceVariable(
                this.props.data,
                this.countryMap,
                row => row.total_deaths >= 5
            ),
            99998: daysSinceVariable(
                this.props.data,
                this.countryMap,
                row => row.total_cases >= 100
            ),
            123: continentsVariable(this.countryOptions)
        },
        entityKey: this.entityKey
    }

    private continentsVariableId = variablePartials.continents.id!

    async updateChart() {
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

        chartProps.map.variableId = this.yVariableIndices[0]

        // When dimensions changes, chart.variableIds change, which calls downloadData(), which reparses variableSet
        chartProps.dimensions = this.dimensions
        // Todo: perf improvements
        // We manually call this first, before doing the selection thing, because we cannot select data that is not there.
        await this.chart.downloadData()

        chartProps.selectedData = this.selectedData

        this.chart.url.externalBaseUrl = "covid-data-explorer"
        this.chart.url.externallyProvidedParams = this.props.params.toParams
    }

    componentDidMount() {
        this.bindToWindow()
        this.chart.hideAddDataButton = true
        this.updateChart()
        const win = window as any
        win.covidDataExplorer = this
    }

    bindToWindow() {
        const url = new CovidUrl(this.chart.url, this.props.params)
        urlBinding.bindUrlToWindow(url)

        this.disposers.push(
            reaction(
                () => this.chart.data.selectedEntityCodes,
                () => this.setCountrySelectionsFromChart()
            )
        )
    }

    disposers: IReactionDisposer[] = []

    @bind dispose() {
        this.disposers.forEach(dispose => dispose())
    }

    @computed get dimensions(): ChartDimension[] {
        if (this.chartType === "LineChart")
            return this.yVariableIndices.map(id => {
                return {
                    property: "y",
                    variableId: id,
                    display: {}
                }
            })

        return [
            {
                property: "y",
                variableId: this.yVariableIndices[0],
                display: {}
            },
            {
                property: "x",
                variableId: 99999,
                display: {
                    name: "Days since the 5th total confirmed death"
                }
            },
            {
                property: "color",
                variableId: this.continentsVariableId,
                display: {}
            }
        ]
    }

    @observable.ref chart = new ChartConfig(
        {
            slug: "covid-data-explorer",
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
            dimensions: this.dimensions,
            addCountryMode: "add-country",
            stackMode: "absolute",
            hideRelativeToggle: true,
            hasChartTab: true,
            hasMapTab: true,
            tab: "chart",
            isPublished: true,
            map: {
                variableId: this.yVariableIndices[0],
                timeTolerance: 7,
                colorSchemeValues: [],
                colorSchemeLabels: [],
                customNumericColors: [],
                customCategoryColors: {},
                customCategoryLabels: {},
                customHiddenCategories: {},
                projection: "World"
            },
            data: {
                availableEntities: this.availableEntities
            }
        },
        {
            queryStr: window.location.search
        }
    )
}
