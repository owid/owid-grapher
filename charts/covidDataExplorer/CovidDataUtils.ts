import {
    dateDiffInDays,
    maxBy,
    computeRollingAverage,
    flatten,
    cloneDeep,
    map,
    groupBy,
    parseFloatOrUndefined,
    insertMissingValuePlaceholders
} from "charts/Util"
import moment from "moment"
import { ParsedCovidRow, MetricKind, CountryOption } from "./CovidTypes"
import { OwidVariable } from "charts/owidData/OwidVariable"
import { populationMap } from "./CovidPopulationMap"
import { variablePartials } from "./CovidVariablePartials"
import { csv } from "d3-fetch"
import { labelsByRegion, worldRegionByMapEntity } from "charts/WorldRegions"

const keepStrings = new Set(`iso_code location date tests_units`.split(" "))

export const parseCovidRow = (row: any) => {
    Object.keys(row).forEach(key => {
        const isNumeric = !keepStrings.has(key)
        if (isNumeric) row[key] = parseFloatOrUndefined(row[key])
        if (key === "iso_code" && !row.iso_code) {
            if (row.location === "World") row.iso_code = "OWID_WRL"
            else if (row.location === "International") row.iso_code = "OWID_INT"
        }
    })
    return row
}

export const getLatestTotalTestsPerCase = (
    rows: ParsedCovidRow[]
): number | undefined => {
    const row = maxBy(
        rows.filter(r => r.total_tests && r.total_cases),
        r => r.date
    )
    if (row) {
        return row.total_tests / row.total_cases
    }
    return undefined
}

const EPOCH_DATE = "2020-01-21"

const dateToYear = (dateString: string): number =>
    dateDiffInDays(
        moment.utc(dateString).toDate(),
        moment.utc(EPOCH_DATE).toDate()
    )

export declare type RowAccessor = (row: ParsedCovidRow) => number | undefined

export const covidDataPath =
    "https://covid.ourworldindata.org/data/owid-covid-data.csv"

export const covidLastUpdatedPath =
    "https://covid.ourworldindata.org/data/owid-covid-data-last-updated-timestamp.txt"

export const fetchAndParseData = async (): Promise<ParsedCovidRow[]> => {
    const rawData = await csv(covidDataPath)
    return rawData
        .map(parseCovidRow)
        .filter(
            row => row.location !== "World" && row.location !== "International"
        )
}

export const makeCountryOptions = (data: ParsedCovidRow[]): CountryOption[] => {
    const rowsByCountry = groupBy(data, "iso_code")
    return map(rowsByCountry, rows => {
        const { location, iso_code } = rows[0]
        return {
            name: location,
            slug: location,
            code: iso_code,
            population: populationMap[location],
            continent: labelsByRegion[worldRegionByMapEntity[location]],
            latestTotalTestsPerCase: getLatestTotalTestsPerCase(rows),
            rows: rows
        }
    })
}

export const continentsVariable = (countryOptions: CountryOption[]) => {
    const variable: Partial<OwidVariable> = {
        ...variablePartials.continents,
        years: countryOptions.map(country => 2020),
        entities: countryOptions.map((country, index) => index),
        values: countryOptions.map(country => country.continent)
    }

    return variable as OwidVariable
}

export const daysSinceVariable = (
    data: ParsedCovidRow[],
    countryMap: Map<string, number>,
    predicate: (row: ParsedCovidRow) => boolean
) => {
    let currentCountry = ""
    let firstCountryDate = ""
    const dataWeNeed = data
        .map(row => {
            if (row.location !== currentCountry) {
                if (!predicate(row)) return undefined
                currentCountry = row.location
                firstCountryDate = row.date
            }
            return {
                year: dateToYear(row.date),
                entity: countryMap.get(row.location)!,
                // Not all countries have a row for each day, so we need to compute the difference between the current row and the first threshold
                // row for that country.
                value: dateDiffInDays(
                    moment.utc(row.date).toDate(),
                    moment.utc(firstCountryDate).toDate()
                )
            }
        })
        .filter(row => row)

    const variable: Partial<OwidVariable> = {
        ...variablePartials.days_since_five,
        years: dataWeNeed.map(row => row!.year),
        entities: dataWeNeed.map(row => row!.entity),
        values: dataWeNeed.map(row => row!.value)
    }

    return variable as OwidVariable
}

