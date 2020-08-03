import { MetricKind } from "./CovidTypes"

export const covidPageTitle = "Coronavirus Pandemic Data Explorer"
export const covidDashboardSlug = "coronavirus-data-explorer"
export const coronaOpenGraphImagePath = "coronavirus-data-explorer.png"
export const coronaWordpressElementAttribute = "data-coronavirus-data-explorer"
export const covidDataExplorerContainerId = "covidDataExplorerContainer"
export const coronaDefaultView =
    "yScale=log&zoomToSelection=true&casesMetric=true&dailyFreq=true&aligned=true&smoothing=7&country=USA~GBR~CAN~BRA~AUS~IND~DEU~MEX~ZAF~COL~KOR~NOR~UGA~NGA&pickerMetric=location&pickerSort=asc"
export const covidDataPath =
    "https://covid.ourworldindata.org/data/owid-covid-data.csv"
export const covidLastUpdatedPath =
    "https://covid.ourworldindata.org/data/owid-covid-data-last-updated-timestamp.txt"
export const covidChartAndVariableMetaFilename =
    "covidChartAndVariableMeta.json"
export const covidChartAndVariableMetaPath = `/${covidChartAndVariableMetaFilename}`

export const testRateExcludeList = new Set(["Peru", "Ecuador", "Brazil"])

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
Italy,2020-06-25,,methodology change
United States,2020-06-26,,probable/earlier deaths added
United States,2020-07-01,,probable/earlier deaths added
United Kingdom,2020-07-03,methodology change,
Czech Republic,2020-07-05,,methodology change
Kyrgyzstan,2020-07-18,methodology change,methodology change
Chile,2020-07-18,,methodology change
Peru,2020-07-24,,earlier deaths added
European Union,,Some EU countries changed methodology. See country-by-country series.,Some EU countries changed methodology. See country-by-country series.`
