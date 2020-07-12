export const covidDashboardSlug = "coronavirus-data-explorer"
export const coronaOpenGraphImagePath = "coronavirus-data-explorer.png"
export const coronaWordpressElementAttribute = "data-coronavirus-data-explorer"
export const covidDataExplorerContainerId = "covidDataExplorerContainer"
export const coronaDefaultView =
    "yScale=log&zoomToSelection=true&deathsMetric=true&dailyFreq=true&aligned=true&smoothing=7&country=USA~GBR~CAN~BRA~AUS~IND~DEU~FRA~MEX~CHL~ZAF~DZA~COL"
export const covidDataPath =
    "https://covid.ourworldindata.org/data/owid-covid-data.csv"
export const covidLastUpdatedPath =
    "https://covid.ourworldindata.org/data/owid-covid-data-last-updated-timestamp.txt"
export const covidChartAndVariableMetaFilename =
    "covidChartAndVariableMeta.json"
export const covidChartAndVariableMetaPath = `/${covidChartAndVariableMetaFilename}`

export const sourceCharts = {
    epi: 4258,

    cases_total: 4018,
    cases_daily: 4019,
    cases_total_per_capita: 4051,
    cases_daily_per_capita: 4051, // todo: is there a custom one to use?

    deaths_total: 4020,
    deaths_daily: 4021,
    deaths_total_per_capita: 4029,
    deaths_daily_per_capita: 4030,

    tests_total: 4191, // todo: is there a custom one to use?
    tests_daily: 4191, // todo: is there a custom one to use?
    tests_total_per_capita: 4162,
    tests_daily_per_capita: 4191, // todo: is there a custom one to use?

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
