export declare type CountOption = "perCapita" | "total"
export declare type SmoothingOption = "normal" | "threeDayRollingAverage"
export declare type TimelineOption = "normal" | "alignFirstFiveDeaths"

export declare type DailyFrequencyOption = boolean
export declare type TotalFrequencyOption = boolean

export declare type DeathsMetricOption = boolean
export declare type CasesMetricOption = boolean
export declare type TestsMetricOption = boolean

export declare type countrySlug = string

export declare type MetricKind = "deaths" | "cases" | "tests"

export interface ParsedCovidRow {
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

export interface CountryOption {
    name: string
    slug: countrySlug
    selected: boolean
    code: string
    continent: string
}
