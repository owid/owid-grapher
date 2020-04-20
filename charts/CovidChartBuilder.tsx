import { OwidVariableSet, OwidEntityKey } from "./owidData/OwidVariableSet"
import React from "react"
import ReactDOM from "react-dom"
import { ChartView } from "charts/ChartView"
import { Bounds } from "charts/Bounds"
import { ChartConfig } from "charts/ChartConfig"
import { computed, action, observable } from "mobx"
import { csv } from "d3-fetch"
import { ChartTypeType } from "charts/ChartType"
import { observer } from "mobx-react"
import { OwidVariable } from "./owidData/OwidVariable"
import { uniqBy, sortBy } from "lodash"
import { dateDiffInDays } from "charts/Util"
import moment from "moment"
import { ChartDimension } from "./ChartDimension"
import { FuzzySearch } from "./FuzzySearch"

@observer
class CountryPicker extends React.Component<{
    chartBuilder: CovidChartBuilder
    toggleCountryCommand: (countryCode: string, value: boolean) => void
}> {
    @action.bound onChange(ev: React.FormEvent<HTMLInputElement>) {
        this.props.toggleCountryCommand(
            ev.currentTarget.value,
            ev.currentTarget.checked
        )
    }

    @computed get fuzzy(): FuzzySearch<CountryOption> {
        return new FuzzySearch(this.options, "name")
    }

    @computed get searchResults(): CountryOption[] {
        const results = this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : this.options
        return sortBy(results, result => result.name)
    }

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {}

    @computed get options() {
        return this.props.chartBuilder.countryOptions
    }

    @observable searchInput?: string
    searchField!: HTMLInputElement

    render() {
        return (
            <div>
                <input
                    type="search"
                    placeholder="Search..."
                    value={this.searchInput}
                    onInput={e => (this.searchInput = e.currentTarget.value)}
                    onKeyDown={this.onSearchKeyDown}
                    ref={e => (this.searchField = e as HTMLInputElement)}
                />
                <div onClick={this.props.chartBuilder.clearSelectionCommand}>
                    X Clear selection
                </div>

                {this.searchResults.map((option, index) => (
                    <div key={index}>
                        <label>
                            <input
                                type="checkbox"
                                checked={option.selected}
                                onChange={this.onChange}
                                value={option.code}
                            />
                            {option.name}
                        </label>
                    </div>
                ))}
            </div>
        )
    }
}

declare type countrySlug = string

interface CountryOption {
    name: string
    slug: countrySlug
    selected: boolean
    code: string
}

interface ParsedCovidRow {
    iso_code: string
    location: string
    date: string
    total_cases: number
    new_cases: number
    total_deaths: number
    new_deaths: number
    total_cases_per_million: number
    new_deaths_per_million: number
    total_tests: number
    new_tests: number
    total_tests_per_thousand: number
    new_tests_per_thousand: number
    tests_units: string
}

interface RadioOption {
    label: string
    checked: boolean
    onSelect: () => void
}

@observer
class CovidRadioControl extends React.Component<{
    name: string
    options: RadioOption[]
}> {
    @action.bound onChange(ev: React.ChangeEvent<HTMLInputElement>) {
        this.props.options[parseInt(ev.currentTarget.value)].onSelect()
    }

    render() {
        return (
            <div className="CovidChartBuilderRadio">
                {this.props.options.map((option, index) => (
                    <div key={index}>
                        <label>
                            <input
                                onChange={this.onChange}
                                type="radio"
                                name={this.props.name}
                                checked={option.checked}
                                value={index}
                            />{" "}
                            {option.label}
                        </label>
                    </div>
                ))}
            </div>
        )
    }
}

// Todo: cleanup
const keepStrings = new Set(`iso_code location date tests_units`.split(" "))

const parseRow = (row: any) => {
    Object.keys(row).forEach(key => {
        const isNumeric = !keepStrings.has(key)
        if (isNumeric) row[key] = row[key] ? parseFloat(row[key]) : 0
    })
    return row
}

declare type CountOption = "perCapita" | "total"
declare type SmoothingOption = "normal" | "threeDayRollingAverage"
declare type TimelineOption = "normal" | "alignFirstFiveDeaths"

