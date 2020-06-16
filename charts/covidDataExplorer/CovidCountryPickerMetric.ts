import {
    last,
    excludeUndefined,
    sortBy,
    formatValue,
    isNumber
} from "charts/Util"
import { ParsedCovidRow, CountryOption } from "./CovidTypes"

export enum CountryPickerMetric {
    location = "location",
    population = "population",
    population_density = "population_density",
    median_age = "median_age",
    aged_65_older = "aged_65_older",
    aged_70_older = "aged_70_older",
    gdp_per_capita = "gdp_per_capita",
    extreme_poverty = "extreme_poverty",
    hospital_beds_per_thousand = "hospital_beds_per_thousand",
    tests_per_case = "tests_per_case"
}

export type CountryPickerMetricAccessor = (
    option: CountryOption
) => number | string | undefined

export interface CountryPickerMetricSpec {
    label: string
    accessor: CountryPickerMetricAccessor
    formatValue: (value: string | number | undefined) => string | undefined
}

export const metricSpecs: Record<
    CountryPickerMetric,
    CountryPickerMetricSpec
> = {
    location: {
        label: "Country name",
        accessor: option => option.name,
        formatValue: () => undefined
    },
    population: {
        label: "Population",
        accessor: option =>
            getLatestFromRows(option.rows, row => row.population),
        formatValue: value =>
            isNumber(value)
                ? formatValue(value, {
                      numDecimalPlaces: 0,
                      noTrailingZeroes: false,
                      numberPrefixes: false
                  })
                : undefined
    },
    population_density: {
        label: "Population density (people per km²)",
        accessor: option =>
            getLatestFromRows(option.rows, row => row.population_density),
        formatValue: value =>
            isNumber(value)
                ? formatValue(value, {
                      numDecimalPlaces: 0,
                      noTrailingZeroes: false,
                      numberPrefixes: false
                  })
                : undefined
    },
    median_age: {
        label: "Median age",
        accessor: option =>
            getLatestFromRows(option.rows, row => row.median_age),
        formatValue: value =>
            isNumber(value)
                ? formatValue(value, {
                      numDecimalPlaces: 1,
                      noTrailingZeroes: false,
                      numberPrefixes: false
                  })
                : undefined
    },
    aged_65_older: {
        label: "Share aged 65+",
        accessor: option =>
            getLatestFromRows(option.rows, row => row.aged_65_older),
        formatValue: value =>
            isNumber(value)
                ? formatValue(value, {
                      numDecimalPlaces: 0,
                      noTrailingZeroes: false,
                      numberPrefixes: false,
                      unit: "%"
                  })
                : undefined
    },
    aged_70_older: {
        label: "Share aged 70+",
        accessor: option =>
            getLatestFromRows(option.rows, row => row.aged_70_older),
        formatValue: value =>
            isNumber(value)
                ? formatValue(value, {
                      numDecimalPlaces: 0,
                      noTrailingZeroes: false,
                      numberPrefixes: false,
                      unit: "%"
                  })
                : undefined
    },
    gdp_per_capita: {
        label: "GDP per capita (int.-$)",
        accessor: option =>
            getLatestFromRows(option.rows, row => row.gdp_per_capita),
        formatValue: value =>
            isNumber(value)
                ? formatValue(value, {
                      numDecimalPlaces: 0,
                      noTrailingZeroes: false,
                      numberPrefixes: false,
                      unit: "$"
                  })
                : undefined
    },
    extreme_poverty: {
        label: "Population in extreme poverty",
        accessor: option =>
            getLatestFromRows(option.rows, row => row.extreme_poverty),
        formatValue: value =>
            isNumber(value)
                ? formatValue(value, {
                      numDecimalPlaces: 0,
                      noTrailingZeroes: false,
                      numberPrefixes: false,
                      unit: "%"
                  })
                : undefined
    },
    hospital_beds_per_thousand: {
        label: "Hospital beds (per 1000)",
        accessor: option =>
            getLatestFromRows(
                option.rows,
                row => row.hospital_beds_per_thousand
            ),
        formatValue: value =>
            isNumber(value)
                ? formatValue(value, {
                      numDecimalPlaces: 1,
                      noTrailingZeroes: false,
                      numberPrefixes: false
                  })
                : undefined
    },
    tests_per_case: {
        label: "Tests per case",
        accessor: option =>
            getLatestFromRows(option.rows, row =>
                row.total_cases !== undefined &&
                row.total_tests !== undefined &&
                row.total_cases > 0 &&
                row.total_tests > 0
                    ? row.total_tests / row.total_cases
                    : undefined
            ),
        formatValue: value =>
            isNumber(value)
                ? formatValue(value, {
                      numDecimalPlaces: 1,
                      noTrailingZeroes: false,
                      numberPrefixes: false
                  })
                : undefined
    }
}

function getLatestFromRows(
    rows: ParsedCovidRow[],
    accessor: (row: ParsedCovidRow) => number | string | undefined
): ReturnType<CountryPickerMetricAccessor> {
    return last(excludeUndefined(sortBy(rows, row => row.date).map(accessor)))
}
