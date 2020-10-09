import {
    computeRollingAverage,
    dateDiffInDays,
    difference,
    fetchJSON,
    fetchText,
    flatten,
    groupBy,
    insertMissingValuePlaceholders,
    max,
    memoize,
    minBy,
    parseFloatOrUndefined,
    retryPromise,
    sortBy,
} from "grapher/utils/Util"
import moment from "moment"
import { csv } from "d3-fetch"
import {
    covidChartAndVariableMetaPath,
    covidDataPath,
    CovidGrapherRow,
    covidLastUpdatedPath,
    IntervalOption,
    MetricKind,
    ParsedCovidCsvRow,
} from "./CovidConstants"
import { CoreRow } from "coreTable/CoreTableConstants"

const stringColumnSlugs = new Set(
    `iso_code location date tests_units continent`.split(" ")
)

export const parseCovidRow = (row: ParsedCovidCsvRow): CovidGrapherRow => {
    const newRow: Partial<CovidGrapherRow> = row
    Object.keys(row).forEach((key) => {
        const isNumeric = !stringColumnSlugs.has(key)
        if (isNumeric)
            (row as any)[key] = parseFloatOrUndefined((row as any)[key])
    })

    if (row.location === "International") row.iso_code = "OWID_INT"

    newRow.entityName = row.location
    newRow.entityCode = row.iso_code
    newRow.day = dateToYear(row.date)
    newRow.time = newRow.day // todo: cleanup
    newRow.entityId = generateEntityId(row.location)

    if (newRow.location === "World") newRow.group_members = "All"

    return row as CovidGrapherRow
}

const globalEntityIds = new Map()
const generateEntityId = (entityName: string) => {
    if (!globalEntityIds.has(entityName))
        globalEntityIds.set(entityName, globalEntityIds.size)
    return globalEntityIds.get(entityName)
}

const dateToYearCache = new Map<string, number>() // Cache for performance
const dateToYear = (dateString: string): number => {
    if (!dateToYearCache.has(dateString))
        dateToYearCache.set(
            dateString,
            dateDiffInDays(
                moment.utc(dateString).toDate(),
                moment.utc("2020-01-21").toDate()
            )
        )
    return dateToYearCache.get(dateString)!
}

export const calculateRowsForGroup = (
    group: ParsedCovidCsvRow[],
    groupName: string
) => {
    const rowsByDay = new Map<string, CovidGrapherRow>()
    const rows = sortBy(group, (row) => dateToYear(row.date))
    const groupMembers = new Set()
    rows.forEach((row) => {
        const day = row.date
        groupMembers.add(row.iso_code)
        if (!rowsByDay.has(day)) {
            const newRow: any = {}
            Object.keys(row).forEach((key) => (newRow[key] = undefined))
            rowsByDay.set(day, {
                location: groupName,
                continent: row.continent,
                iso_code: groupName.replace(" ", ""),
                date: day,
                day: dateToYear(day),
                new_cases: 0,
                entityName: groupName,
                entityCode: groupName.replace(" ", ""),
                entityId: generateEntityId(groupName),
                new_deaths: 0,
                population: 0,
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
    const group_members = Array.from(groupMembers).join("")
    // We need to compute cumulatives again because sometimes data will stop for a country.
    newRows.forEach((row) => {
        total_cases += row.new_cases
        total_deaths += row.new_deaths
        row.total_cases = total_cases
        row.total_deaths = total_deaths
        row.group_members = group_members
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
            .filter((cont) => cont)
            .map((continentName) =>
                calculateRowsForGroup(grouped[continentName], continentName)
            )
    )
}

const fetchData = async () => {
    const rawData = (await csv(covidDataPath)) as any
    return rawData
}

const parseData = (rawData: any) => {
    const filtered: CovidGrapherRow[] = rawData
        .map(parseCovidRow)
        .filter((row: CovidGrapherRow) => row.location !== "International")

    const latestDate = max(filtered.map((row) => row.date))

    const continentRows = generateContinentRows(filtered).filter(
        // Drop the last day in aggregates containing Spain & Sweden
        (row) => !(row.date === latestDate && row.location === "Europe")
    )

    const euRows = calculateRowsForGroup(
        filtered.filter((row: ParsedCovidCsvRow) =>
            euCountries.has(row.location)
        ),
        "European Union"
        // Drop the last day in aggregates containing Spain & Sweden
    ).filter((row) => row.date !== latestDate)

    const rows = filtered.concat(continentRows, euRows) as CovidGrapherRow[]
    return rows
}

export const fetchAndParseData = async () => {
    const rawData = await fetchData()
    return parseData(rawData)
}

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
    "Sweden",
])

// Todo: replace with someone else's library
export const computeRollingAveragesForEachGroup = (
    rows: CoreRow[],
    valueAccessor: (row: CoreRow) => any,
    groupColName: string,
    dateColName: string,
    rollingAverage: number
) => {
    const groups: number[][] = []
    if (!rows[0]) return []
    let currentGroup = rows[0][groupColName]
    let currentRows: CoreRow[] = []
    // Assumes items are sorted by entity
    for (let i = 0; i <= rows.length; i++) {
        const row = rows[i]
        const groupName = row && row[groupColName]

        if (currentGroup !== groupName) {
            const averages = computeRollingAverage(
                insertMissingValuePlaceholders(
                    currentRows.map(valueAccessor),
                    currentRows.map((row) => row[dateColName])
                ),
                rollingAverage
            ).filter((value) => value !== null) as number[]
            groups.push(averages)
            if (!row) break
            currentRows = []
            currentGroup = groupName
        }
        currentRows.push(row)
    }
    return flatten(groups)
}

const memoizedFetchAndParseData = memoize(fetchAndParseData)

const fetchLastUpdatedTime = memoize(() =>
    retryPromise(() => fetchText(covidLastUpdatedPath))
)

// Fetchs the baked JSON file containing chart and variables meta data for maps and source tabs.
const fetchCovidChartAndVariableMeta = memoize(() =>
    retryPromise(() => fetchJSON(covidChartAndVariableMetaPath))
)

export const getRequiredData = async () => {
    const [typedData, updated, covidMeta] = await Promise.all([
        memoizedFetchAndParseData(),
        fetchLastUpdatedTime(),
        fetchCovidChartAndVariableMeta(),
    ])
    return {
        typedData,
        updated,
        covidMeta,
    }
}

export const perCapitaDivisorByMetric = (metric: MetricKind) =>
    metric === "tests" ? 1e3 : 1e6

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
    const colorCounts = Object.entries(
        groupBy(usedColors)
    ).map(([color, arr]) => [color, arr.length])
    const mostUnusedColor = minBy(colorCounts, ([, count]) => count) as [
        string,
        number
    ]
    return mostUnusedColor[0]
}

export const buildColumnSlug = (
    name: MetricKind,
    perCapita: number,
    interval: IntervalOption,
    rollingAverage?: number
) =>
    [
        name,
        perCapita === 1e3
            ? "perThousand"
            : perCapita === 1e6
            ? "perMil"
            : undefined,
        interval,
        rollingAverage ? `${rollingAverage}DayAvg` : undefined,
    ]
        .filter((i) => i)
        .join("-")
