import {
    dateDiffInDays,
    maxBy,
    computeRollingAverage,
    flatten,
    cloneDeep,
    map,
    groupBy,
    parseFloatOrUndefined,
    insertMissingValuePlaceholders,
    difference,
    entries,
    minBy,
    fromPairs,
    sortBy
} from "charts/Util"
import moment from "moment"
import { ParsedCovidRow, MetricKind, CountryOption } from "./CovidTypes"
import { OwidVariable } from "charts/owidData/OwidVariable"
import { variablePartials } from "./CovidVariablePartials"
import { csv } from "d3-fetch"

const keepStrings = new Set(
    `iso_code location date tests_units continent`.split(" ")
)

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
    const filtered = rawData
        .map(parseCovidRow)
        .filter(
            row => row.location !== "World" && row.location !== "International"
        )

    const continentRows = generateContinentRows(filtered)
    const euRows = calculateRowsForGroup(getEuRows(filtered), "European Union")
    return filtered.concat(continentRows, euRows)
}

const getEuRows = (rows: ParsedCovidRow[]) =>
    rows.filter(row => euCountries.has(row.location))

const euCountries = new Set([
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Netherlands",
    "Poland",
    "Portugal",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden"
])

export const calculateRowsForGroup = (
    group: ParsedCovidRow[],
    groupName: string
) => {
    const groupRows = new Map<string, ParsedCovidRow>()
    const rows = sortBy(group, row => moment(row.date).unix())
    rows.forEach(row => {
        const day = row.date
        if (!groupRows.has(day)) {
            const newRow: any = {}
            Object.keys(row).forEach(key => (newRow[key] = undefined))
            groupRows.set(day, {
                location: groupName,
                iso_code: groupName.replace(" ", ""),
                date: day,
                new_cases: 0,
                new_deaths: 0,
                population: 0
            } as ParsedCovidRow)
        }
        const newRow = groupRows.get(day)!
        newRow.population += row.population
        newRow.new_cases += row.new_cases || 0
        newRow.new_deaths += row.new_deaths || 0
    })
    const newRows = Array.from(groupRows.values())
    let total_cases = 0
    let total_deaths = 0
    let maxPopulation = 0
    // We need to compute cumulatives again because sometimes data will stop for a country.
    newRows.forEach(row => {
        total_cases += row.new_cases
        total_deaths += row.new_deaths
        row.total_cases = total_cases
        row.total_deaths = total_deaths
        if (row.population > maxPopulation) maxPopulation = row.population

        // Once we add a country to a group, we assume we will always have data for that country, so even if the
        // country is late in reporting the data keep that country in the population count.
        row.population = maxPopulation
    })
    return newRows
}

// Generates rows for each region.
export const generateContinentRows = (rows: ParsedCovidRow[]) => {
    const grouped = groupBy(rows, "continent")
    return flatten(
        Object.keys(grouped)
            .filter(cont => cont)
            .map(continentName =>
                calculateRowsForGroup(grouped[continentName], continentName)
            )
    )
}