export const buildCovidVariableId = (
    name: MetricKind,
    perCapita: number,
    rollingAverage?: number,
    daily?: boolean
): number => {
    const arbitraryStartingPrefix = 1145
    const parts = [
        arbitraryStartingPrefix,
        name === "tests" ? 0 : name === "cases" ? 1 : 2,
        daily ? 1 : 0,
        perCapita,
        rollingAverage
    ]
    return parseInt(parts.join(""))
}

export const buildCovidVariable = (
    newId: number,
    name: MetricKind,
    countryMap: Map<string, number>,
    data: ParsedCovidRow[],
    rowFn: RowAccessor,
    perCapita: number,
    rollingAverage?: number,
    daily?: boolean,
    updatedTime?: string
): OwidVariable => {
    const filtered = data.filter(d => rowFn(d) !== undefined)
    const years = filtered.map(row => dateToYear(row.date))
    const entityNames = filtered.map(row => row.location)
    const entities = filtered.map(row => countryMap.get(row.location)!)
    // force to number[] as undefined were filtered above
    let values = filtered.map(rowFn) as number[]
    if (perCapita > 1)
        values = filtered.map((row, index) => {
            const pop = populationMap[row.location]
            if (!populationMap[row.location])
                throw new Error(`Missing population for ${row.location}`)
            const value = rowFn(row) as number
            return perCapita * (value / pop)
        })

    if (rollingAverage) {
        const averages: number[][] = []
        let currentEntity = entities[0]
        let currentValues: number[] = []
        let currentDates: number[] = []
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i]
            if (currentEntity !== entity) {
                averages.push(
                    computeRollingAverage(
                        insertMissingValuePlaceholders(
                            currentValues,
                            currentDates
                        ),
                        rollingAverage
                    ).filter(value => value !== undefined) as number[]
                )
                currentValues = []
                currentDates = []
                currentEntity = entity
            }
            currentValues.push(values[i])
            currentDates.push(years[i])
        }
        values = flatten(averages)
    }

    const clone = cloneDeep(variablePartials[name])

    const variable: Partial<OwidVariable> = {
        ...clone,
        years,
        entities,
        entityNames,
        values
    }

    variable.source!.name = `${variable.source!.name}${updatedTime}`

    variable.id = newId

    const messages: { [index: number]: string } = {
        1: "",
        1000: " per thousand people",
        1000000: " per million people"
    }

    variable.display!.name = `${daily ? "Daily " : "Total "}${
        variable.display!.name
    }${messages[perCapita]}`

    // Show decimal places for rolling average & per capita variables
    if (perCapita > 1) {
        variable.display!.numDecimalPlaces = 2
    } else if (rollingAverage && rollingAverage > 1) {
        variable.display!.numDecimalPlaces = 1
    } else {
        variable.display!.numDecimalPlaces = 0
    }

    return variable as OwidVariable
}

export const getTrajectoryOptions = (
    metric: MetricKind,
    daily: boolean,
    perCapita: boolean
) => {
    return trajectoryOptions[metric][
        perCapita ? "perCapita" : daily ? "daily" : "total"
    ]
}

const trajectoryOptions = {
    deaths: {
        total: {
            title: "Days since the 5th total confirmed death",
            fn: (row: ParsedCovidRow) => row.total_deaths >= 5
        },
        daily: {
            title: "Days since 5 daily deaths first reported",
            fn: (row: ParsedCovidRow) => row.new_deaths >= 5
        },
        perCapita: {
            title: "Days since total confirmed deaths reached 0.1 per million",
            fn: (row: ParsedCovidRow) => row.new_deaths_per_million >= 0.1
        }
    },
    cases: {
        total: {
            title: "Days since the 100th confirmed case",
            fn: (row: ParsedCovidRow) => row.total_cases >= 100
        },
        daily: {
            title: "Days since confirmed cases first reached 30 per day",
            fn: (row: ParsedCovidRow) => row.new_cases >= 30
        },
        perCapita: {
            title:
                "Days since the total confirmed cases per million people reached 1",
            fn: (row: ParsedCovidRow) => row.total_cases_per_million >= 1
        }
    },
    tests: {
        total: {
            title: "Days since the 5th total confirmed death",
            fn: (row: ParsedCovidRow) => row.total_deaths >= 5
        },
        daily: {
            title: "Days since 5 daily deaths first reported",
            fn: (row: ParsedCovidRow) => row.new_deaths >= 5
        },
        perCapita: {
            title: "Days since total confirmed deaths reached 0.1 per million",
            fn: (row: ParsedCovidRow) => row.new_deaths_per_million >= 0.1
        }
    }
}
