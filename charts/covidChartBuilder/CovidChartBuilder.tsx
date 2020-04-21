import { OwidVariableSet, OwidEntityKey } from "../owidData/OwidVariableSet"
import React from "react"
import ReactDOM from "react-dom"
import { ChartView } from "charts/ChartView"
import { Bounds } from "charts/Bounds"
import { ChartConfig } from "charts/ChartConfig"
import { computed, action, observable } from "mobx"
import { ChartTypeType } from "charts/ChartType"
import { observer } from "mobx-react"
import { OwidVariable } from "../owidData/OwidVariable"
import { uniqBy } from "lodash"
import { ChartDimension } from "../ChartDimension"
import * as urlBinding from "charts/UrlBinding"
import {
    TimelineOption,
    SmoothingOption,
    TotalFrequencyOption,
    CasesMetricOption,
    TestsMetricOption,
    DailyFrequencyOption,
    CountOption,
    DeathsMetricOption,
    MetricKind,
    ParsedCovidRow,
    CountryOption
} from "./CovidTypes"
import { RadioOption, CovidRadioControl } from "./CovidRadioControl"
import { CountryPicker } from "./CovidCountryPicker"
import { CovidQueryParams, CovidUrl } from "./CovidChartUrl"
import {
    fetchAndParseData,
    RowAccessor,
    buildCovidVariable,
    daysSinceVariable
} from "./CovidData"