export const makeCountryOptions = (data: ParsedCovidRow[]): CountryOption[] => {
    const rowsByCountry = groupBy(data, "iso_code")
    return map(rowsByCountry, rows => {
        const { location, iso_code, population, continent } = rows[0]
        return {
            name: location,
            slug: location,
            code: iso_code,
            population,
            continent,
            latestTotalTestsPerCase: getLatestTotalTestsPerCase(rows),
            rows
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
    owidVariable: OwidVariable,
    threshold: number,
    title: string
) => {
    let currentCountry: number
    let firstCountryDate: number
    const dataWeNeed = owidVariable.values
        .map((value, index) => {
            const entity = owidVariable.entities[index]
            const entityName = owidVariable.entityNames[index]
            const year = owidVariable.years[index]
            if (entity !== currentCountry) {
                if (value < threshold) return undefined
                currentCountry = entity
                firstCountryDate = year
            }
            return {
                year,
                entity,
                entityName,
                // Not all countries have a row for each day, so we need to compute the difference between the current row and the first threshold
                // row for that country.
                value: year - firstCountryDate
            }
        })
        .filter(row => row)

    const partial = variablePartials.days_since
    partial.name = title

    const variable: Partial<OwidVariable> = {
        ...partial,
        years: dataWeNeed.map(row => row!.year),
        entities: dataWeNeed.map(row => row!.entity),
        entityNames: dataWeNeed.map(row => row!.entityName),
        values: dataWeNeed.map(row => row!.value),
        display: { includeInTable: false }
    }

    return variable as OwidVariable
}

type MetricKey = {
    [K in MetricKind]: number
}

export const buildCovidVariableId = (
    name: MetricKind,
    perCapita: number,
    rollingAverage?: number,
    daily?: boolean
): number => {
    const arbitraryStartingPrefix = 1145
    const names: MetricKey = {
        tests: 0,
        cases: 1,
        deaths: 2,
        positive_test_rate: 3,
        case_fatality_rate: 4,
        tests_per_case: 5
    }
    const parts = [
        arbitraryStartingPrefix,
        names[name],
        daily ? 1 : 0,
        perCapita,
        rollingAverage
    ]
    return parseInt(parts.join(""))
}

const computeRollingAveragesForEachCountry = (
    values: number[],
    entities: string[],
    years: number[],
    rollingAverage: number
) => {
    const averages: number[][] = []
    let currentEntity = entities[0]
    let currentValues: number[] = []
    let currentDates: number[] = []
    // Assumes items are sorted by entity
    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]
        if (currentEntity !== entity) {
            averages.push(
                computeRollingAverage(
                    insertMissingValuePlaceholders(currentValues, currentDates),
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
    averages.push(
        computeRollingAverage(
            insertMissingValuePlaceholders(currentValues, currentDates),
            rollingAverage
        ).filter(value => value !== undefined) as number[]
    )
    return flatten(averages)
}

function buildEntityAnnotations(
    data: ParsedCovidRow[],
    metric: MetricKind
): string | undefined {
    if (
        metric === "cases" ||
        metric === "deaths" ||
        metric === "case_fatality_rate"
    ) {
        return `Benin: Note that on May 19 the methodology has changed
Spain: Note that on May 25 the methodology has changed
United Kingdom: Note that on June 1 the methodology has changed
Panama: Note that on June 3 the methodology has changed
European Union: Some EU countries changed methodology. See country-by-country series.
India: Note that on June 17 earlier deaths were added to the total.`
    } else if (
        metric === "tests" ||
        metric === "positive_test_rate" ||
        metric === "tests_per_case"
    ) {
        // convert to object to extract unique country => unit mapping
        const unitByCountry = fromPairs(
            data
                .filter(row => row.tests_units)
                .map(row => [row.location, row.tests_units])
        )
        return Object.entries(unitByCountry)
            .map(([location, unit]) => `${location}: ${unit}`)
            .join("\n")
    }
    return undefined
}

export const computeCovidColumn = (
    rows: ParsedCovidRow[],
    rowFn: RowAccessor,
    perCapita: number,
    rollingAverage?: number
) => {
    const mappedRows = rows
        .map(row => {
            let value = rowFn(row)
            const year = dateToYear(row.date)
            const entityName = row.location
            if (value === undefined) return undefined

            if (perCapita > 1) {
                const pop = row.population
                if (!pop)
                    throw new Error(`Missing population for ${row.location}`)
                value = perCapita * (value / pop)
            }

            return {
                value,
                year,
                entityName,
                row
            }
        })
        .filter(i => i)
    const years = mappedRows.map(row => row!.year)
    const entityNames = mappedRows.map(row => row!.entityName)
    const rowPointers = mappedRows.map(row => row!.row)
    let values = mappedRows.map(row => row!.value)

    if (rollingAverage)
        values = computeRollingAveragesForEachCountry(
            values,
            entityNames,
            years,
            rollingAverage
        )

    // This should never throw but keep it here in case something goes wrong in our building of the runtime variables
    // so we will fail and can spot it.
    if (
        years.length !== values.length &&
        values.length !== entityNames.length
    ) {
        throw new Error(`Length mismatch when building variables.`)
    }

    return {
        years,
        entityNames,
        values,
        rows: rowPointers
    }
}

export const buildCovidVariable = (
    newId: number,
    name: MetricKind,
    countryMap: Map<string, number>,
    rows: ParsedCovidRow[],
    rowFn: RowAccessor,
    perCapita: number,
    rollingAverage?: number,
    daily?: boolean,
    updatedTime?: string
): OwidVariable => {
    const partial = buildVariableMetadata(
        newId,
        rows,
        name,
        perCapita,
        daily,
        rollingAverage,
        updatedTime
    )

    const column = computeCovidColumn(rows, rowFn, perCapita, rollingAverage)

    const entities = column.entityNames.map(name =>
        countryMap.get(name)
    ) as number[]

    const variable: Partial<OwidVariable> = {
        ...partial,
        ...column,
        entities
    }

    return variable as OwidVariable
}

const buildVariableMetadata = (
    newId: number,
    rows: ParsedCovidRow[],
    name: MetricKind,
    perCapita: number,
    daily?: boolean,
    rollingAverage?: number,
    updatedTime?: string
) => {
    const variable = cloneDeep(variablePartials[name])

    variable.source!.name = `${variable.source!.name}${updatedTime}`

    variable.id = newId

    const messages: { [index: number]: string } = {
        1: "",
        1000: " per thousand people",
        1000000: " per million people"
    }

    variable.display!.name = `${daily ? "Daily " : "Cumulative "}${
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

    variable.display!.entityAnnotationsMap = buildEntityAnnotations(rows, name)

    return variable
}

export const getTrajectoryOptions = (
    metric: MetricKind,
    daily: boolean,
    perCapita: boolean
) => {
    const key = metric === "cases" ? metric : "deaths"
    return trajectoryOptions[key][
        perCapita ? "perCapita" : daily ? "daily" : "total"
    ]
}

const trajectoryOptions = {
    deaths: {
        total: {
            title: "Days since the 5th total confirmed death",
            threshold: 5
        },
        daily: {
            title: "Days since 5 daily new deaths first reported",
            threshold: 5
        },
        perCapita: {
            title: "Days since total confirmed deaths reached 0.1 per million",
            threshold: 0.1
        }
    },
    cases: {
        total: {
            title: "Days since the 100th confirmed case",
            threshold: 100
        },
        daily: {
            title: "Days since confirmed cases first reached 30 per day",
            threshold: 30
        },
        perCapita: {
            title:
                "Days since the total confirmed cases per million people reached 1",
            threshold: 1
        }
    }
}

export function getLeastUsedColor(
    availableColors: string[],
    usedColors: string[]
): string {
    // If there are unused colors, return the first available
    const unusedColors = difference(availableColors, usedColors)
    if (unusedColors.length > 0) {
        return unusedColors[0]
    }
    // If all colors are used, we want to count the times each color is used, and use the most
    // unused one.
    const colorCounts = entries(groupBy(usedColors)).map(([color, arr]) => [
        color,
        arr.length
    ])
    const mostUnusedColor = minBy(colorCounts, ([, count]) => count) as [
        string,
        number
    ]
    return mostUnusedColor[0]
}
