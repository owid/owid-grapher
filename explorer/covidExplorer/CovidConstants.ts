import { ColumnSpec } from "owidTable/OwidTable"

export const covidPageTitle = "Coronavirus Pandemic Data Explorer"
export const covidDashboardSlug = "coronavirus-data-explorer"
export const coronaOpenGraphImagePath = "coronavirus-data-explorer.png"
export const coronaWordpressElementAttribute = "data-coronavirus-data-explorer"
export const coronaDefaultView =
    "?zoomToSelection=true&time=2020-03-01..latest&country=MEX~IND~USA~ITA~BRA~GBR~FRA~ESP~PER&casesMetric=true&interval=smoothed&perCapita=true&smoothing=7&pickerMetric=total_deaths&pickerSort=desc"
export const covidDataPath =
    "https://covid.ourworldindata.org/data/owid-covid-data.csv"
export const covidLastUpdatedPath =
    "https://covid.ourworldindata.org/data/owid-covid-data-last-updated-timestamp.txt"
export const covidChartAndVariableMetaFilename =
    "covidChartAndVariableMeta.json"
export const covidChartAndVariableMetaPath = `/${covidChartAndVariableMetaFilename}`

export const testRateExcludeList = new Set([
    "Peru",
    "Ecuador",
    "Brazil",
    "Costa Rica"
])

export const covidPreloads = [
    covidDataPath,
    covidChartAndVariableMetaPath,
    covidLastUpdatedPath
]

export declare type SmoothingOption = 0 | 3 | 7 | 14

export declare type IntervalOption =
    | "daily"
    | "weekly"
    | "total"
    | "smoothed"
    | "biweekly"
    | "weeklyChange"
    | "biweeklyChange"

export const intervalOptions: IntervalOption[] = [
    "daily",
    "weekly",
    "total",
    "smoothed",
    "biweekly",
    "weeklyChange",
    "biweeklyChange"
]

export declare type colorScaleOption = "continents" | "ptr" | "none"

export declare type MetricKind =
    | "deaths"
    | "cases"
    | "tests"
    | "case_fatality_rate"
    | "tests_per_case"
    | "positive_test_rate"

export const MetricOptions: MetricKind[] = [
    "deaths",
    "cases",
    "tests",
    "case_fatality_rate",
    "tests_per_case",
    "positive_test_rate"
]

export const sourceCharts = {
    epi: 4258,

    cases_total: 4018,
    cases_daily: 4019,
    cases_total_per_capita: 4051,
    cases_daily_per_capita: 4028,
    cases_weeklys: 4195,
    cases_weeklys_change: 4194,

    deaths_total: 4020,
    deaths_daily: 4021,
    deaths_total_per_capita: 4029,
    deaths_daily_per_capita: 4030,
    deaths_weeklys: 4196,
    deaths_weeklys_change: 4193,

    tests_total: 4191,
    tests_daily: 4307,
    tests_total_per_capita: 4162,
    tests_daily_per_capita: 4191,

    tests_per_case_total: 4197,
    tests_per_case_daily: 4197,

    positive_test_rate_total: 4198,
    positive_test_rate_daily: 4198,

    case_fatality_rate_total: 4056
}

export const sourceVariables = {
    positive_test_rate: 142721,
    tests_per_case: 142754,
    case_fatality_rate: 142600,
    cases: 142582,
    deaths: 142583,
    tests: 142601,
    days_since: 142712,
    continents: 123
}

export const trajectoryColumnSpecs = {
    deaths: {
        total: {
            name: "Days since the 5th total confirmed death",
            threshold: 5,
            owidVariableId: 4561
        },
        daily: {
            name: "Days since 5 daily new deaths first reported",
            threshold: 5,
            owidVariableId: 4562
        },
        perCapita: {
            name: "Days since total confirmed deaths reached 0.1 per million",
            threshold: 0.1,
            owidVariableId: 4563
        }
    },
    cases: {
        total: {
            name: "Days since the 100th confirmed case",
            threshold: 100,
            owidVariableId: 4564
        },
        daily: {
            name: "Days since confirmed cases first reached 30 per day",
            threshold: 30,
            owidVariableId: 4565
        },
        perCapita: {
            name:
                "Days since the total confirmed cases per million people reached 1",
            threshold: 1,
            owidVariableId: 4566
        }
    }
}

export const metricLabels: { [key in MetricKind]: string } = {
    cases: "Confirmed cases",
    deaths: "Confirmed deaths",
    tests: "Tests",
    case_fatality_rate: "Case fatality rate",
    tests_per_case: "Tests per confirmed case",
    positive_test_rate: "Share of positive tests"
}