@observer
export class CovidChartBuilder extends React.Component<{
    data: ParsedCovidRow[]
    params: CovidQueryParams
}> {
    static async bootstrap() {
        const containerNode = document.getElementById("chartBuilder")
        const typedData = await fetchAndParseData()
        const defaultParams = new CovidQueryParams(window.location.search)
        ReactDOM.render(
            <CovidChartBuilder data={typedData} params={defaultParams} />,
            containerNode
        )
    }

    @computed private get deathsVariable(): OwidVariable {
        if (this.props.params.totalFreq)
            return this.buildVariable("deaths", row => row.total_deaths)
        return this.buildVariable("deaths", row => row.new_deaths)
    }

    @computed private get casesVariable(): OwidVariable {
        if (this.props.params.totalFreq)
            return this.buildVariable("cases", row => row.total_cases)
        return this.buildVariable("cases", row => row.new_cases)
    }

    @computed private get testsVariable(): OwidVariable {
        if (this.props.params.totalFreq)
            return this.buildVariable("tests", row => row.total_tests)
        return this.buildVariable("tests", row => row.new_tests)
    }

    buildVariable(name: MetricKind, rowFn: RowAccessor) {
        const perCapita =
            this.props.params.count === "total"
                ? undefined
                : this.props.params.testsMetric
                ? 1000
                : 1000000
        return buildCovidVariable(
            name,
            this.countryMap,
            this.props.data,
            rowFn,
            perCapita
        )
    }

    @action.bound setDeathsMetricCommand(value: DeathsMetricOption) {
        this.props.params.deathsMetric = value
        this.updateChart()
    }

    @action.bound clearSelectionCommand() {
        this.props.params.selectedCountryCodes.clear()
        this.updateChart()
    }

    @action.bound setCasesMetricCommand(value: CasesMetricOption) {
        this.props.params.casesMetric = value
        this.updateChart()
    }

    @action.bound setTestsMetricCommand(value: TestsMetricOption) {
        this.props.params.testsMetric = value
        this.updateChart()
    }

    setTotalFrequencyCommand(option: TotalFrequencyOption) {
        this.props.params.totalFreq = option
        this.updateChart()
    }

    setDailyFrequencyCommand(option: DailyFrequencyOption) {
        this.props.params.dailyFreq = option
        this.updateChart()
    }

    @action.bound setCountCommand(countOption: CountOption) {
        this.props.params.count = countOption
        this.updateChart()
    }

    setSmoothingCommand(option: SmoothingOption) {
        this.props.params.smoothing = option
        this.updateChart()
    }

    setTimelineCommand(option: TimelineOption) {
        this.props.params.timeline = option
        this.updateChart()
    }

    private get metricPicker() {
        const options: RadioOption[] = [
            {
                label: "Confirmed Deaths",
                checked: this.props.params.deathsMetric,
                onSelect: () => {
                    this.setDeathsMetricCommand(true)
                    this.setCasesMetricCommand(false)
                    this.setTestsMetricCommand(false)
                }
            },
            {
                label: "Confirmed Cases",
                checked: this.props.params.casesMetric,
                onSelect: () => {
                    this.setDeathsMetricCommand(false)
                    this.setCasesMetricCommand(true)
                    this.setTestsMetricCommand(false)
                }
            },
            {
                label: "Tests",
                checked: this.props.params.testsMetric,
                onSelect: () => {
                    this.setDeathsMetricCommand(false)
                    this.setCasesMetricCommand(false)
                    this.setTestsMetricCommand(true)
                }
            }
        ]
        return (
            <CovidRadioControl
                name="metric"
                options={options}
            ></CovidRadioControl>
        )
    }

    private get frequencyPicker() {
        const options: RadioOption[] = [
            {
                label: "Total",
                checked: this.props.params.totalFreq,
                onSelect: () => {
                    this.setTotalFrequencyCommand(true)
                    this.setDailyFrequencyCommand(false)
                }
            },
            {
                label: "Daily",
                checked: this.props.params.dailyFreq,
                onSelect: () => {
                    this.setTotalFrequencyCommand(false)
                    this.setDailyFrequencyCommand(true)
                }
            }
        ]
        return (
            <CovidRadioControl
                name="frequency"
                options={options}
            ></CovidRadioControl>
        )
    }

    @computed private get countPicker() {
        const options: RadioOption[] = [
            {
                label: "Total counts",
                checked: this.props.params.count === "total",
                onSelect: () => {
                    this.setCountCommand("total")
                }
            },
            {
                label: "Per capita statistics",
                checked: this.props.params.count === "perCapita",
                onSelect: () => {
                    this.setCountCommand("perCapita")
                }
            }
        ]
        return (
            <CovidRadioControl
                name="count"
                options={options}
            ></CovidRadioControl>
        )
    }

    private get timelinePicker() {
        const options: RadioOption[] = [
            {
                label: "Normal timeline",
                checked: this.props.params.timeline === "normal",
                onSelect: () => {
                    this.setTimelineCommand("normal")
                }
            },
            {
                label: "Align with the first 5 deaths",
                checked: this.props.params.timeline === "alignFirstFiveDeaths",
                onSelect: () => {
                    this.setTimelineCommand("alignFirstFiveDeaths")
                }
            }
        ]
        return (
            <CovidRadioControl
                name="timeline"
                options={options}
            ></CovidRadioControl>
        )
    }

    private get smoothingPicker() {
        const options: RadioOption[] = [
            {
                label: "Normal",
                checked: this.props.params.smoothing === "normal",
                onSelect: () => {
                    this.setSmoothingCommand("normal")
                }
            },
            {
                label: "3 Day Rolling Average",
                checked:
                    this.props.params.smoothing === "threeDayRollingAverage",
                onSelect: () => {
                    this.setSmoothingCommand("threeDayRollingAverage")
                }
            }
        ]
        return (
            <CovidRadioControl
                name="smoothing"
                options={options}
            ></CovidRadioControl>
        )
    }

    @action.bound toggleSelectedCountryCommand(code: string, value: boolean) {
        if (this.props.params.selectedCountryCodes.has(code))
            this.props.params.selectedCountryCodes.delete(code)
        else this.props.params.selectedCountryCodes.add(code)
        this.updateChart()
    }

    render() {
        const bounds = new Bounds(0, 0, 840, 600)

        return (
            <div className="CovidChartBuilder">
                <div className="CovidChartBuilderSideBar">
                    <CountryPicker
                        chartBuilder={this}
                        toggleCountryCommand={this.toggleSelectedCountryCommand}
                    ></CountryPicker>
                </div>
                <div className="CovidChartBuilderMainBar">
                    <div className="CovidChartBuilderTopBar">
                        {this.metricPicker}
                        {this.frequencyPicker}
                        {this.countPicker}
                        {this.timelinePicker}
                        {this.smoothingPicker}
                    </div>
                    <div className="CovidChartBuilderFigure">
                        <ChartView
                            bounds={bounds}
                            chart={this.chart}
                        ></ChartView>
                    </div>
                </div>
            </div>
        )
    }

    @computed get countryOptions(): CountryOption[] {
        const countries = uniqBy(this.props.data, "iso_code")
        return countries.map(country => {
            return {
                name: country.location,
                selected: this.props.params.selectedCountryCodes.has(
                    country.iso_code
                ),
                slug: country.location,
                code: country.iso_code
            }
        })
    }

    @computed private get availableEntities() {
        return this.countryOptions.map(country => country.name)
    }

    @computed get frequencyTitle() {
        if (this.props.params.dailyFreq && this.props.params.totalFreq)
            return "Total and daily"
        else if (this.props.params.dailyFreq) return "Daily"
        return "Total"
    }

    @computed get countTitle() {
        const { params } = this.props
        if (params.testsMetric && params.count === "perCapita")
            return " per thousand people"
        if (params.count === "perCapita") return " per million people"
        return ""
    }

    @computed get metricTitle() {
        if (this.props.params.casesMetric) return "Cases"
        if (this.props.params.deathsMetric) return "Deaths"
        return "Tests"
    }

    @computed get smoothingTitle() {
        if (this.props.params.smoothing === "threeDayRollingAverage")
            return ", rolling 3-day average"
        return ""
    }

    @computed get title() {
        return `${this.frequencyTitle} COVID-19 ${this.metricTitle}${this.countTitle}${this.smoothingTitle}`
    }

    @computed get note() {
        return "There are substantial differences across countries in terms of the units, whether or not all labs are included, the extent to which negative and pending tests are included and other aspects. Details for each country can be found at ourworldindata.org/covid-testing."
    }

    @computed get selectedData() {
        const countryCodeMap = this.countryCodeMap
        return Array.from(this.props.params.selectedCountryCodes).map(code => {
            return {
                index: 0,
                entityId: countryCodeMap.get(code)
            }
        })
    }

    @computed get theVariables(): OwidVariableSet {
        const variableId = this.yVariableIndex.toString()
        const variableSet: OwidVariableSet = {
            variables: {},
            entityKey: this.entityKey
        }
        if (this.props.params.testsMetric)
            variableSet.variables[variableId] = this.testsVariable

        if (this.props.params.deathsMetric)
            variableSet.variables[variableId] = this.deathsVariable

        if (this.props.params.casesMetric)
            variableSet.variables[variableId] = this.casesVariable

        variableSet.variables[99999] = daysSinceVariable(
            this.props.data,
            this.countryMap
        )

        return variableSet
    }

    @computed get countryMap() {
        const map = new Map()
        this.countryOptions.forEach((country, index) => {
            map.set(country.name, index)
        })
        return map
    }

    @computed get countryCodeMap() {
        const map = new Map()
        this.countryOptions.forEach((country, index) => {
            map.set(country.code, index)
        })
        return map
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

    // Todo: if someone selects "Align with the first N deaths", then we should switch to a scatterplot chart type.
    @computed get chartType(): ChartTypeType {
        return this.props.params.timeline === "normal"
            ? "LineChart"
            : "ScatterPlot"
    }

    // We are computing variables clientside so they don't have a variable index. The variable index is used by Chart
    // in a number of places, so we still need a unique one per variable. The way our system works, changing things like
    // frequency or per capita would be in effect creating a new variable. So we need to generate unique variable ids
    // for all of these combinations.
    @computed get yVariableIndex(): number {
        const params = this.props.params
        const variableMap = {
            tests: 123,
            cases: 456,
            deaths: 789
        }

        let baseVar = variableMap.tests

        if (params.casesMetric) baseVar = variableMap.cases
        if (params.deathsMetric) baseVar = variableMap.deaths

        if (params.dailyFreq) baseVar += 3
        if (params.count === "perCapita") baseVar += 7

        return baseVar
    }

    updateChart() {
        // We can't create a new chart object with every radio change because the Chart component itself
        // maintains state (for example, which tab is currently active). Temporary workaround is just to
        // manually update the chart when the chart builderselections change.
        // todo: cleanup
        const chartProps = this.chart.props
        chartProps.title = this.title
        chartProps.note = this.note
        chartProps.type = this.chartType
        chartProps.owidDataset = this.theVariables
        chartProps.selectedData = this.selectedData
        chartProps.dimensions = this.dimensions
        chartProps.map.variableId = this.yVariableIndex
        chartProps.data!.availableEntities = this.availableEntities

        // this.chart.url.externalBaseUrl = "covid-chart-builder"
        // this.chart.url.externallyProvidedParams = this.props.params.toParams
    }

    componentDidMount() {
        this.bindToWindow()
    }

    bindToWindow() {
        const url = new CovidUrl(this.chart.url, this.props.params)
        urlBinding.bindUrlToWindow(url)
    }

    @computed get dimensions(): ChartDimension[] {
        if (this.chartType === "LineChart")
            return [
                {
                    property: "y",
                    variableId: this.yVariableIndex,
                    display: {}
                }
            ]

        return [
            {
                property: "y",
                variableId: this.yVariableIndex,
                display: {}
            },
            {
                property: "x",
                variableId: 99999,
                display: {
                    name: "Days since the 5th total confirmed death"
                }
            }
        ]
    }

    @observable.ref chart = new ChartConfig(
        {
            slug: "covid-chart-builder",
            type: this.chartType,
            isExplorable: false,
            id: 4128,
            version: 9,
            title: this.title,
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
            owidDataset: this.theVariables,
            selectedData: this.selectedData,
            dimensions: this.dimensions,
            addCountryMode: "disabled",
            stackMode: "absolute",
            hideRelativeToggle: true,
            hasChartTab: true,
            hasMapTab: true,
            tab: "chart",
            isPublished: true,
            map: {
                variableId: this.yVariableIndex,
                targetYear: 85,
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
