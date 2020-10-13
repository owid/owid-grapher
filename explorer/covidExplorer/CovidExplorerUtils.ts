import {
    computeRollingAverage,
    dateDiffInDays,
    difference,
    fetchJSON,
    fetchText,
    flatten,
    groupBy,
    insertMissingValuePlaceholders,
    memoize,
    minBy,
    retryPromise,
    sortBy,
} from "grapher/utils/Util"
import moment from "moment"
import { csv } from "d3-fetch"
import { csvParse } from "d3-dsv"
import {
    covidChartAndVariableMetaPath,
    covidDataPath,
    CovidRow,
    covidLastUpdatedPath,
    MegaRow,
    MetricOptions,
} from "./CovidConstants"
import { CoreRow, Time } from "coreTable/CoreTableConstants"

const dateToTimeCache = new Map<string, Time>() // Cache for performance
export const megaDateToTime = (dateString: string): Time => {
    if (!dateToTimeCache.has(dateString))
        dateToTimeCache.set(
            dateString,
            dateDiffInDays(
                moment.utc(dateString).toDate(),
                moment.utc("2020-01-21").toDate()
            )
        )
    return dateToTimeCache.get(dateString)!
}

export const euCountries = new Set([
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

// Todo: this is just a group with reductions. Should be able to move it to mostly CoreTable ops.
export const calculateCovidRowsForGroup = (
    rows: CovidRow[],
    entityName: string
) => {
    const rowsByTime = new Map<Time, CovidRow>()
    const sortedRows = sortBy(rows, (row) => row.time)
    const groupMembers = new Set()
    sortedRows.forEach((row) => {
        const time = row.time
        groupMembers.add(row.iso_code)
        if (!rowsByTime.has(time)) {
            const newRow: any = {}
            Object.keys(row).forEach((key) => (newRow[key] = undefined))
            rowsByTime.set(time, {
                entityName,
                continent: row.continent,
                entityCode: entityName.replace(" ", ""),
                entityId: 0, // todo: remove this as a required Owid column?
                date: row.date,
                time,
                new_cases: 0,
                new_deaths: 0,
                population: 0,
            } as CovidRow)
        }
        const newRow = rowsByTime.get(time)!
        newRow.population += row.population
        newRow.new_cases += row.new_cases || 0
        newRow.new_deaths += row.new_deaths || 0
    })
    const newRows = Array.from(rowsByTime.values())
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

const fetchMegaRows = async () => {
    const rows = await csv(covidDataPath)
    return (rows as any) as MegaRow[]
}

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

const memoizedFetchedMegaRows = memoize(fetchMegaRows)

const fetchLastUpdatedTime = memoize(() =>
    retryPromise(() => fetchText(covidLastUpdatedPath))
)

// Fetchs the baked JSON file containing chart and variables meta data for maps and source tabs.
const fetchCovidChartAndVariableMeta = memoize(() =>
    retryPromise(() => fetchJSON(covidChartAndVariableMetaPath))
)

export const fetchRequiredData = async () => {
    const [megaRows, updated, covidMeta] = await Promise.all([
        memoizedFetchedMegaRows(),
        fetchLastUpdatedTime(),
        fetchCovidChartAndVariableMeta(),
    ])
    return {
        megaRows,
        updated,
        covidMeta,
    }
}

export const perCapitaDivisorByMetric = (metric: MetricOptions) =>
    metric === MetricOptions.tests ? 1e3 : 1e6

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

const sampleMegaCsv = `population,iso_code,location,continent,date,total_cases,new_cases,total_deaths,new_deaths,total_cases_per_million,new_cases_per_million,total_deaths_per_million,new_deaths_per_million,total_tests,new_tests,total_tests_per_thousand,new_tests_per_thousand,tests_units
1000,ABW,Aruba,North America,2020-03-13,2,2,0,0,18.733,18.733,0.0,0.0,,,,,
1000,ABW,Aruba,North America,2020-03-20,4,2,0,0,37.465,18.733,0.0,0.0,,,,,
1000,ABW,Aruba,North America,2020-03-24,12,8,0,0,112.395,74.93,0.0,0.0,,,,,
1000,ABW,Aruba,North America,2020-03-25,17,5,0,0,159.227,46.831,0.0,0.0,,,,,
2000,USA,United States,North America,2020-05-05,1180634,22593,68934,1252,3566.842,68.256,208.258,3.782,7544328.0,258954.0,22.792,0.782,inconsistent units (COVID Tracking Project)
2000,USA,United States,North America,2020-05-06,1204475,23841,71078,2144,3638.868,72.027,214.735,6.477,,,,,
2200,FRA,France,Europe,2020-05-06,1204475,23841,71078,2144,3638.868,72.027,214.735,6.477,,,,,
2200,FRA,France,Europe,2020-05-07,1204475,23841,71078,2144,3638.868,72.027,214.735,6.477,,,,,
3000,,World,,2020-05-01,3215927,84440,232869,5534,412.573,10.833,29.875,0.71,,,,,
3000,,World,,2020-05-02,3308891,92964,238707,5838,424.5,11.926,30.624,0.749,,,,,
3000,,World,,2020-05-03,3389459,80568,243476,4769,434.836,10.336,31.236,0.612,,,,,
3000,,World,,2020-05-04,3467502,78043,246999,3523,444.848,10.012,31.688,0.452,,,,,
3000,,World,,2020-05-05,3544168,76666,250977,3978,454.684,9.836,32.198,0.51,,,,,
3000,,World,,2020-05-06,3623803,79635,256880,5903,464.9,10.216,32.955,0.757,,,,,`

export const sampleMegaRows = (csvParse(sampleMegaCsv) as any) as MegaRow[]