declare type DailyFrequencyOption = boolean
declare type TotalFrequencyOption = boolean

declare type DeathsMetricOption = boolean
declare type CasesMetricOption = boolean
declare type TestsMetricOption = boolean

declare type MetricKind = "deaths" | "cases" | "tests"

const EPOCH_DATE = "2020-01-21"

const dateToYear = (dateString: string): number =>
    dateDiffInDays(
        moment.utc(dateString).toDate(),
        moment.utc(EPOCH_DATE).toDate()
    )

class CovidQueryParams {
    @observable.ref testsMetric: boolean = false
    @observable.ref deathsMetric: boolean = true
    @observable.ref casesMetric: boolean = false
    @observable.ref totalFreq: boolean = true
    @observable.ref dailyFreq: boolean = false
    @observable.ref count: CountOption = "total"
    @observable.ref timeline: TimelineOption = "normal"
    @observable.ref smoothing: SmoothingOption = "normal"
    @observable selectedCountryCodes: Set<string> = new Set(["CAN"])
}

const variablePartials: { [name: string]: Partial<OwidVariable> } = {
    cases: {
        id: 142581,
        name: "Daily new confirmed deaths due to COVID-19",
        unit: "",
        description: "",
        coverage: "",
        display: {
            name: "Daily confirmed deaths",
            unit: "deaths",
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name:
                "European CDC – Situation Update Worldwide – Last updated 18th April, 11:15 (London time)",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link: "https://github.com/owid/covid-19-data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    deaths: {
        id: 142583,
        name: "Total confirmed deaths due to COVID-19",
        unit: "",
        description: "",
        coverage: "",
        display: {
            unit: "deaths",
            zeroDay: "2020-01-21",
            yearIsDay: true
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name:
                "European CDC – Situation Update Worldwide – Last updated 18th April, 11:15 (London time)",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link: "https://github.com/owid/covid-19-data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    tests: {
        id: 1000001,
        name: "tests",
        unit: "",
        description: "",
        coverage: "",
        datasetId: "covid",
        shortUnit: "",
        display: {
            name:
                "3-day rolling mean of daily change in total tests per thousand",
            yearIsDay: true,
            entityAnnotationsMap:
                "Argentina: tests performed\nAustralia: units unclear\nAustria: units unclear\nBahrain: units unclear\nBangladesh: samples tested\nBelgium: tests performed\nBolivia: cases tested\nCanada: people tested\nChile: tests performed\nColombia: samples processed\nCosta Rica: people tested\nCzech Republic: tests performed\nDenmark: people tested\nEcuador: samples tested\nEl Salvador: tests performed\nEstonia: units unclear\nEthiopia: tests performed\nFinland: tests sampled\nFrance: units unclear\nGermany: tests performed\nGhana: people tested\nGreece: people tested\nHong Kong: tests performed\nHungary: tests performed\nIceland: units unclear\nIndia: samples tested\nIndonesia: units unclear\nIreland: units unclear\nIsrael: units unclear\nItaly: tests performed\nJapan: people tested\nLatvia: tests performed\nLithuania: samples analyzed\nLuxembourg: tests analysed\nMalaysia: cases tested\nMexico: cases tested\nNetherlands: people tested\nNew Zealand: units unclear\nNorway: people tested\nPakistan: tests performed\nPanama: units unclear\nParaguay: samples tested\nPeru: units unclear\nPhilippines: people tested\nPoland: samples tested\nPortugal: cases tested\nRomania: tests performed\nRussia: tests performed\nSenegal: tests performed\nSerbia: people tested\nSingapore: people tested\nSlovakia: analysed samples\nSlovenia: tests performed\nSouth Africa: units unclear\nSouth Korea: cases tested\nSpain: tests performed\nSweden: people tested\nSwitzerland: tests performed\nTaiwan: tests performed\nThailand: people tested\nTunisia: units unclear\nTurkey: units unclear\nUnited Kingdom: people tested\nUnited States: inconsistent units (COVID Tracking Project)\nUruguay: units unclear\nVietnam: units unclear\n"
        },
        datasetName: "COVID testing time series data (17 April 18:00)",
        source: {
            id: 17805,
            name: "Official data collated by Our World in Data",
            dataPublishedBy:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            dataPublisherSource:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            link:
                "ourworldindata.org/covid-testing#source-information-country-by-country",
            retrievedDate: "",
            additionalInfo:
                "Data on COVID-19 testing. Comparisons between countries are compromised for several reasons.\n\nYou can download the full dataset, alongside detailed source descriptions here: https://github.com/owid/covid-19-data/tree/master/public/data/testing"
        }
    }
}

declare type RowAccessor = (row: ParsedCovidRow) => number

// Rolling average

const buildVariable = (
    name: MetricKind,
    countryMap: Map<any, any>,
    data: ParsedCovidRow[],
    rowFn: RowAccessor,
    perCapita?: number
): OwidVariable => {
    const filtered = data.filter(rowFn)
    const years = filtered.map(row => dateToYear(row.date))
    let values = filtered.map(rowFn)
    const entities = filtered.map(row => countryMap.get(row.location))
    if (perCapita)
        values = filtered.map((row, index) => {
            const pop = populationMap[row.location]
            const value = rowFn(row)
            return perCapita * (value / pop)
        })

    const variable: Partial<OwidVariable> = {
        ...variablePartials[name],
        years,
        entities,
        values
    }

    return variable as OwidVariable
}

@observer
export class CovidChartBuilder extends React.Component<{
    data: ParsedCovidRow[]
    params: CovidQueryParams
}> {
    static async bootstrap() {
        const containerNode = document.getElementById("chartBuilder")
        const rawData = await csv(this.csvPath)
        const typedData: ParsedCovidRow[] = rawData.map(parseRow)
        const defaultParams = new CovidQueryParams()
        ReactDOM.render(
            <CovidChartBuilder data={typedData} params={defaultParams} />,
            containerNode
        )
    }

    static localCsvPath = "http://localhost:3099/owid-covid-data.csv"
    static csvPath = "https://covid.ourworldindata.org/data/owid-covid-data.csv"

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

    buildVariable(name: MetricKind, rowFn: RowAccessor) {
        const perCapita =
            this.props.params.count === "total"
                ? undefined
                : this.props.params.testsMetric
                ? 1000
                : 1000000
        return buildVariable(
            name,
            this.countryMap,
            this.props.data,
            rowFn,
            perCapita
        )
    }

    // Todo: we need to ensure these don't conflict with chart query params
    populateFromQueryParams(params: CovidQueryParams) {}

    @computed private get testsVariable(): OwidVariable {
        if (this.props.params.totalFreq)
            return this.buildVariable("tests", row => row.total_tests)
        return this.buildVariable("tests", row => row.new_tests)
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
                variableId: 142590,
                display: {
                    name: "Days since the 5th total confirmed death"
                }
            }
        ]
    }

    @observable.ref chart = new ChartConfig({
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
    })
}

