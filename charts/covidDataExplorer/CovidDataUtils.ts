import {
    dateDiffInDays,
    flatten,
    map,
    groupBy,
    parseFloatOrUndefined,
    difference,
    entries,
    minBy,
    sortBy
} from "charts/Util"
import moment from "moment"
import {
    ParsedCovidCsvRow,
    MetricKind,
    CountryOption,
    CovidGrapherRow
} from "./CovidTypes"
import { columnSpecs } from "./CovidColumnSpecs"
import { csv } from "d3-fetch"
import { OwidTable, ComputedColumnSpec } from "charts/owidData/OwidTable"

const keepStrings = new Set(
    `iso_code location date tests_units continent`.split(" ")
)

const ents = new Set()
export const parseCovidRow = (row: ParsedCovidCsvRow): CovidGrapherRow => {
    const newRow: Partial<CovidGrapherRow> = row
    Object.keys(row).forEach(key => {
        const isNumeric = !keepStrings.has(key)
        if (isNumeric)
            (row as any)[key] = parseFloatOrUndefined((row as any)[key])
        if (key === "iso_code" && !row.iso_code) {
            if (row.location === "World") row.iso_code = "OWID_WRL"
            else if (row.location === "International") row.iso_code = "OWID_INT"
        }
    })
    newRow.entityName = row.location
    newRow.entityCode = row.iso_code
    newRow.day = dateToYear(row.date)
    ents.add(row.location)
    newRow.entityId = ents.size - 1

    return row as CovidGrapherRow
}

const EPOCH_DATE = "2020-01-21"

const dateToYear = (dateString: string): number =>
    dateDiffInDays(
        moment.utc(dateString).toDate(),
        moment.utc(EPOCH_DATE).toDate()
    )

export const covidDataPath =
    "https://covid.ourworldindata.org/data/owid-covid-data.csv"
export const covidLastUpdatedPath =
    "https://covid.ourworldindata.org/data/owid-covid-data-last-updated-timestamp.txt"

export const fetchAndParseData = async (): Promise<CovidGrapherRow[]> => {
    const rawData = (await csv(covidDataPath)) as any
    const filtered = rawData
        .map(parseCovidRow)
        .filter((row: CovidGrapherRow) => row.location !== "International")

    const continentRows = generateContinentRows(filtered)
    const euRows = calculateRowsForGroup(getEuRows(filtered), "European Union")
    return filtered.concat(continentRows, euRows)
}

const getEuRows = (rows: ParsedCovidCsvRow[]) =>
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

const calculateRowsForGroup = (
    group: ParsedCovidCsvRow[],
    groupName: string
) => {
    const rowsByDay = new Map<string, CovidGrapherRow>()
    const rows = sortBy(group, row => moment(row.date).unix())
    rows.forEach(row => {
        const day = row.date
        if (!rowsByDay.has(day)) {
            const newRow: any = {}
            Object.keys(row).forEach(key => (newRow[key] = undefined))
            ents.add(groupName)
            rowsByDay.set(day, {
                location: groupName,
                iso_code: groupName.replace(" ", ""),
                date: day,
                day: dateToYear(day),
                new_cases: 0,
                entityName: groupName,
                entityCode: groupName.replace(" ", ""),
                entityId: ents.size - 1,
                new_deaths: 0,
                population: 0
            } as CovidGrapherRow)
        }
        const newRow = rowsByDay.get(day)!
        newRow.population += row.population
        newRow.new_cases += row.new_cases || 0
        newRow.new_deaths += row.new_deaths || 0
    })
    const newRows = Array.from(rowsByDay.values())
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
export const generateContinentRows = (rows: ParsedCovidCsvRow[]) => {
    const grouped = groupBy(rows, "continent")
    return flatten(
        Object.keys(grouped)
            .filter(cont => cont)
            .map(continentName =>
                calculateRowsForGroup(grouped[continentName], continentName)
            )
    )
}

export const makeCountryOptions = (
    data: ParsedCovidCsvRow[]
): CountryOption[] => {
    const rowsByCountry = groupBy(data, "iso_code")
    return map(rowsByCountry, rows => {
        const { location, iso_code, population, continent } = rows[0]
        return {
            name: location,
            slug: location,
            code: iso_code,
            population,
            continent,
            rows
        }
    })
}

export const getColumnSlug = (
    name: MetricKind,
    perCapita: number,
    daily?: boolean,
    rollingAverage?: number
) => {
    return [
        name,
        perCapita === 1e3
            ? "perThousand"
            : perCapita === 1e6
            ? "perMil"
            : undefined,
        daily ? "daily" : "cumulative",
        rollingAverage ? rollingAverage + "DayAvg" : undefined
    ]
        .filter(i => i)
        .join("-")
}

export const getTrajectoryOptions = (
    metric: MetricKind,
    daily: boolean,
    perCapita: boolean,
    smoothing?: number
) => {
    const key = metric === "cases" ? metric : "deaths"
    const option = {
        ...trajectoryOptions[key][
            perCapita ? "perCapita" : daily ? "daily" : "total"
        ],
        sourceSlug: getColumnSlug(metric, perCapita ? 1e6 : 1, daily, smoothing)
    }
    return option
}

export const addDaysSinceColumn = (
    table: OwidTable,
    sourceColumnSlug: string,
    id: number,
    threshold: number,
    title: string
) => {
    const slug = `daysSince${sourceColumnSlug}Hit${threshold}`
    const spec: ComputedColumnSpec = {
        ...columnSpecs.days_since,
        name: title,
        owidVariableId: id,
        slug,
        fn: row => {
            if (row.entityName !== currentCountry) {
                const sourceValue = row[sourceColumnSlug]
                if (sourceValue === undefined || sourceValue < threshold)
                    return undefined
                currentCountry = row.entityName
                countryExceededThresholdOnDay = row.day
            }
            return row.day - countryExceededThresholdOnDay
        }
    }

    let currentCountry: number
    let countryExceededThresholdOnDay: number
    table.addComputedColumn(spec)
    return slug
}

// todo: add annotations back
// `Benin: Note that on May 19 the methodology has changed
// Spain: Note that on May 25 the methodology has changed
// United Kingdom: Note that on June 1 the methodology has changed
// Panama: Note that on June 3 the methodology has changed
// European Union: Some EU countries changed methodology. See country-by-country series.
// India: Note that on June 17 earlier deaths were added to the total.`

const trajectoryOptions = {
    deaths: {
        total: {
            title: "Days since the 5th total confirmed death",
            threshold: 5,
            id: 4561
        },
        daily: {
            title: "Days since 5 daily new deaths first reported",
            threshold: 5,
            id: 4562
        },
        perCapita: {
            title: "Days since total confirmed deaths reached 0.1 per million",
            threshold: 0.1,
            id: 4563
        }
    },
    cases: {
        total: {
            title: "Days since the 100th confirmed case",
            threshold: 100,
            id: 4564
        },
        daily: {
            title: "Days since confirmed cases first reached 30 per day",
            threshold: 30,
            id: 4565
        },
        perCapita: {
            title:
                "Days since the total confirmed cases per million people reached 1",
            threshold: 1,
            id: 4566
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