// todo: auto import from covid repo.
export const covidAnnotations = `location,date,cases_annotations,deaths_annotations
Spain,2020-04-19,methodology change,
Spain,2020-04-25,methodology change,methodology change
Ecuador,2020-05-08,methodology change,
United Kingdom,2020-05-20,methodology change,
France,2020-06-02,methodology change,
India,2020-06-17,,earlier deaths added
Chile,2020-06-18,earlier cases added,
Iran,,July BBC report suggests official numbers may be falsified,July BBC report suggests official numbers may be falsified
Italy,2020-06-25,,methodology change
United States,2020-06-26,,probable/earlier deaths added
United States,2020-07-01,,probable/earlier deaths added
United Kingdom,2020-07-03,methodology change,
Czech Republic,2020-07-05,,methodology change
Kyrgyzstan,2020-07-18,methodology change,methodology change
Chile,2020-07-18,,methodology change
Peru,2020-07-24,,earlier deaths added
European Union,,Some EU countries changed methodology. See country-by-country series.,Some EU countries changed methodology. See country-by-country series.
United Kingdom,2020-08-14,,methodology change`

// https://github.com/owid/covid-19-data/blob/master/public/data/owid-covid-data-codebook.md
export interface ParsedCovidCsvRow {
    iso_code: string
    location: string
    continent: string
    date: string
    total_cases: number
    new_cases: number
    total_deaths: number
    new_deaths: number
    total_cases_per_million: number
    new_cases_per_million: number
    total_deaths_per_million: number
    new_deaths_per_million: number
    total_tests: number
    new_tests: number
    new_tests_smoothed: number
    total_tests_per_thousand: number
    new_tests_per_thousand: number
    new_tests_smoothed_per_thousand: number
    new_cases_smoothed: number
    new_deaths_smoothed: number
    tests_units: string
    stringency_index: number
    population: number
    population_density: number
    median_age: number
    aged_65_older: number
    aged_70_older: number
    gdp_per_capita: number
    life_expectancy: number
    positive_rate: number
    tests_per_case: number
    extreme_poverty: number
    cvd_death_rate: number
    diabetes_prevalence: number
    female_smokers: number
    male_smokers: number
    handwashing_facilities: number
    hospital_beds_per_thousand: number
}

export interface CovidGrapherRow extends ParsedCovidCsvRow {
    group_members?: string
    entityName: string
    entityCode: string
    entityId: number
    day: number
}

export declare type covidCsvColumnSlug = keyof ParsedCovidCsvRow
export const metricPickerColumnSpecs: Partial<Record<
    covidCsvColumnSlug,
    Partial<ColumnSpec>
>> = {
    location: { slug: "location", name: "Country name" },
    population: { slug: "population", name: "Population", type: "Population" },
    population_density: {
        slug: "population_density",
        name: "Population density (people per km²)",
        type: "PopulationDensity"
    },
    median_age: { slug: "median_age", name: "Median age", type: "Age" },
    aged_65_older: {
        slug: "aged_65_older",
        name: "Share aged 65+",
        type: "Percentage"
    },
    aged_70_older: {
        slug: "aged_70_older",
        name: "Share aged 70+",
        type: "Percentage"
    },
    gdp_per_capita: {
        slug: "gdp_per_capita",
        name: "GDP per capita (int.-$)",
        type: "Currency"
    },
    extreme_poverty: {
        slug: "extreme_poverty",
        name: "Population in extreme poverty",
        type: "Percentage"
    },
    hospital_beds_per_thousand: {
        slug: "hospital_beds_per_thousand",
        name: "Hospital beds (per 1000)",
        type: "Ratio"
    },
    stringency_index: {
        slug: "stringency_index",
        name: "Stringency Index",
        type: "Numeric"
    },
    life_expectancy: { name: "Life expectancy", type: "Age" },
    total_deaths: { name: "Total deaths", type: "Integer" },
    new_cases: { name: "New cases", type: "Integer" },
    new_deaths: { name: "New deaths", type: "Integer" },
    total_cases: { name: "Total cases", type: "Integer" },
    total_tests: { name: "Total tests", type: "Integer" },
    total_tests_per_thousand: { name: "Total tests (per 1K)", type: "Ratio" },
    positive_rate: { name: "Positive test rate", type: "DecimalPercentage" },
    tests_per_case: { name: "Tests per case", type: "Ratio" },
    total_deaths_per_million: { name: "Total deaths (per 1M)", type: "Ratio" },
    total_cases_per_million: { name: "Total cases (per 1M)", type: "Ratio" },
    new_deaths_per_million: { name: "New deaths (per 1M)", type: "Ratio" },
    new_cases_per_million: { name: "New cases (per 1M)", type: "Ratio" }
}