// todo: move to separate file. can we reuse this elsewhere?
const populationMap: { [country: string]: number } = {
    Afghanistan: 38928341,
    Africa: 1340598113,
    Albania: 2877800,
    Algeria: 43851043,
    "American Samoa": 55197,
    Andorra: 77265,
    Angola: 32866268,
    Anguilla: 15002,
    "Antigua and Barbuda": 97928,
    Argentina: 45195777,
    Armenia: 2963234,
    Aruba: 106766,
    Asia: 4641054786,
    Australia: 25499881,
    Austria: 9006400,
    Azerbaijan: 10139175,
    Bahamas: 393248,
    Bahrain: 1701583,
    Bangladesh: 164689383,
    Barbados: 287371,
    Belarus: 9449321,
    Belgium: 11589616,
    Belize: 397621,
    Benin: 12123198,
    Bermuda: 62273,
    Bhutan: 771612,
    Bolivia: 11673029,
    "Bonaire Sint Eustatius and Saba": 26221,
    "Bosnia and Herzegovina": 3280815,
    Botswana: 2351625,
    Brazil: 212559409,
    "British Virgin Islands": 30237,
    Brunei: 437483,
    Bulgaria: 6948445,
    "Burkina Faso": 20903278,
    Burundi: 11890781,
    Cambodia: 16718971,
    Cameroon: 26545864,
    Canada: 37742157,
    "Cape Verde": 555988,
    Caribbean: 43532374,
    "Cayman Islands": 65720,
    "Central African Republic": 4829764,
    "Central America": 179670186,
    "Central Asia": 74338926,
    "Central and Southern Asia": 2014708531,
    Chad: 16425859,
    "Channel Islands": 173859,
    Chile: 19116209,
    China: 1439323774,
    Colombia: 50882884,
    Comoros: 869595,
    Congo: 5518092,
    "Cook Islands": 17564,
    "Costa Rica": 5094114,
    "Cote d'Ivoire": 26378275,
    Croatia: 4105268,
    Cuba: 11326616,
    Curacao: 164100,
    Cyprus: 1207361,
    "Czech Republic": 10708982,
    "Democratic Republic of Congo": 89561404,
    Denmark: 5792203,
    Djibouti: 988002,
    Dominica: 71991,
    "Dominican Republic": 10847904,
    "Eastern Africa": 445405578,
    "Eastern Europe": 293013210,
    Ecuador: 17643060,
    Egypt: 102334403,
    "El Salvador": 6486201,
    "Equatorial Guinea": 1402985,
    Eritrea: 3546427,
    Estonia: 1326539,
    Ethiopia: 114963583,
    Europe: 747636045,
    "Faeroe Islands": 48865,
    "Falkland Islands": 3483,
    Fiji: 896444,
    Finland: 5540718,
    France: 65273512,
    "French Guiana": 298682,
    "French Polynesia": 280904,
    Gabon: 2225728,
    Gambia: 2416664,
    Georgia: 3989175,
    Germany: 83783945,
    Ghana: 31072945,
    Gibraltar: 33691,
    Greece: 10423056,
    Greenland: 56772,
    Grenada: 112519,
    Guadeloupe: 400127,
    Guam: 168783,
    Guatemala: 17915567,
    Guinea: 13132792,
    "Guinea-Bissau": 1967998,
    Guyana: 786559,
    Haiti: 11402533,
    "High-income countries": 1263092934,
    Honduras: 9904608,
    "Hong Kong": 7496988,
    Hungary: 9660350,
    Iceland: 341250,
    India: 1380004385,
    Indonesia: 273523621,
    Iran: 83992953,
    Iraq: 40222503,
    Ireland: 4937796,
    "Isle of Man": 85032,
    Israel: 8655541,
    Italy: 60461828,
    Jamaica: 2961161,
    Japan: 126476458,
    Jordan: 10203140,
    Kazakhstan: 18776707,
    Kenya: 53771300,
    Kiribati: 119446,
    Kosovo: 1932774,
    Kuwait: 4270563,
    Kyrgyzstan: 6524191,
    "Land-locked Developing Countries (LLDC)": 533143398,
    Laos: 7275556,
    "Latin America and the Caribbean": 653962332,
    Latvia: 1886202,
    "Least developed countries": 1057438163,
    Lebanon: 6825442,
    Lesotho: 2142252,
    "Less developed regions": 6521494468,
    Liberia: 5057677,
    Libya: 6871287,
    Liechtenstein: 38137,
    Lithuania: 2722291,
    "Low-income countries": 775710612,
    "Lower-middle-income countries": 3098235284,
    Luxembourg: 625976,
    Macao: 649342,
    Macedonia: 2083380,
    Madagascar: 27691019,
    Malawi: 19129955,
    Malaysia: 32365998,
    Maldives: 540542,
    Mali: 20250834,
    Malta: 441539,
    "Marshall Islands": 59194,
    Martinique: 375265,
    Mauritania: 4649660,
    Mauritius: 1271767,
    Mayotte: 272813,
    Melanesia: 11122990,
    Mexico: 128932753,
    Micronesia: 548927,
    "Micronesia (country)": 115021,
    "Middle Africa": 179595125,
    "Middle-income countries": 5753051615,
    Moldova: 4033963,
    Monaco: 39244,
    Mongolia: 3278292,
    Montenegro: 628062,
    Montserrat: 4999,
    "More developed regions": 1273304261,
    Morocco: 36910558,
    Mozambique: 31255435,
    Myanmar: 54409794,
    Namibia: 2540916,
    Nauru: 10834,
    Nepal: 29136808,
    Netherlands: 17134873,
    "New Caledonia": 285491,
    "New Zealand": 4822233,
    Nicaragua: 6624554,
    Niger: 24206636,
    Nigeria: 206139587,
    Niue: 1618,
    "North America": 368869644,
    "North Korea": 25778815,
    "Northern Africa": 246232508,
    "Northern Africa and Western Asia": 525869282,
    "Northern America": 368869644,
    "Northern Europe": 106261271,
    "Northern Mariana Islands": 57557,
    Norway: 5421242,
    Oceania: 42677809,
    Oman: 5106622,
    Pakistan: 220892331,
    Palau: 18092,
    Palestine: 5101416,
    Panama: 4314768,
    "Papua New Guinea": 8947027,
    Paraguay: 7132530,
    Peru: 32971846,
    Philippines: 109581085,
    Poland: 37846605,
    Polynesia: 683778,
    Portugal: 10196707,
    "Puerto Rico": 2860840,
    Qatar: 2881060,
    Reunion: 895308,
    Romania: 19237682,
    Russia: 145934460,
    Rwanda: 12952209,
    "Saint Barthlemy": 9885,
    "Saint Helena": 6071,
    "Saint Kitts and Nevis": 53192,
    "Saint Lucia": 183629,
    "Saint Martin (French part)": 38659,
    "Saint Pierre and Miquelon": 5795,
    "Saint Vincent and the Grenadines": 110947,
    Samoa: 198410,
    "San Marino": 33938,
    "Sao Tome and Principe": 219161,
    "Saudi Arabia": 34813867,
    Senegal: 16743930,
    Serbia: 6804596,
    "Serbia (including Kosovo)": 8737370,
    Seychelles: 98340,
    "Sierra Leone": 7976985,
    Singapore: 5850343,
    "Sint Maarten (Dutch part)": 42882,
    Slovakia: 5459643,
    Slovenia: 2078932,
    "Small Island Developing States (SIDS)": 72076098,
    "Solomon Islands": 686878,
    Somalia: 15893219,
    "South Africa": 59308690,
    "South America": 430759772,
    "South Korea": 51269183,
    "South Sudan": 11193729,
    "South-Eastern Asia": 668619854,
    "Southern Africa": 67503647,
    "Southern Asia": 1940369605,
    "Southern Europe": 152215243,
    Spain: 46754783,
    "Sri Lanka": 21413250,
    "Sub-Saharan Africa": 1094365605,
    Sudan: 43849269,
    Suriname: 586634,
    Swaziland: 1160164,
    Sweden: 10099270,
    Switzerland: 8654618,
    Syria: 17500657,
    Taiwan: 23816775,
    Tajikistan: 9537642,
    Tanzania: 59734213,
    Thailand: 69799978,
    Timor: 1318442,
    Togo: 8278737,
    Tokelau: 1350,
    Tonga: 105697,
    "Trinidad and Tobago": 1399491,
    Tunisia: 11818618,
    Turkey: 84339067,
    Turkmenistan: 6031187,
    "Turks and Caicos Islands": 38718,
    Tuvalu: 11792,
    Uganda: 45741000,
    Ukraine: 43733759,
    "United Arab Emirates": 9890400,
    "United Kingdom": 67886004,
    "United States": 331002647,
    "United States Virgin Islands": 104423,
    "Upper-middle-income countries": 2654816331,
    Uruguay: 3473727,
    Uzbekistan: 33469199,
    Vanuatu: 307150,
    Vatican: 809,
    Venezuela: 28435943,
    Vietnam: 97338583,
    "Wallis and Futuna": 11246,
    "Western Africa": 401861255,
    "Western Asia": 279636774,
    "Western Europe": 196146321,
    "Western Sahara": 597330,
    World: 7794798729,
    Yemen: 29825968,
    Zambia: 18383956,
    Zimbabwe: 14862927
}
